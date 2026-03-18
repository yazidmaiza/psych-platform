const Psychologist = require('../models/Psychologist');
const axios = require('axios');
const fs = require('fs');
const pdfParse = require('pdf-parse');

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

// Helper: analyze documents with Groq
const analyzeWithGroq = async (cvText, diplomaText) => {
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
          content: 'CV:\n' + cvText + '\n\nDIPLOMA:\n' + diplomaText + '\n\nPlease provide: 1) A summary of qualifications 2) Years of experience 3) Specializations mentioned 4) Whether the diploma appears legitimate 5) Overall recommendation (Approve/Review/Reject) with reason.'
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
    if (!req.files || !req.files.cv || !req.files.diploma) {
      return res.status(400).json({ message: 'Both CV and diploma are required' });
    }

    const cvPath = req.files.cv[0].path;
    const diplomaPath = req.files.diploma[0].path;

    // Extract text from PDFs
    console.log('extracting CV text...');
    const cvText = await extractPDFText(cvPath);
    console.log('CV text length:', cvText.length);
    console.log('extracting diploma text...');
    const diplomaText = await extractPDFText(diplomaPath);
    console.log('diploma text length:', diplomaText.length);

    // Analyze with Groq
    console.log('analyzing with Groq...');
    const aiSummary = await analyzeWithGroq(cvText, diplomaText);

    // Update psychologist profile
    const psychologist = await Psychologist.findOneAndUpdate(
      { userId: req.user.id },
      {
        cvUrl: req.files.cv[0].filename,
        diplomaUrl: req.files.diploma[0].filename,
        aiVerificationSummary: aiSummary,
        isApproved: false
      },
      { returnDocument: 'after' }
    );

    if (!psychologist) {
      return res.status(404).json({ message: 'Psychologist profile not found. Please complete your profile first.' });
    }

    res.status(200).json({ message: 'Documents uploaded and analyzed. Awaiting admin approval.', aiSummary });

  } catch (err) {
    console.log('uploadDocuments error:', err.message);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// @GET /api/verification/pending
exports.getPendingVerifications = async (req, res) => {
  try {
    const pending = await Psychologist.find({ isApproved: false, isRejected: { $ne: true } })
      .populate('userId', 'email')
      .sort({ createdAt: -1 });
    res.status(200).json(pending);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// @PUT /api/verification/:id/approve
exports.approvePsychologist = async (req, res) => {
  try {
    const psychologist = await Psychologist.findByIdAndUpdate(
      req.params.id,
      { isApproved: true },
      { returnDocument: 'after' }
    );
    if (!psychologist) return res.status(404).json({ message: 'Psychologist not found' });
    res.status(200).json({ message: 'Psychologist approved', psychologist });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// @PUT /api/verification/:id/reject
exports.rejectPsychologist = async (req, res) => {
  try {
    const psychologist = await Psychologist.findByIdAndUpdate(
      req.params.id,
      { isApproved: false, isRejected: true },
      { returnDocument: 'after' }
    );
    if (!psychologist) return res.status(404).json({ message: 'Psychologist not found' });
    res.status(200).json({ message: 'Psychologist rejected', psychologist });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};
