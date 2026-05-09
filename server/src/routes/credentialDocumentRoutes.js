const express = require('express');
const router = express.Router();

const {
  credentialUploadMiddleware,
  uploadCredentialDocument,
  getAccessUrl,
  downloadByToken,
  getMyCurrentDocuments,
  getMyChecklist
} = require('../controllers/credentialDocumentController');

const { protect, restrictTo } = require('../middleware/authMiddleware');

// Psychologist uploads (per-document / per-type)
router.post('/upload', protect, restrictTo('psychologist'), credentialUploadMiddleware, uploadCredentialDocument);

// Scoped access (signed token) URL generation
router.get('/:id/access-url', protect, restrictTo('psychologist', 'admin'), getAccessUrl);

// Short-lived download link (no auth; possession of token is authorization)
router.get('/download', downloadByToken);

// Convenience: psychologist list own documents
router.get('/my', protect, restrictTo('psychologist'), getMyCurrentDocuments);
router.get('/checklist', protect, restrictTo('psychologist'), getMyChecklist);

module.exports = router;
