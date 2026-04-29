require('dotenv').config();
const { PDFLoader } = require('@langchain/community/document_loaders/fs/pdf');
const { RecursiveCharacterTextSplitter } = require('@langchain/textsplitters');
const { GoogleGenerativeAIEmbeddings } = require('@langchain/google-genai');
const { MongoDBAtlasVectorSearch } = require('@langchain/mongodb');
const { MongoClient } = require('mongodb');
const path = require('path');
const fs = require('fs');

async function ingestKnowledge() {
  const KNOWLEDGE_DIR = path.join(__dirname, '../../knowledge_base');
  const uri = process.env.MONGO_URI;

  if (!uri) throw new Error('MONGO_URI is missing');
  if (!process.env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is missing');

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db('psych-platform'); // Adjust DB name if different
  const collection = db.collection('rag_chunks');

  console.log('[Ingestion] Connected to MongoDB.');

  const files = fs.readdirSync(KNOWLEDGE_DIR).filter(f => f.endsWith('.pdf'));

  if (files.length === 0) {
    console.log('[Ingestion] No PDFs found in knowledge_base directory.');
    await client.close();
    return;
  }

  const embeddings = new GoogleGenerativeAIEmbeddings({
    modelName: 'text-embedding-004',
    apiKey: process.env.GEMINI_API_KEY
  });

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 500,
    chunkOverlap: 50,
  });

  for (const file of files) {
    console.log(`[Ingestion] Processing ${file}...`);
    const filePath = path.join(KNOWLEDGE_DIR, file);
    const loader = new PDFLoader(filePath);
    const rawDocs = await loader.load();

    const docs = await splitter.splitDocuments(rawDocs);

    // Add metadata
    const mappedDocs = docs.map(doc => {
      doc.metadata.source = file;
      doc.metadata.topic = 'psychology'; // Default, can be enhanced
      return doc;
    });

    console.log(`[Ingestion] Storing ${mappedDocs.length} chunks to Atlas Vector Search...`);
    
    await MongoDBAtlasVectorSearch.fromDocuments(
      mappedDocs,
      embeddings,
      {
        collection: collection,
        indexName: 'vector_index', // This MUST match the index name created in Atlas UI
        textKey: 'text',
        embeddingKey: 'embedding'
      }
    );
  }

  console.log('[Ingestion] Knowledge ingestion complete.');
  await client.close();
}

// Run script if executed directly
if (require.main === module) {
  ingestKnowledge().catch(console.error);
}

module.exports = ingestKnowledge;
