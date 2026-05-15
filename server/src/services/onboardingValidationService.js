const CredentialDocument = require('../models/CredentialDocument');

const REQUIRED_PROFILE_FIELDS = ['firstName', 'lastName', 'city'];
const REQUIRED_DOC_TYPES = ['cv', 'diploma', 'idFront', 'idBack', 'introVideo'];

const validateProfileCompleteness = (psychologist) => {
  const missingFields = [];
  for (const field of REQUIRED_PROFILE_FIELDS) {
    const value = psychologist?.[field];
    if (!value || String(value).trim().length === 0) missingFields.push(field);
  }
  return { ok: missingFields.length === 0, missingFields };
};

const validateDocumentsCompleteness = async ({ ownerUserId }) => {
  // Backwards compatible: older rows may not have `isCurrent` set at all.
  // Treat missing `isCurrent` as current, and only consider the latest per type.
  const docs = await CredentialDocument.find({
    ownerUserId,
    $or: [{ isCurrent: true }, { isCurrent: { $exists: false } }]
  }).select('type version createdAt').sort({ type: 1, version: -1, createdAt: -1 });

  const existing = new Set();
  const seenTypes = new Set();
  for (const doc of docs || []) {
    const type = String(doc?.type || '');
    if (!type || seenTypes.has(type)) continue;
    seenTypes.add(type);
    existing.add(type);
  }
  const missingDocuments = REQUIRED_DOC_TYPES.filter((t) => !existing.has(t));
  return { ok: missingDocuments.length === 0, missingDocuments };
};

module.exports = {
  REQUIRED_PROFILE_FIELDS,
  REQUIRED_DOC_TYPES,
  validateProfileCompleteness,
  validateDocumentsCompleteness
};
