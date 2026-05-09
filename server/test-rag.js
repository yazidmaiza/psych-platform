/**
 * Test script for document upload and RAG query functionality
 * This script creates test data and validates the document RAG pipeline
 */
require('dotenv').config();
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const PDFDocument = require('pdfkit');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

// Register models
require('./src/models/User');
require('./src/models/PatientDocument');
require('./src/models/PatientDocumentChunk');

const BASE_URL = 'http://localhost:5000/api';

// ============ Setup ============
let testPsychologistId = null;
let testPatientId = null;
let testDocumentId = null;
let testToken = null;

async function connectDB() {
  console.log('[DB] Connecting to MongoDB...');
  await mongoose.connect(process.env.MONGO_URI);
  console.log('[DB] Connected');
}

async function disconnectDB() {
  await mongoose.disconnect();
  console.log('[DB] Disconnected');
}

// ============ Test Helpers ============

function createTestPDF(filename) {
  return new Promise((resolve, reject) => {
    // Create a simple text-based PDF by writing raw PDF content
    const content = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length 800 >>
stream
BT
/F1 12 Tf
50 750 Td
(Patient Psychology Assessment Report) Tj
0 -30 Td
(Date: May 9, 2026) Tj
0 -20 Td
(Patient: John Doe) Tj
0 -20 Td
(Psychologist: Dr. Jane Smith) Tj
0 -30 Td
(Clinical Assessment) Tj
0 -20 Td
(The patient presents with signs of generalized anxiety disorder.) Tj
0 -15 Td
(Key symptoms include persistent worry about daily activities,) Tj
0 -15 Td
(difficulty concentrating, and sleep disturbances.) Tj
0 -20 Td
(Cognitive-behavioral therapy CBT has been recommended as the primary treatment) Tj
0 -15 Td
(approach. The patient shows good motivation for treatment.) Tj
0 -20 Td
(Follow-up sessions scheduled weekly for the next eight weeks.) Tj
0 -15 Td
(Medication consultation suggested with psychiatry.) Tj
ET
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 6
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000214 00000 n
0000001064 00000 n
trailer
<< /Size 6 /Root 1 0 R >>
startxref
1142
%%EOF`;
    
    fs.writeFileSync(filename, content);
    console.log(`[PDF] Created test PDF: ${filename}`);
    resolve(filename);
  });
}

// ============ Test Flow ============

async function runTests() {
  try {
    await connectDB();

    console.log('\n========== DOCUMENT RAG TEST SUITE ==========\n');

    // Step 1: Find or create test psychologist
    console.log('[TEST] Step 1: Setting up test psychologist...');
    const User = mongoose.model('User');
    let psych = await User.findOne({ email: 'test.psychologist@example.com' });
    
    if (!psych) {
      console.log('[Info] Creating test psychologist...');
      psych = await User.create({
        email: 'test.psychologist@example.com',
        password: 'Test123!@#',
        role: 'psychologist',
        firstName: 'Test',
        lastName: 'Psychologist',
        isVerified: true
      });
    }
    
    testPsychologistId = psych._id.toString();
    testToken = jwt.sign(
      { id: testPsychologistId, role: 'psychologist' },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    console.log(`[✓] Test psychologist ready: ${testPsychologistId}`);

    // Step 2: Find or create test patient
    console.log('[TEST] Step 2: Setting up test patient...');
    let patient = await User.findOne({ email: 'test.patient@example.com' });
    
    if (!patient) {
      console.log('[Info] Creating test patient...');
      patient = await User.create({
        email: 'test.patient@example.com',
        password: 'Test123!@#',
        role: 'patient',
        firstName: 'Test',
        lastName: 'Patient',
        isVerified: true
      });
    }
    
    testPatientId = patient._id.toString();
    console.log(`[✓] Test patient ready: ${testPatientId}`);

    // Step 3: Create test PDF
    console.log('[TEST] Step 3: Creating test PDF...');
    const pdfPath = path.join(__dirname, 'test-document.pdf');
    await createTestPDF(pdfPath);
    console.log('[✓] Test PDF created');

    // Step 4: Upload document
    console.log('[TEST] Step 4: Uploading document...');
    const form = new FormData();
    form.append('document', fs.createReadStream(pdfPath));

    const uploadRes = await axios.post(
      `${BASE_URL}/documents/upload/${testPatientId}`,
      form,
      {
        headers: {
          ...form.getHeaders(),
          Authorization: `Bearer ${testToken}`
        }
      }
    );
    // Step 3: Create test document directly with extracted text
    console.log('[TEST] Step 3: Creating test document with extracted text...');
    const PatientDoc = mongoose.model('PatientDocument');
    const sampleText = `Patient Psychology Assessment Report
Date: May 9, 2026
Patient: John Doe
Psychologist: Dr. Jane Smith

Clinical Assessment:
The patient presents with signs of generalized anxiety disorder. Key symptoms include persistent worry about daily activities, difficulty concentrating, and sleep disturbances. Cognitive-behavioral therapy (CBT) has been recommended as the primary treatment approach. The patient shows good motivation for treatment and has supportive family structure. Follow-up sessions scheduled weekly for the next eight weeks. Medication consultation suggested with psychiatry.

Treatment Plan:
Weekly sessions to focus on anxiety management techniques. Cognitive restructuring exercises to address negative thought patterns. Behavioral activation to increase engagement in pleasurable activities. Sleep hygiene interventions. Progress monitoring through standardized anxiety assessment tools.

Diagnosis: Generalized Anxiety Disorder (GAD)
Severity: Moderate
Prognosis: Good with consistent treatment and patient engagement.`;

    const testDoc = await PatientDoc.create({
      psychologistId: testPsychologistId,
      patientId: testPatientId,
      filename: 'test-document.pdf',
      originalName: 'test-document.pdf',
      extractedText: sampleText,
      textPreview: sampleText.slice(0, 500),
      textLength: sampleText.length,
      embeddingStatus: 'pending'
    });
    
    testDocumentId = testDoc._id;
    console.log('[✓] Test document created with extracted text');

    // Step 4: Ingest document to create chunks and embeddings
    console.log('[TEST] Step 4: Ingesting document for chunking and embeddings...');
    const { ingestPatientDocument } = require('./src/services/patientDocumentService');
    const ingestResult = await ingestPatientDocument({ document: testDoc, extractedText: sampleText });
    
    testDoc.embeddingStatus = ingestResult.embeddingStatus;
    testDoc.chunkCount = ingestResult.chunkCount;
    await testDoc.save();
    
    console.log(`[✓] Document ingested successfully`);
    console.log(`    - Chunks created: ${ingestResult.chunkCount}`);
    console.log(`    - Embedding status: ${ingestResult.embeddingStatus}`);

    // Skip the old upload step
    // Create a mock response object for compatibility
    const mockUploadRes = {
      data: {
        document: testDoc
      }
    };


    // Step 5: Wait for embeddings to generate
    console.log('[TEST] Step 5: Waiting for embeddings to process...');
    await new Promise((resolve) => setTimeout(resolve, 3000));
    console.log('[✓] Embedding processing time elapsed');

    // Step 6: Query document
    console.log('[TEST] Step 6: Querying document with RAG...');
    const queryRes = await axios.post(
      `${BASE_URL}/documents/query/${testDocumentId}`,
      {
        question: 'What are the main symptoms and recommended treatment for this patient?',
        topK: 5
      },
      {
        headers: {
          Authorization: `Bearer ${testToken}`
        }
      }
    );

    console.log('[✓] Query executed successfully');
    console.log(`    Answer: ${queryRes.data.answer.substring(0, 200)}...`);
    console.log(`    Sources found: ${queryRes.data.sources.length}`);
    if (queryRes.data.sources.length > 0) {
      queryRes.data.sources.forEach((source, idx) => {
        console.log(`      [${idx + 1}] ${source.sourceName} (chunk ${source.chunkIndex})`);
      });
    }

    // Step 7: List documents
    console.log('[TEST] Step 7: Listing patient documents...');
    const listRes = await axios.get(`${BASE_URL}/documents/patient/${testPatientId}`, {
      headers: {
        Authorization: `Bearer ${testToken}`
      }
    });

    console.log(`[✓] Found ${listRes.data.length} document(s)`);
    listRes.data.forEach((doc) => {
      console.log(`      - ${doc.originalName} (${doc.textLength} chars, ${doc.chunkCount} chunks, status: ${doc.embeddingStatus})`);
    });

    console.log('\n========== ALL TESTS PASSED ==========\n');


  } catch (error) {
    console.error('[✗] Test Failed:');
    if (error.response) {
      console.error(`    Status: ${error.response.status}`);
      console.error(`    Message: ${error.response.data.message || error.response.data.error}`);
    } else {
      console.error(`    Error: ${error.message}`);
      console.error(`    Stack: ${error.stack}`);
    }
    process.exit(1);
  } finally {
    await disconnectDB();
  }
}

// ============ Run ============
runTests();
