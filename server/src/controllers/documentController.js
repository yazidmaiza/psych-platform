const PatientDocument = require('../models/PatientDocument');
const axios = require('axios');
const fs = require('fs');
const pdfParse = require('pdf-parse');
const { ingestPatientDocument, retrieveDocumentContext } = require('../services/patientDocumentService');

const extractPDFText = async (filePath) => {
  try {
    const buffer = fs.readFileSync(filePath);
    const data = await pdfParse(buffer);
    if (data.text && data.text.trim().length > 50) {
      console.log('Text extracted, length:', data.text.length);
      return data.text;
    }
    return '';
  } catch (err) {
    console.log('PDF extraction failed:', err.message);
    return '';
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
      extractedText,
      textPreview: extractedText.slice(0, 500),
      textLength: extractedText.length
    });

    let embeddingStatus = 'pending';
    let chunkCount = 0;
    try {
      const ingestResult = await ingestPatientDocument({ document: doc, extractedText });
      embeddingStatus = ingestResult.embeddingStatus;
      chunkCount = ingestResult.chunkCount;
    } catch (err) {
      embeddingStatus = 'failed';
    }

    doc.embeddingStatus = embeddingStatus;
    doc.chunkCount = chunkCount;
    await doc.save();

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

    const { contextText, chunks } = await retrieveDocumentContext({
      documentId: doc._id,
      psychologistId: req.user.id,
      patientId: doc.patientId,
      question,
      topK: Number(req.body.topK || 5)
    });

    const response = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: 'llama-3.1-8b-instant',
        messages: [
          {
            role: 'system',
            content: 'You are a clinical assistant helping a psychologist analyze a patient document. Answer questions based strictly on the document excerpts provided. Be concise and professional. If the answer is not in the excerpts, say so clearly.'
          },
          {
            role: 'user',
            content: 'Document excerpts:\n' + (contextText || 'No relevant excerpts found.') + '\n\nQuestion: ' + question
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
    res.status(200).json({
      answer,
      sources: (chunks || []).map((chunk) => ({
        chunkIndex: chunk.chunkIndex,
        sourceName: chunk.sourceName || doc.originalName || 'Document',
        score: chunk.score || null
      }))
    });

  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};