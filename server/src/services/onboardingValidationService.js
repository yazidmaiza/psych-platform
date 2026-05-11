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
  const current = await CredentialDocument.find({ ownerUserId, isCurrent: true }).select('type');
  const existing = new Set((current || []).map((d) => d.type));
  const missingDocuments = REQUIRED_DOC_TYPES.filter((t) => !existing.has(t));
  return { ok: missingDocuments.length === 0, missingDocuments };
};

module.exports = {
  REQUIRED_PROFILE_FIELDS,
  REQUIRED_DOC_TYPES,
  validateProfileCompleteness,
  validateDocumentsCompleteness
};

