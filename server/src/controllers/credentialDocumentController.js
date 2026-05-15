const crypto = require('crypto');
const fs = require('fs');
const multer = require('multer');

const CredentialDocument = require('../models/CredentialDocument');
const CredentialDocumentAccessGrant = require('../models/CredentialDocumentAccessGrant');
const Psychologist = require('../models/Psychologist');
const { audit } = require('../services/auditService');
const {
  buildStorageRelativePath,
  persistUploadedTempFile,
  resolvePrivatePath,
  sha256File
} = require('../services/credentialDocumentStorage');

const MAX_ID_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_PDF_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_INTRO_VIDEO_SIZE_BYTES = 100 * 1024 * 1024;

const TYPE_CONSTRAINTS = {
  cv: { maxBytes: MAX_PDF_SIZE_BYTES, mime: new Set(['application/pdf']) },
  diploma: { maxBytes: MAX_PDF_SIZE_BYTES, mime: new Set(['application/pdf']) },
  idFront: { maxBytes: MAX_ID_IMAGE_SIZE_BYTES, mime: new Set(['image/jpeg', 'image/png']) },
  idBack: { maxBytes: MAX_ID_IMAGE_SIZE_BYTES, mime: new Set(['image/jpeg', 'image/png']) },
  introVideo: { maxBytes: MAX_INTRO_VIDEO_SIZE_BYTES, mime: new Set(['video/mp4', 'video/webm', 'video/quicktime']) }
};

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

