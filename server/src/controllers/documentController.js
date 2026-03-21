const PatientDocument = require('../models/PatientDocument');
const axios = require('axios');
const fs = require('fs');
const pdf = require('pdf-parse');
const pdfParse = require('pdf-parse');

const extractPDFText = async (filePath) => {
  try {
    const buffer = fs.readFileSync(filePath);
    const data = await pdfParse(buffer);
    if (data.text && data.text.trim().length > 50) {
      console.log('Text extracted, length:', data.text.length);
      return data.text;
    }
    return 'Document appears to be a scanned image. Text extraction not available.';
  } catch (err) {
    console.log('PDF extraction failed:', err.message);
    return 'Could not extract text from document';
  }
};
exports.uploadDocument = async (req, res) => {
  console.log('uploadDocument called');
  try {
    if (!req.file) return res.status(400).json({ message: 'No file provided' });
    const { patientId } = req.params;
    if (!patientId) return res.status(400).json({ message: 'Patient ID is required' });

    const extractedText = await extractPDFText(req.file.path);
    console.log('Final extracted text length:', extractedText.length);

    const doc = await PatientDocument.create({
      psychologistId: req.user.id,
      patientId,
      filename: req.file.filename,
      originalName: req.file.originalname,
      extractedText
    });

    fs.unlinkSync(req.file.path);

    res.status(201).json({ message: 'Document uploaded successfully', document: doc });

  } catch (err) {
    console.log('uploadDocument error:', err.message);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.getDocuments = async (req, res) => {
  try {
    const documents = await PatientDocument.find({
      psychologistId: req.user.id,
      patientId: req.params.patientId
    }).select('-extractedText').sort({ createdAt: -1 });
    res.status(200).json(documents);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.queryDocument = async (req, res) => {
  try {
    const { question } = req.body;
    if (!question) return res.status(400).json({ message: 'Question is required' });

    const doc = await PatientDocument.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Document not found' });

    if (doc.psychologistId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const response = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: 'llama-3.1-8b-instant',
        messages: [
          {
            role: 'system',
            content: 'You are a clinical assistant helping a psychologist analyze a patient document. Answer questions based strictly on the document content provided. Be concise and professional. If the answer is not in the document, say so clearly.'
          },
          {
            role: 'user',
            content: 'Document content:\n' + doc.extractedText + '\n\nQuestion: ' + question
          }
        ],
        temperature: 0.3,
        max_tokens: 500
      },
      {
        headers: {
          Authorization: 'Bearer ' + process.env.GROQ_API_KEY,
          'Content-Type': 'application/json'
        }
      }
    );

    const answer = response.data.choices[0].message.content;
    res.status(200).json({ answer });

  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};