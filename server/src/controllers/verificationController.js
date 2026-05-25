const Psychologist = require('../models/Psychologist');
const ProfilePhotoModerationRequest = require('../models/ProfilePhotoModerationRequest');
const CredentialDocument = require('../models/CredentialDocument');
const axios = require('axios');
const fs = require('fs');
const pdfParse = require('pdf-parse');
const { audit } = require('../services/auditService');
const {
  buildStorageRelativePath,
  persistUploadedTempFile,
  sha256File,
  resolvePrivatePath
} = require('../services/credentialDocumentStorage');

const MAX_ID_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_PDF_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_INTRO_VIDEO_SIZE_BYTES = 100 * 1024 * 1024;

const safeUnlink = (filePath) => {
  try {
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (err) {
    // best-effort cleanup
  }
};

const ensureJpegAtPath = async (file) => {
  if (!file?.path || !file?.mimetype) return;
  if (file.mimetype !== 'image/png') return;

  // Files are stored as *.jpg for ID images; if the upload is PNG,
  // convert & overwrite so downstream consumers can reliably read JPEG.
  let sharp;
  try {
    sharp = require('sharp');
  } catch (err) {
    throw new Error('PNG ID images require the server dependency "sharp". Please install it or upload a JPG/JPEG.');
  }
  const input = fs.readFileSync(file.path);
  const output = await sharp(input).jpeg({ quality: 90 }).toBuffer();
  fs.writeFileSync(file.path, output);
  file.mimetype = 'image/jpeg';
  // Ensure storage path uses a matching extension (we use originalname when persisting).
  try {
    const ext = require('path').extname(String(file.originalname || '')).toLowerCase();
    if (ext === '.png') file.originalname = String(file.originalname).slice(0, -4) + '.jpg';
    else if (!ext) file.originalname = String(file.originalname || 'id.jpg') + '.jpg';
  } catch (e) {
    // best effort
  }
};

const getNextVersion = async ({ ownerUserId, type }) => {
  const latest = await CredentialDocument.findOne({ ownerUserId, type }).sort({ version: -1 }).select('version');
  return (latest?.version || 0) + 1;
};

const upsertCredentialDoc = async ({ ownerUserId, psychologistId, type, multerFile }) => {
  const version = await getNextVersion({ ownerUserId, type });
  const storagePath = buildStorageRelativePath({
    ownerUserId,
    type,
    version,
    originalName: multerFile.originalname
  });
  const absolutePath = persistUploadedTempFile({ tempFilePath: multerFile.path, storagePath });
  const checksumSha256 = sha256File(absolutePath);

  const previousCurrent = await CredentialDocument.findOne({ ownerUserId, type, isCurrent: true }).select('_id');
  if (previousCurrent?._id) {
    await CredentialDocument.updateOne({ _id: previousCurrent._id }, { isCurrent: false });
  }

  const doc = await CredentialDocument.create({
    ownerUserId,
    psychologistId,
    type,
    version,
    isCurrent: true,
    replacedBy: null,
    storagePath,
    originalName: multerFile.originalname,
    mimeType: multerFile.mimetype,
    sizeBytes: multerFile.size,
    checksumSha256,
    uploadedByUserId: ownerUserId
  });

  if (previousCurrent?._id) {
    await CredentialDocument.updateOne({ _id: previousCurrent._id }, { replacedBy: doc._id });
  }

  return doc;
};

// Helper: extract text from PDF file
const extractPDFText = async (filePath) => {
  try {
    const buffer = fs.readFileSync(filePath);
    const data = await pdfParse(buffer);
    return data.text || 'No text extracted';
  } catch (err) {
    console.log('PDF parse error:', err.message);
    return 'Could not extract text from document';
  }
};

const extractPDFTextFromCredentialDoc = async (credentialDocId) => {
  if (!credentialDocId) return '';
  const doc = await CredentialDocument.findById(credentialDocId).select('storagePath mimeType');
  if (!doc) return '';
  if (String(doc.mimeType || '') !== 'application/pdf') return '';
  try {
    const { absolute } = resolvePrivatePath(doc.storagePath);
    if (!fs.existsSync(absolute)) return '';
    return await extractPDFText(absolute);
  } catch (err) {
    return '';
  }
};

const truncateText = (value, maxChars) => {
  const text = String(value || '');
  if (!maxChars || text.length <= maxChars) return text;
  return text.slice(0, maxChars) + `\n\n[Truncated to ${maxChars} characters]`;
};

// Helper: analyze documents with Groq
const analyzeWithGroq = async (cvText, diplomaText) => {
  // Groq can return 413 if the prompt payload is too large.
  // Keep inputs bounded to avoid breaking onboarding for long PDFs.
  const MAX_DOC_CHARS = 12000;
  const safeCvText = truncateText(cvText, MAX_DOC_CHARS);
  const safeDiplomaText = truncateText(diplomaText, MAX_DOC_CHARS);

  const response = await axios.post(
    'https://api.groq.com/openai/v1/chat/completions',
    {
      model: 'llama-3.1-8b-instant',
      messages: [
        {
          role: 'system',
          content: 'You are an assistant that verifies psychologist credentials. Analyze the provided CV and diploma and give a structured summary for the admin to help them decide whether to approve this psychologist. Be concise and professional.'
        },
        {
          role: 'user',
          content: 'CV:\n' + safeCvText + '\n\nDIPLOMA:\n' + safeDiplomaText + '\n\nPlease provide: 1) A summary of qualifications 2) Years of experience 3) Specializations mentioned 4) Whether the diploma appears legitimate 5) Overall recommendation (Approve/Review/Reject) with reason.'
        }
      ],
      temperature: 0.3,
      max_tokens: 800
    },
    {
      headers: {
        Authorization: 'Bearer ' + process.env.GROQ_API_KEY,
        'Content-Type': 'application/json'
      }
    }
  );
  return response.data.choices[0].message.content;
};

// @POST /api/verification/upload
exports.uploadDocuments = async (req, res) => {
  try {
    console.log('uploadDocuments called');
    console.log('files:', req.files);
    const psychologist = await Psychologist.findOne({ userId: req.user.id })
      .select('_id profileStatus isApproved isRejected rejectionReason rejectionDetails firstName lastName city credentialDocs submittedAt lastResubmittedAt')
      .lean();

    if (!psychologist) {
      // Cleanup any uploaded files to avoid orphaned uploads
      Object.values(req.files || {}).flat().forEach((f) => safeUnlink(f.path));
      return res.status(404).json({ message: 'Psychologist profile not found. Please complete your profile first.' });
    }

    const status = String(psychologist.profileStatus || 'Draft');
    const isResubmission = status === 'Rejected';

    if (status !== 'Draft' && status !== 'Rejected') {
      Object.values(req.files || {}).flat().forEach((f) => safeUnlink(f.path));
      return res.status(409).json({ message: 'Credential submission is only allowed while profile status is Draft or Rejected' });
    }
    if (psychologist.isApproved) {
      Object.values(req.files || {}).flat().forEach((f) => safeUnlink(f.path));
      return res.status(409).json({ message: 'Profile is already approved' });
    }

    // For rejected profiles, admins may specify which document slots must be updated.
    const requiredDocTypesForResubmission = Array.isArray(psychologist.rejectionDetails?.documents)
      ? psychologist.rejectionDetails.documents.map(String).filter(Boolean)
      : [];

    const cvFile = req.files?.cv?.[0] || null;
    const diplomaFile = req.files?.diploma?.[0] || null;
    const idFrontFile = req.files?.idFront?.[0] || null;
    const idBackFile = req.files?.idBack?.[0] || null;
    const introVideoFile = req.files?.introVideo?.[0] || null;

    // Draft: require full bundle (initial submission).
    // Rejected: allow partial re-uploads, but ensure we end with a complete set (existing or new),
    // and optionally require specific doc slots to be re-uploaded.
    const missingUploads = [];
    if (!isResubmission) {
      if (!cvFile) missingUploads.push('cv');
      if (!diplomaFile) missingUploads.push('diploma');
      if (!idFrontFile) missingUploads.push('idFront');
      if (!idBackFile) missingUploads.push('idBack');
      if (!introVideoFile) missingUploads.push('introVideo');
    } else if (requiredDocTypesForResubmission.length > 0) {
      const uploaded = new Set(Object.keys(req.files || {}));
      for (const t of requiredDocTypesForResubmission) {
        if (!uploaded.has(t)) missingUploads.push(t);
      }
    }

    if (missingUploads.length > 0) {
      Object.values(req.files || {}).flat().forEach((f) => safeUnlink(f.path));
      return res.status(400).json({
        message: 'Missing required documents for submission',
        missingDocuments: missingUploads
      });
    }

    if (cvFile && cvFile.size > MAX_PDF_SIZE_BYTES) {
      Object.values(req.files || {}).flat().forEach((f) => safeUnlink(f.path));
      return res.status(400).json({ message: 'CV must be 10MB or less' });
    }
    if (diplomaFile && diplomaFile.size > MAX_PDF_SIZE_BYTES) {
      Object.values(req.files || {}).flat().forEach((f) => safeUnlink(f.path));
      return res.status(400).json({ message: 'Diploma must be 10MB or less' });
    }

    if (idFrontFile && idFrontFile.size > MAX_ID_IMAGE_SIZE_BYTES) {
      Object.values(req.files || {}).flat().forEach((f) => safeUnlink(f.path));
      return res.status(400).json({ message: 'ID front image must be 5MB or less' });
    }
    if (idBackFile && idBackFile.size > MAX_ID_IMAGE_SIZE_BYTES) {
      Object.values(req.files || {}).flat().forEach((f) => safeUnlink(f.path));
      return res.status(400).json({ message: 'ID back image must be 5MB or less' });
    }

    // Normalize ID images to actual JPEG bytes (multer stores as front.jpg/back.jpg).
    if (idFrontFile) await ensureJpegAtPath(idFrontFile);
    if (idBackFile) await ensureJpegAtPath(idBackFile);

    if (introVideoFile && introVideoFile.size > MAX_INTRO_VIDEO_SIZE_BYTES) {
      Object.values(req.files || {}).flat().forEach((f) => safeUnlink(f.path));
      return res.status(400).json({ message: 'Introduction video must be 100MB or less' });
    }

    // Extract text from PDFs
    console.log('extracting CV text...');
    const cvText = cvFile
      ? await extractPDFText(cvFile.path)
      : await extractPDFTextFromCredentialDoc(psychologist.credentialDocs?.cv);
    console.log('CV text length:', cvText.length);
    console.log('extracting diploma text...');
    const diplomaText = diplomaFile
      ? await extractPDFText(diplomaFile.path)
      : await extractPDFTextFromCredentialDoc(psychologist.credentialDocs?.diploma);
    console.log('diploma text length:', diplomaText.length);

    // Analyze with Groq
    console.log('analyzing with Groq...');
    const aiSummary = await analyzeWithGroq(cvText, diplomaText);

    if (!psychologist.firstName || !psychologist.lastName || !psychologist.city) {
      Object.values(req.files || {}).flat().forEach(f => safeUnlink(f.path));
      return res.status(400).json({
        message: 'Profile is incomplete. Please complete required profile fields before submitting.',
        missingFields: ['firstName', 'lastName', 'city'].filter((k) => !psychologist[k])
      });
    }

    const ownerUserId = req.user.id;

    // Upload new docs if provided; otherwise keep existing credentialDocs references (for resubmissions).
    const cvDoc = cvFile
      ? await upsertCredentialDoc({ ownerUserId, psychologistId: psychologist._id, type: 'cv', multerFile: cvFile })
      : null;
    const diplomaDoc = diplomaFile
      ? await upsertCredentialDoc({ ownerUserId, psychologistId: psychologist._id, type: 'diploma', multerFile: diplomaFile })
      : null;
    const idFrontDoc = idFrontFile
      ? await upsertCredentialDoc({ ownerUserId, psychologistId: psychologist._id, type: 'idFront', multerFile: idFrontFile })
      : null;
    const idBackDoc = idBackFile
      ? await upsertCredentialDoc({ ownerUserId, psychologistId: psychologist._id, type: 'idBack', multerFile: idBackFile })
      : null;
    const introVideoDoc = introVideoFile
      ? await upsertCredentialDoc({ ownerUserId, psychologistId: psychologist._id, type: 'introVideo', multerFile: introVideoFile })
      : null;

    const nextCredentialDocs = {
      cv: (cvDoc?._id || psychologist.credentialDocs?.cv) || null,
      diploma: (diplomaDoc?._id || psychologist.credentialDocs?.diploma) || null,
      idFront: (idFrontDoc?._id || psychologist.credentialDocs?.idFront) || null,
      idBack: (idBackDoc?._id || psychologist.credentialDocs?.idBack) || null,
      introVideo: (introVideoDoc?._id || psychologist.credentialDocs?.introVideo) || null
    };

    const incomplete = Object.entries(nextCredentialDocs)
      .filter(([, v]) => !v)
      .map(([k]) => k);
    if (incomplete.length > 0) {
      return res.status(400).json({
        message: 'Cannot submit until all documents are present',
        missingDocuments: incomplete
      });
    }

    await Psychologist.updateOne(
      { _id: psychologist._id },
      {
        $set: {
          profileStatus: 'Submitted',
          aiVerificationSummary: aiSummary,
          isApproved: false,
          isRejected: false,
          rejectionReason: '',
          rejectedAt: null,
          rejectedByUserId: null,
          rejectionDetails: { fields: [], documents: [] },
          credentialDocs: nextCredentialDocs,
          // Legacy fields (deprecated): keep empty to prevent accidental public serving.
          cvUrl: '',
          diplomaUrl: '',
          idCard: { front: '', back: '' },
          introVideo: '',
          // Track resubmission timestamp separately.
          lastResubmittedAt: isResubmission ? new Date() : psychologist.lastResubmittedAt
        }
      }
    );

    await audit(req, {
      action: 'CREDENTIAL_SUBMISSION',
      targetType: 'Psychologist',
      targetId: psychologist._id,
      outcome: 'success',
      metadata: {
        documents: ['cv', 'diploma', 'idFront', 'idBack', 'introVideo'],
        resubmission: isResubmission,
        updatedDocuments: Object.keys(req.files || {})
      }
    });

    await Psychologist.updateOne(
      { _id: psychologist._id },
      {
        $set: { submittedAt: psychologist.submittedAt || new Date() },
        $push: {
          onboardingHistory: {
            status: 'Submitted',
            at: new Date(),
            byUserId: req.user.id,
            reason: isResubmission ? 'Resubmitted with updated documents' : 'Submitted with document bundle',
            details: { updatedDocuments: Object.keys(req.files || {}) }
          }
        }
      }
    );

    await notifyAdmins({
      title: 'New onboarding submission',
      message: 'A psychologist onboarding application was submitted and is ready for review.',
      link: '/admin',
      type: 'onboarding_submission'
    });

    res.status(200).json({
      message: 'Documents uploaded and analyzed. Awaiting admin approval.',
      aiSummary,
      idCardUploaded: true,
      introVideoUploaded: true
    });

  } catch (err) {
    console.log('uploadDocuments error:', err.message);
    await audit(req, {
      action: 'CREDENTIAL_SUBMISSION',
      outcome: 'failure',
      message: err.message
    });
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// @GET /api/verification/pending
exports.getPendingVerifications = async (req, res) => {
  try {
    const pending = await Psychologist.find({ profileStatus: 'Submitted', isApproved: false, isRejected: { $ne: true } })
      .populate('userId', 'email')
      .populate('credentialDocs.cv')
      .populate('credentialDocs.diploma')
      .populate('credentialDocs.idFront')
      .populate('credentialDocs.idBack')
      .populate('credentialDocs.introVideo')
      .sort({ createdAt: -1 });
    res.status(200).json(pending);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

const { notifyUser } = require('../services/notificationService');
const User = require('../models/User');

const notifyAdmins = async ({ title, message, link = '', type = 'onboarding' }) => {
  const admins = await User.find({ role: 'admin' }).select('_id');
  await Promise.all((admins || []).map((a) => notifyUser({ userId: a._id, title, message, link, type })));
};

// @PUT /api/verification/:id/approve
exports.approvePsychologist = async (req, res) => {
  try {
    if (String(process.env.REQUIRE_PROFILE_PHOTO_APPROVAL_FOR_ACTIVATION || '').toLowerCase() === 'true') {
      const candidate = await Psychologist.findById(req.params.id).select('userId');
      if (!candidate) return res.status(404).json({ message: 'Psychologist not found' });

      const latestPhotoReq = await ProfilePhotoModerationRequest.findOne({ userId: candidate.userId })
        .sort({ createdAt: -1 })
        .select('status');

      if (!latestPhotoReq || latestPhotoReq.status !== 'approved') {
        return res.status(400).json({
          message: 'Profile photo moderation must be approved before activating this profile.'
        });
      }
    }

    const psychologist = await Psychologist.findByIdAndUpdate(
      req.params.id,
      { isApproved: true, isRejected: false, profileStatus: 'Approved', rejectionReason: '', rejectedAt: null, rejectedByUserId: null },
      { returnDocument: 'after' }
    );
    if (!psychologist) return res.status(404).json({ message: 'Psychologist not found' });
    await audit(req, {
      action: 'PSYCHOLOGIST_APPROVE',
      targetType: 'Psychologist',
      targetId: psychologist._id,
      outcome: 'success'
    });
    await Psychologist.updateOne(
      { _id: psychologist._id },
      {
        $push: {
          onboardingHistory: {
            status: 'Approved',
            at: new Date(),
            byUserId: req.user.id,
            reason: '',
            details: {}
          }
        }
      }
    );

    try {
      await notifyUser({
        userId: psychologist.userId,
        title: 'Account approved',
        message: 'Your psychologist account has been approved. You are now visible to users and can start receiving bookings.',
        link: '/psychologist/dashboard',
        type: 'onboarding'
      });
    } catch (e) {
      // best-effort notification
    }
    res.status(200).json({ message: 'Psychologist approved', psychologist });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// @PUT /api/verification/:id/reject
exports.rejectPsychologist = async (req, res) => {
  try {
    const reason = String(req.body?.reason || '').trim();
    const details = req.body?.details || {};
    const fields = Array.isArray(details.fields) ? details.fields.map(String) : [];
    const documents = Array.isArray(details.documents) ? details.documents.map(String) : [];
    if (!reason) return res.status(400).json({ message: 'Rejection reason is required' });

    const psychologist = await Psychologist.findByIdAndUpdate(
      req.params.id,
      {
        isApproved: false,
        isRejected: true,
        profileStatus: 'Rejected',
        rejectionReason: reason,
        rejectedAt: new Date(),
        rejectedByUserId: req.user.id,
        rejectionDetails: { fields, documents }
      },
      { returnDocument: 'after' }
    );
    if (!psychologist) return res.status(404).json({ message: 'Psychologist not found' });
    await audit(req, {
      action: 'PSYCHOLOGIST_REJECT',
      targetType: 'Psychologist',
      targetId: psychologist._id,
      outcome: 'success'
    });
    await Psychologist.updateOne(
      { _id: psychologist._id },
      {
        $push: {
          onboardingHistory: {
            status: 'Rejected',
            at: new Date(),
            byUserId: req.user.id,
            reason,
            details: { fields, documents }
          }
        }
      }
    );

    try {
      await notifyUser({
        userId: psychologist.userId,
        title: 'Account rejected',
        message: `Your psychologist verification was rejected. Reason: ${reason}`,
        link: '/profile/edit',
        type: 'onboarding'
      });
    } catch (e) {
      // best-effort notification
    }
    res.status(200).json({ message: 'Psychologist rejected', psychologist });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};
