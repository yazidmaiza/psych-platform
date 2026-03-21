const express = require('express');
const router = express.Router();
const multer = require('multer');
const { uploadDocument, getDocuments, queryDocument } = require('../controllers/documentController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  }
});

router.post('/upload/:patientId', protect, restrictTo('psychologist'), upload.single('document'), uploadDocument);
router.get('/patient/:patientId', protect, restrictTo('psychologist'), getDocuments);
router.post('/query/:id', protect, restrictTo('psychologist'), queryDocument);

module.exports = router;