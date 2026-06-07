const Psychologist = require('../models/Psychologist');
const User = require('../models/User');
const CredentialDocument = require('../models/CredentialDocument');
const axios = require('axios');
const fs = require('fs');
const pdfParse = require('pdf-parse');
const { audit } = require('../services/auditService');
const { notifyUser } = require('../services/notificationService');
const {
  validateProfileCompleteness,
  validateDocumentsCompleteness
} = require('../services/onboardingValidationService');
const { resolvePrivatePath } = require('../services/credentialDocumentStorage');

const truncateText = (value, maxChars) => {
  const text = String(value || '');
  if (!maxChars || text.length <= maxChars) return text;
  return text.slice(0, maxChars) + `\n\n[Truncated to ${maxChars} characters]`;
};

const buildUnavailableSummary = (reason = '') => {
  const suffix = reason ? ` ${reason}` : '';
  return `AI summary unavailable:${suffix} Uploaded CV and diploma documents are attached for administrator review.`;
};

const extractPDFTextFromCredentialDoc = async (credentialDocId) => {
  if (!credentialDocId) return '';
  const doc = await CredentialDocument.findById(credentialDocId).select('storagePath mimeType');
  if (!doc) return '';
  if (String(doc.mimeType || '') !== 'application/pdf') return '';
  try {
    const { absolute } = resolvePrivatePath(doc.storagePath);
    if (!fs.existsSync(absolute)) return '';
    const buffer = fs.readFileSync(absolute);
    const data = await pdfParse(buffer);
    return data.text || '';
  } catch (err) {
    return '';
  }
};

const analyzeWithGroq = async (cvText, diplomaText) => {
  if (!process.env.GROQ_API_KEY) {
    return 'AI summary unavailable: GROQ_API_KEY is not configured on the server.';
  }

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
          content:
            'CV:\n' +
            safeCvText +
            '\n\nDIPLOMA:\n' +
            safeDiplomaText +
            '\n\nPlease provide: 1) A summary of qualifications 2) Years of experience 3) Specializations mentioned 4) Whether the diploma appears legitimate 5) Overall recommendation (Approve/Review/Reject) with reason.'
        }
      ],
      temperature: 0.3,
      max_tokens: 800
    },
    {
      headers: {
        Authorization: 'Bearer ' + process.env.GROQ_API_KEY,
        'Content-Type': 'application/json'
      },
      timeout: 45_000
    }
  );

  return response?.data?.choices?.[0]?.message?.content || '';
};

const notifyAdmins = async ({ title, message, link = '', type = 'onboarding' }) => {
  const admins = await User.find({ role: 'admin' }).select('_id');
  await Promise.all((admins || []).map((a) => notifyUser({ userId: a._id, title, message, link, type })));
};

const transition = async ({ psychologistId, newStatus, byUserId, reason = '', details = {} }) => {
  await Psychologist.updateOne(
    { _id: psychologistId },
    {
      $push: {
        onboardingHistory: {
          status: newStatus,
          at: new Date(),
          byUserId: byUserId || null,
          reason: String(reason || ''),
          details: details || {}
        }
      }
    }
  );
};

// @GET /api/onboarding/me
exports.getMyOnboarding = async (req, res) => {
  try {
    const psychologist = await Psychologist.findOne({ userId: req.user.id })
      .select('profileStatus submittedAt lastResubmittedAt rejectionReason rejectedAt rejectionDetails onboardingHistory isApproved isRejected');
    if (!psychologist) return res.status(404).json({ message: 'Psychologist not found' });

    return res.status(200).json(psychologist);
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
};

// @POST /api/onboarding/submit
exports.submitOnboarding = async (req, res) => {
  try {
    const psychologist = await Psychologist.findOne({ userId: req.user.id }).select('_id userId profileStatus submittedAt lastResubmittedAt isApproved isRejected credentialDocs firstName lastName city rejectionReason rejectedAt rejectionDetails onboardingHistory');
    if (!psychologist) return res.status(404).json({ message: 'Psychologist not found' });

    const currentStatus = String(psychologist.profileStatus || 'Draft');
    if (currentStatus === 'Submitted') {
      return res.status(409).json({ message: 'Application already submitted' });
    }
    if (currentStatus === 'Approved') {
      return res.status(409).json({ message: 'Application already approved' });
    }

    // Rejected can resubmit; Draft can submit.
    const profileValidation = validateProfileCompleteness(psychologist);
    const docValidation = await validateDocumentsCompleteness({ ownerUserId: req.user.id });

    if (!profileValidation.ok || !docValidation.ok) {
      await audit(req, {
        action: currentStatus === 'Rejected' ? 'ONBOARDING_RESUBMIT' : 'ONBOARDING_SUBMIT',
        targetType: 'Psychologist',
        targetId: psychologist._id,
        outcome: 'failure',
        message: 'Incomplete application',
        metadata: { missingFields: profileValidation.missingFields, missingDocuments: docValidation.missingDocuments }
      });
      return res.status(400).json({
        message: 'Application is incomplete',
        missingFields: profileValidation.missingFields,
        missingDocuments: docValidation.missingDocuments
      });
    }

    const now = new Date();
    const isResubmission = currentStatus === 'Rejected';

    // Build AI summary from stored credential docs (CV + diploma). Never block submission on AI failures.
    let aiSummary = '';
    try {
      const cvText = await extractPDFTextFromCredentialDoc(psychologist.credentialDocs?.cv);
      const diplomaText = await extractPDFTextFromCredentialDoc(psychologist.credentialDocs?.diploma);
      aiSummary = await analyzeWithGroq(cvText, diplomaText);
    } catch (e) {
      aiSummary = `AI summary unavailable: ${e?.message || 'unknown error'}`;
    }
    if (!String(aiSummary || '').trim()) {
      aiSummary = buildUnavailableSummary('The AI provider returned an empty response.');
    }

    await Psychologist.updateOne(
      { _id: psychologist._id },
      {
        $set: {
          profileStatus: 'Submitted',
          submittedAt: psychologist.submittedAt || now,
          lastResubmittedAt: isResubmission ? now : psychologist.lastResubmittedAt,
          isRejected: false,
          rejectionReason: '',
          rejectedAt: null,
          rejectedByUserId: null,
          rejectionDetails: { fields: [], documents: [] },
          aiVerificationSummary: String(aiSummary || '')
        }
      }
    );

    await transition({
      psychologistId: psychologist._id,
      newStatus: 'Submitted',
      byUserId: req.user.id,
      reason: isResubmission ? 'Resubmitted after rejection' : 'Submitted for review'
    });

    await audit(req, {
      action: isResubmission ? 'ONBOARDING_RESUBMIT' : 'ONBOARDING_SUBMIT',
      targetType: 'Psychologist',
      targetId: psychologist._id,
      outcome: 'success'
    });

    await notifyAdmins({
      title: isResubmission ? 'Onboarding resubmitted' : 'New onboarding submission',
      message: `Psychologist onboarding application ${isResubmission ? 'resubmitted' : 'submitted'} and ready for review.`,
      link: '/admin',
      type: 'onboarding_submission'
    });

    return res.status(200).json({ message: 'Application submitted', status: 'Submitted' });
  } catch (err) {
    await audit(req, {
      action: 'ONBOARDING_SUBMIT',
      outcome: 'failure',
      message: err.message
    });
    return res.status(500).json({ message: 'Server error' });
  }
};