const safeUnlink = (filePath) => {
  try {
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (err) {}
};

const getNextVersion = async ({ ownerUserId, type }) => {
  const latest = await CredentialDocument.findOne({ ownerUserId, type }).sort({ version: -1 }).select('version');
  return (latest?.version || 0) + 1;
};

const ensureJpegAtPath = async (file) => {
  if (!file?.path || !file?.mimetype) return;
  if (file.mimetype !== 'image/png') return;

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
};

const ensureUploadAllowed = async ({ ownerUserId }) => {
  const psychologist = await Psychologist.findOne({ userId: ownerUserId }).select('profileStatus isApproved isRejected rejectionDetails');
  if (!psychologist) {
    const err = new Error('Psychologist profile not found');
    err.status = 404;
    throw err;
  }
  const status = String(psychologist.profileStatus || 'Draft');
  if (status !== 'Draft' && status !== 'Rejected') {
    const err = new Error('Credential uploads are only allowed while profile status is Draft or Rejected');
    err.status = 409;
    throw err;
  }
  if (psychologist.isApproved) {
    const err = new Error('Profile is already approved');
    err.status = 409;
    throw err;
  }

  // If rejected and admin specified limited document slots, enforce that.
  if (status === 'Rejected' && Array.isArray(psychologist.rejectionDetails?.documents) && psychologist.rejectionDetails.documents.length > 0) {
    // Enforced at call site by checking req.body.type; this is just context.
  }
  return psychologist;
};

// Used by routes to handle a single credential document upload (per type).
exports.credentialUploadMiddleware = multer({
  dest: 'uploads/', // temp; moved into private storage after validation
  limits: { fileSize: MAX_INTRO_VIDEO_SIZE_BYTES },
  fileFilter: (req, file, cb) => {
    const type = String(req.body?.type || '');
    const constraints = TYPE_CONSTRAINTS[type];
    if (!constraints) return cb(new Error('Invalid document type'));
    if (!constraints.mime.has(file.mimetype)) return cb(new Error('Unsupported file type'));
    cb(null, true);
  }
}).single('file');

// @POST /api/credential-documents/upload
exports.uploadCredentialDocument = async (req, res) => {
  try {
    const ownerUserId = req.user.id;
    const type = String(req.body?.type || '');
    const constraints = TYPE_CONSTRAINTS[type];
    if (!constraints) return res.status(400).json({ message: 'Invalid document type' });

    if (!req.file) return res.status(400).json({ message: 'No file provided' });

    if (req.file.size > constraints.maxBytes) {
      safeUnlink(req.file.path);
      return res.status(400).json({
        message: `Invalid file size. Max allowed is ${Math.floor(constraints.maxBytes / (1024 * 1024))}MB.`
      });
    }

    const psychologist = await ensureUploadAllowed({ ownerUserId });

    if (String(psychologist.profileStatus || 'Draft') === 'Rejected' && Array.isArray(psychologist.rejectionDetails?.documents) && psychologist.rejectionDetails.documents.length > 0) {
      const allowedDocs = new Set(psychologist.rejectionDetails.documents);
      if (!allowedDocs.has(type)) {
        safeUnlink(req.file.path);
        return res.status(409).json({
          message: 'Only the requested document slots can be updated before resubmission.',
          allowedDocuments: Array.from(allowedDocs)
        });
      }
    }

    if (type === 'idFront' || type === 'idBack') {
      await ensureJpegAtPath(req.file);
    }

    const version = await getNextVersion({ ownerUserId, type });
    const storagePath = buildStorageRelativePath({
      ownerUserId,
      type,
      version,
      originalName: req.file.originalname
    });
    const absolutePath = persistUploadedTempFile({ tempFilePath: req.file.path, storagePath });
    const checksumSha256 = sha256File(absolutePath);

    const previousCurrent = await CredentialDocument.findOne({ ownerUserId, type, isCurrent: true }).select('_id');
    if (previousCurrent?._id) {
      await CredentialDocument.updateOne({ _id: previousCurrent._id }, { isCurrent: false });
    }

    const doc = await CredentialDocument.create({
      ownerUserId,
      psychologistId: psychologist._id,
      type,
      version,
      isCurrent: true,
      replacedBy: null,
      storagePath,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      sizeBytes: req.file.size,
      checksumSha256,
      uploadedByUserId: ownerUserId
    });

    if (previousCurrent?._id) {
      await CredentialDocument.updateOne({ _id: previousCurrent._id }, { replacedBy: doc._id });
    }

    await Psychologist.updateOne(
      { _id: psychologist._id },
      { $set: { [`credentialDocs.${type}`]: doc._id } }
    );

    await audit(req, {
      action: previousCurrent?._id ? 'CREDENTIAL_DOC_REPLACE' : 'CREDENTIAL_DOC_UPLOAD',
      targetType: 'CredentialDocument',
      targetId: doc._id,
      outcome: 'success',
      metadata: { type, version, sizeBytes: req.file.size, mimeType: req.file.mimetype }
    });

    return res.status(201).json({
      message: previousCurrent?._id ? 'Document replaced successfully' : 'Document uploaded successfully',
      document: doc
    });
  } catch (err) {
    if (req?.file?.path) safeUnlink(req.file.path);
    await audit(req, {
      action: 'CREDENTIAL_DOC_UPLOAD',
      targetType: 'CredentialDocument',
      targetId: '',
      outcome: 'failure',
      message: err.message
    });
    return res.status(err.status || 500).json({ message: err.message || 'Server error' });
  }
};

const canAccessDocument = async ({ requester, credentialDocumentId }) => {
  const doc = await CredentialDocument.findById(credentialDocumentId);
  if (!doc) {
    const err = new Error('Document not found');
    err.status = 404;
    throw err;
  }

  if (requester.role === 'admin') return doc;

  if (requester.role === 'psychologist') {
    if (String(doc.ownerUserId) !== String(requester.id)) {
      const err = new Error('Access denied');
      err.status = 403;
      throw err;
    }
    return doc;
  }

  const err = new Error('Access denied');
  err.status = 403;
  throw err;
};

// @GET /api/credential-documents/:id/access-url
exports.getAccessUrl = async (req, res) => {
  const credentialDocumentId = req.params.id;
  try {
    const doc = await canAccessDocument({ requester: req.user, credentialDocumentId });

    const ttlSeconds = Math.max(60, Math.min(600, Number(req.query.ttlSeconds || 300)));
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

    await CredentialDocumentAccessGrant.create({
      tokenHash: hashToken(token),
      credentialDocumentId: doc._id,
      requestedByUserId: req.user.id,
      requestedByRole: req.user.role,
      expiresAt,
      requestIp: String(req.ip || ''),
      requestUserAgent: String(req.headers['user-agent'] || '')
    });

    await audit(req, {
      action: 'CREDENTIAL_DOC_ACCESS_URL_ISSUED',
      targetType: 'CredentialDocument',
      targetId: doc._id,
      outcome: 'success',
      metadata: { ttlSeconds }
    });

    return res.status(200).json({
      url: `/api/credential-documents/download?token=${token}`,
      expiresAt: expiresAt.toISOString()
    });
  } catch (err) {
    await audit(req, {
      action: 'CREDENTIAL_DOC_ACCESS_URL_DENIED',
      targetType: 'CredentialDocument',
      targetId: credentialDocumentId,
      outcome: 'failure',
      message: err.message
    });
    return res.status(err.status || 500).json({ message: err.message || 'Server error' });
  }
};

// @GET /api/credential-documents/download?token=...
exports.downloadByToken = async (req, res) => {
  const token = String(req.query.token || '');
  if (!token || token.length < 20) {
    return res.status(400).json({ message: 'Invalid token' });
  }
  try {
    const tokenHash = hashToken(token);
    const grant = await CredentialDocumentAccessGrant.findOne({ tokenHash });
    if (!grant) {
      await audit(req, {
        action: 'CREDENTIAL_DOC_DOWNLOAD',
        outcome: 'failure',
        message: 'Invalid token'
      });
      return res.status(403).json({ message: 'Invalid token' });
    }

    if (grant.expiresAt.getTime() < Date.now()) {
      await audit(req, {
        action: 'CREDENTIAL_DOC_DOWNLOAD',
        targetType: 'CredentialDocument',
        targetId: grant.credentialDocumentId,
        outcome: 'failure',
        message: 'Token expired'
      });
      return res.status(403).json({ message: 'Token expired' });
    }

    const doc = await CredentialDocument.findById(grant.credentialDocumentId);
    if (!doc) {
      await audit(req, {
        action: 'CREDENTIAL_DOC_DOWNLOAD',
        targetType: 'CredentialDocument',
        targetId: grant.credentialDocumentId,
        outcome: 'failure',
        message: 'Document not found'
      });
      return res.status(404).json({ message: 'Document not found' });
    }

    const { absolute } = resolvePrivatePath(doc.storagePath);
    if (!fs.existsSync(absolute)) {
      await audit(req, {
        action: 'CREDENTIAL_DOC_DOWNLOAD',
        targetType: 'CredentialDocument',
        targetId: doc._id,
        outcome: 'failure',
        message: 'File missing from storage'
      });
      return res.status(404).json({ message: 'File not found' });
    }

    // Integrity check (best-effort); avoid blocking download on checksum mismatch in case of legacy files.
    try {
      const actual = sha256File(absolute);
      if (actual !== doc.checksumSha256) {
        await audit(req, {
          action: 'CREDENTIAL_DOC_CHECKSUM_MISMATCH',
          targetType: 'CredentialDocument',
          targetId: doc._id,
          outcome: 'failure',
          message: 'Checksum mismatch',
          metadata: { expected: doc.checksumSha256, actual }
        });
      }
    } catch (err) {}

    await CredentialDocumentAccessGrant.updateOne({ _id: grant._id }, { usedAt: new Date() });
    await audit(req, {
      action: 'CREDENTIAL_DOC_DOWNLOAD',
      targetType: 'CredentialDocument',
      targetId: doc._id,
      outcome: 'success',
      metadata: { requestedByRole: grant.requestedByRole }
    });

    res.setHeader('Content-Type', doc.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(doc.originalName || 'document')}"`);
    return res.sendFile(absolute);
  } catch (err) {
    await audit(req, {
      action: 'CREDENTIAL_DOC_DOWNLOAD',
      outcome: 'failure',
      message: err.message
    });
    return res.status(500).json({ message: 'Server error' });
  }
};

// @GET /api/credential-documents/my
exports.getMyCurrentDocuments = async (req, res) => {
  try {
    // Backwards compatible: older rows may not have `isCurrent` set at all.
    // Treat missing `isCurrent` as current, and return the latest per type.
    const docs = await CredentialDocument.find({
      ownerUserId: req.user.id,
      $or: [{ isCurrent: true }, { isCurrent: { $exists: false } }]
    }).sort({ type: 1, version: -1, createdAt: -1 });

    const latestByType = [];
    const seenTypes = new Set();
    for (const doc of docs) {
      const type = String(doc.type || '');
      if (!type || seenTypes.has(type)) continue;
      seenTypes.add(type);
      latestByType.push(doc);
    }

    return res.status(200).json(latestByType);
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
};

// @GET /api/credential-documents/checklist
exports.getMyChecklist = async (req, res) => {
  try {
    const psychologist = await Psychologist.findOne({ userId: req.user.id }).select('profileStatus credentialDocs');
    if (!psychologist) return res.status(404).json({ message: 'Psychologist not found' });

    const checklist = {
      cv: Boolean(psychologist.credentialDocs?.cv),
      diploma: Boolean(psychologist.credentialDocs?.diploma),
      idFront: Boolean(psychologist.credentialDocs?.idFront),
      idBack: Boolean(psychologist.credentialDocs?.idBack),
      introVideo: Boolean(psychologist.credentialDocs?.introVideo)
    };
    const allComplete = Object.values(checklist).every(Boolean);

    return res.status(200).json({
      profileStatus: psychologist.profileStatus,
      checklist,
      allComplete
    });
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
};
