const Psychologist = require('../models/Psychologist');
const User = require('../models/User');
const CredentialDocument = require('../models/CredentialDocument');
const { audit } = require('../services/auditService');
const axios = require('axios');
const fs = require('fs');
const pdfParse = require('pdf-parse');
const { resolvePrivatePath } = require('../services/credentialDocumentStorage');

const clampInt = (value, { min, max, fallback }) => {
  const n = Number.parseInt(String(value), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
};

const parseDate = (value) => {
  if (!value) return null;
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return null;
  return d;
};

const toBool = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const s = String(value).toLowerCase();
  if (s === 'true' || s === '1' || s === 'yes') return true;
  if (s === 'false' || s === '0' || s === 'no') return false;
  return null;
};

const allowedStatuses = new Set(['Draft', 'Submitted', 'Approved', 'Rejected']);
const allowedSort = new Set(['submittedAt', 'createdAt']);
const allowedOrder = new Set(['asc', 'desc']);

const buildCompleteness = (psy) => {
  const docs = psy?.credentialDocs || {};
  const checklist = {
    cv: Boolean(docs.cv),
    diploma: Boolean(docs.diploma),
    idFront: Boolean(docs.idFront),
    idBack: Boolean(docs.idBack),
    introVideo: Boolean(docs.introVideo)
  };
  const docsComplete = Object.values(checklist).every(Boolean);
  const profileComplete = Boolean(psy?.firstName && psy?.lastName && psy?.city);
  const completenessLevel = docsComplete && profileComplete ? 'complete' : docsComplete ? 'docs_only' : 'incomplete';
  return { checklist, docsComplete, profileComplete, completenessLevel };
};

const safePopulateCredentialDocSelect = 'type version isCurrent originalName mimeType sizeBytes createdAt';
const safePopulateUserSelect = 'email';

const formatBytes = (bytes) => {
  const n = Number(bytes || 0);
  if (!Number.isFinite(n) || n <= 0) return '';
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)}MB`;
  if (n >= 1024) return `${Math.round(n / 1024)}KB`;
  return `${n}B`;
};

const buildVerificationSummary = (psy) => {
  const stored = String(psy?.aiVerificationSummary || '').trim();
  if (stored) return stored;

  const docs = psy?.credentialDocs || {};
  const attached = ['cv', 'diploma', 'idFront', 'idBack', 'introVideo']
    .map((type) => {
      const doc = docs?.[type];
      if (!doc) return '';
      const name = doc.originalName ? ` (${doc.originalName})` : '';
      const size = doc.sizeBytes ? `, ${formatBytes(doc.sizeBytes)}` : '';
      return `${type}${name}${size}`;
    })
    .filter(Boolean);

  if (!attached.length) return '';
  return `AI summary unavailable. Uploaded credential documents are attached for administrator review: ${attached.join('; ')}.`;
};

const buildAiUnavailableSummary = (psy, reason) => {
  const fallback = buildVerificationSummary(psy);
  const detail = String(reason || '').trim();
  if (!fallback || !detail) return fallback;
  return `${fallback} AI generation status: ${detail}.`;
};

const truncateText = (value, maxChars) => {
  const text = String(value || '');
  if (!maxChars || text.length <= maxChars) return text;
  return text.slice(0, maxChars) + `\n\n[Truncated to ${maxChars} characters]`;
};

const extractTextFromPopulatedCredentialDoc = async (doc) => {
  if (!doc || String(doc.mimeType || '') !== 'application/pdf') return '';
  try {
    const storagePath = doc.storagePath || (doc._id
      ? (await CredentialDocument.findById(doc._id).select('storagePath').lean())?.storagePath
      : '');
    if (!storagePath) return '';
    const { absolute } = resolvePrivatePath(storagePath);
    if (!fs.existsSync(absolute)) return '';
    const buffer = fs.readFileSync(absolute);
    const data = await pdfParse(buffer);
    return data.text || '';
  } catch (err) {
    return '';
  }
};

const generateAiVerificationSummary = async (psy) => {
  if (!process.env.GROQ_API_KEY) {
    return { summary: '', reason: 'GROQ_API_KEY is not configured' };
  }

  const MAX_DOC_CHARS = 12000;
  const cvText = await extractTextFromPopulatedCredentialDoc(psy?.credentialDocs?.cv);
  const diplomaText = await extractTextFromPopulatedCredentialDoc(psy?.credentialDocs?.diploma);
  if (!String(cvText || diplomaText || '').trim()) {
    return { summary: '', reason: 'no extractable text found in CV or diploma PDFs' };
  }

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
            truncateText(cvText, MAX_DOC_CHARS) +
            '\n\nDIPLOMA:\n' +
            truncateText(diplomaText, MAX_DOC_CHARS) +
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

  const summary = String(response?.data?.choices?.[0]?.message?.content || '').trim();
  return { summary, reason: summary ? '' : 'AI provider returned an empty response' };
};

const ensureAiVerificationSummary = async (psy) => {
  if (String(psy?.aiVerificationSummary || '').trim()) return psy;

  try {
    const generated = await generateAiVerificationSummary(psy);
    if (!generated.summary) {
      return { ...psy, aiVerificationSummary: buildAiUnavailableSummary(psy, generated.reason) };
    }

    await Psychologist.updateOne(
      { _id: psy._id, aiVerificationSummary: { $in: ['', null] } },
      { $set: { aiVerificationSummary: generated.summary } }
    );
    return { ...psy, aiVerificationSummary: generated.summary };
  } catch (err) {
    return { ...psy, aiVerificationSummary: buildAiUnavailableSummary(psy, err?.message || 'AI generation failed') };
  }
};

// @GET /api/review-queue/applications
exports.listApplications = async (req, res) => {
  const page = clampInt(req.query.page, { min: 1, max: 100000, fallback: 1 });
  const limit = clampInt(req.query.limit, { min: 1, max: 50, fallback: 20 });
  const sortBy = allowedSort.has(String(req.query.sortBy)) ? String(req.query.sortBy) : 'submittedAt';
  const order = allowedOrder.has(String(req.query.order)) ? String(req.query.order) : 'desc';

  const status = req.query.status ? String(req.query.status) : '';
  if (status && !allowedStatuses.has(status)) {
    return res.status(400).json({ message: 'Invalid status filter' });
  }

  const rejected = toBool(req.query.rejected);
  if (req.query.rejected !== undefined && rejected === null) {
    return res.status(400).json({ message: 'Invalid rejected filter' });
  }

  const completeness = req.query.completeness ? String(req.query.completeness) : '';
  const allowedCompleteness = new Set(['complete', 'docs_only', 'incomplete']);
  if (completeness && !allowedCompleteness.has(completeness)) {
    return res.status(400).json({ message: 'Invalid completeness filter' });
  }

  // Risk filtering is not applicable to onboarding in this codebase (risk alerts are for sessions).
  if (req.query.riskLevel) {
    return res.status(400).json({ message: 'riskLevel filtering is not supported for onboarding review queue' });
  }

  const dateFrom = parseDate(req.query.dateFrom);
  const dateTo = parseDate(req.query.dateTo);
  if (req.query.dateFrom && !dateFrom) return res.status(400).json({ message: 'Invalid dateFrom' });
  if (req.query.dateTo && !dateTo) return res.status(400).json({ message: 'Invalid dateTo' });

  const search = String(req.query.search || '').trim();
  if (search.length > 200) return res.status(400).json({ message: 'Search is too long' });

  const baseFilter = {};
  if (status) baseFilter.profileStatus = status;
  if (rejected !== null) baseFilter.isRejected = rejected;

  // Date filter applies to submittedAt if present; fall back to createdAt.
  if (dateFrom || dateTo) {
    const range = {};
    if (dateFrom) range.$gte = dateFrom;
    if (dateTo) range.$lte = dateTo;
    baseFilter.$or = [{ submittedAt: range }, { submittedAt: null, createdAt: range }];
  }

  let userIdMatches = [];
  if (search) {
    // Email search
    if (search.includes('@') || search.length >= 3) {
      const userMatches = await User.find({ email: { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' } })
        .select('_id')
        .limit(200);
      userIdMatches = userMatches.map((u) => u._id);
    }

    const nameRegex = { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
    baseFilter.$and = (baseFilter.$and || []).concat([
      {
        $or: [
          { firstName: nameRegex },
          { lastName: nameRegex },
          { city: nameRegex },
          ...(userIdMatches.length ? [{ userId: { $in: userIdMatches } }] : [])
        ]
      }
    ]);
  }

  const skip = (page - 1) * limit;
  const sort = { [sortBy]: order === 'asc' ? 1 : -1, _id: -1 };

  // For completeness filter we need psychologist docs presence; apply post-filtering with a small overfetch.
  const overfetch = completeness ? Math.min(200, limit * 3) : limit;

  const [total, raw] = await Promise.all([
    Psychologist.countDocuments(baseFilter),
    Psychologist.find(baseFilter)
      .select('userId firstName lastName city profileStatus submittedAt lastResubmittedAt isApproved isRejected rejectionReason rejectedAt credentialDocs aiVerificationSummary createdAt')
      .populate('userId', safePopulateUserSelect)
      .populate('credentialDocs.cv', safePopulateCredentialDocSelect)
      .populate('credentialDocs.diploma', safePopulateCredentialDocSelect)
      .populate('credentialDocs.idFront', safePopulateCredentialDocSelect)
      .populate('credentialDocs.idBack', safePopulateCredentialDocSelect)
      .populate('credentialDocs.introVideo', safePopulateCredentialDocSelect)
      .sort(sort)
      .skip(skip)
      .limit(overfetch)
      .lean()
  ]);

  let items = raw.map((psy) => {
    const completenessInfo = buildCompleteness(psy);
    return {
      _id: psy._id,
      user: { _id: psy.userId?._id || psy.userId, email: psy.userId?.email || '' },
      firstName: psy.firstName || '',
      lastName: psy.lastName || '',
      city: psy.city || '',
      profileStatus: psy.profileStatus,
      submittedAt: psy.submittedAt || null,
      lastResubmittedAt: psy.lastResubmittedAt || null,
      createdAt: psy.createdAt || null,
      isApproved: Boolean(psy.isApproved),
      isRejected: Boolean(psy.isRejected),
      rejectionReason: psy.isRejected ? String(psy.rejectionReason || '') : '',
      rejectedAt: psy.rejectedAt || null,
      aiVerificationSummary: buildVerificationSummary(psy),
      credentialDocs: psy.credentialDocs || {},
      completeness: completenessInfo,
      riskLevel: null
    };
  });

  if (completeness) {
    items = items.filter((i) => i.completeness?.completenessLevel === completeness);
  }
  items = items.slice(0, limit);

  await audit(req, {
    action: 'REVIEW_QUEUE_LIST',
    targetType: 'Psychologist',
    targetId: '',
    outcome: 'success',
    metadata: {
      page,
      limit,
      sortBy,
      order,
      status: status || null,
      rejected,
      completeness: completeness || null,
      dateFrom: dateFrom ? dateFrom.toISOString() : null,
      dateTo: dateTo ? dateTo.toISOString() : null,
      search: search || null
    }
  });

  return res.status(200).json({
    page,
    limit,
    total,
    items
  });
};

// @GET /api/review-queue/applications/:id
exports.getApplication = async (req, res) => {
  try {
    const id = String(req.params.id || '');
    if (!id) return res.status(400).json({ message: 'Missing id' });

    const psy = await Psychologist.findById(id)
      .select('userId firstName lastName city profileStatus submittedAt lastResubmittedAt isApproved isRejected rejectionReason rejectedAt rejectionDetails onboardingHistory credentialDocs aiVerificationSummary createdAt updatedAt')
      .populate('userId', safePopulateUserSelect)
      .populate('credentialDocs.cv', safePopulateCredentialDocSelect)
      .populate('credentialDocs.diploma', safePopulateCredentialDocSelect)
      .populate('credentialDocs.idFront', safePopulateCredentialDocSelect)
      .populate('credentialDocs.idBack', safePopulateCredentialDocSelect)
      .populate('credentialDocs.introVideo', safePopulateCredentialDocSelect)
      .lean();

    if (!psy) return res.status(404).json({ message: 'Application not found' });

    const psyWithSummary = await ensureAiVerificationSummary(psy);
    const completenessInfo = buildCompleteness(psyWithSummary);

    await audit(req, {
      action: 'REVIEW_QUEUE_VIEW',
      targetType: 'Psychologist',
      targetId: psy._id,
      outcome: 'success'
    });

    return res.status(200).json({
      _id: psyWithSummary._id,
      user: { _id: psyWithSummary.userId?._id || psyWithSummary.userId, email: psyWithSummary.userId?.email || '' },
      firstName: psyWithSummary.firstName || '',
      lastName: psyWithSummary.lastName || '',
      city: psyWithSummary.city || '',
      profileStatus: psyWithSummary.profileStatus,
      submittedAt: psyWithSummary.submittedAt || null,
      lastResubmittedAt: psyWithSummary.lastResubmittedAt || null,
      createdAt: psyWithSummary.createdAt || null,
      updatedAt: psyWithSummary.updatedAt || null,
      isApproved: Boolean(psyWithSummary.isApproved),
      isRejected: Boolean(psyWithSummary.isRejected),
      rejectionReason: String(psyWithSummary.rejectionReason || ''),
      rejectedAt: psyWithSummary.rejectedAt || null,
      rejectionDetails: psyWithSummary.rejectionDetails || { fields: [], documents: [] },
      onboardingHistory: Array.isArray(psyWithSummary.onboardingHistory) ? psyWithSummary.onboardingHistory : [],
      aiVerificationSummary: buildVerificationSummary(psyWithSummary),
      credentialDocs: psyWithSummary.credentialDocs || {},
      completeness: completenessInfo,
      riskLevel: null
    });
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
};
