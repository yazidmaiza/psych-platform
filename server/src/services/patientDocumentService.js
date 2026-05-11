const mongoose = require('mongoose');
const { RecursiveCharacterTextSplitter } = require('@langchain/textsplitters');
const { GoogleGenerativeAIEmbeddings } = require('@langchain/google-genai');

const PatientDocumentChunk = require('../models/PatientDocumentChunk');

const CHUNK_SIZE = Number(
  process.env.DOC_CHUNK_SIZE || 800
);

const CHUNK_OVERLAP = Number(
  process.env.DOC_CHUNK_OVERLAP || 100
);

const VECTOR_INDEX =
  process.env.PATIENT_DOC_VECTOR_INDEX ||
  'patient_doc_vector_index';

const getCollection = () =>
  mongoose.connection.db.collection(
    'patient_doc_chunks'
  );

const buildSplitter = () =>
  new RecursiveCharacterTextSplitter({
    chunkSize: CHUNK_SIZE,
    chunkOverlap: CHUNK_OVERLAP
  });

const createEmbeddings = async (texts) => {
  if (!process.env.GEMINI_API_KEY) return null;

  const embeddings =
    new GoogleGenerativeAIEmbeddings({
      modelName: 'text-embedding-004',
      apiKey: process.env.GEMINI_API_KEY
    });

  if (
    typeof embeddings.embedDocuments ===
    'function'
  ) {
    return embeddings.embedDocuments(texts);
  }

  return Promise.all(
    texts.map((text) =>
      embeddings.embedQuery(text)
    )
  );
};

const normalizeQuestionKeywords = (question) => {
  return String(question || '')
    .split(/\W+/)
    .map((word) => word.trim())
    .filter((word) => word.length >= 4)
    .slice(0, 6);
};

const ingestPatientDocument = async ({
  document,
  extractedText
}) => {
  if (!document || !extractedText) {
    return {
      chunkCount: 0,
      embeddingStatus: 'skipped'
    };
  }

  const splitter = buildSplitter();

  const chunks = await splitter.splitText(
    extractedText
  );

  if (!chunks.length) {
    return {
      chunkCount: 0,
      embeddingStatus: 'skipped'
    };
  }

  await PatientDocumentChunk.deleteMany({
    documentId: document._id
  });

  let embeddings = null;

  try {
    embeddings = await createEmbeddings(chunks);
  } catch (err) {
    embeddings = null;
  }

  const entries = chunks.map(
    (content, index) => ({
      documentId: document._id,
      psychologistId:
        document.psychologistId,
      patientId: document.patientId,
      chunkIndex: index,
      content,
      embedding: embeddings
        ? embeddings[index]
        : null,
      sourceName:
        document.originalName || ''
    })
  );

  await PatientDocumentChunk.insertMany(
    entries
  );

  return {
    chunkCount: entries.length,
    embeddingStatus: embeddings
      ? 'ready'
      : 'pending'
  };
};

const retrieveDocumentContext = async ({
  documentId,
  psychologistId,
  patientId,
  question,
  topK = 5
}) => {
  if (!documentId || !question) {
    return {
      chunks: [],
      contextText: ''
    };
  }

  const collection = getCollection();

  const keywordList =
    normalizeQuestionKeywords(question);

  let chunks = [];

  const documentFilter = {
    documentId:
      new mongoose.Types.ObjectId(
        documentId
      )
  };

  if (psychologistId) {
    documentFilter.psychologistId =
      new mongoose.Types.ObjectId(
        psychologistId
      );
  }

  if (patientId) {
    documentFilter.patientId =
      new mongoose.Types.ObjectId(
        patientId
      );
  }

  //////////////////////////////////////////////////
  // VECTOR SEARCH
  //////////////////////////////////////////////////

  if (process.env.GEMINI_API_KEY) {
    try {
      const hasEmbeddings =
        await collection.findOne({
          ...documentFilter,
          embedding: { $ne: null }
        });

      if (hasEmbeddings) {
        const embeddings =
          new GoogleGenerativeAIEmbeddings({
            modelName:
              'text-embedding-004',
            apiKey:
              process.env.GEMINI_API_KEY
          });

        const vector =
          await embeddings.embedQuery(
            question
          );

        const pipeline = [
          {
            $vectorSearch: {
              index: VECTOR_INDEX,
              path: 'embedding',
              queryVector: vector,
              numCandidates: 80,
              limit: topK,
              filter: documentFilter
            }
          },
          {
            $project: {
              content: 1,
              chunkIndex: 1,
              sourceName: 1,
              score: {
                $meta:
                  'vectorSearchScore'
              }
            }
          }
        ];

        try {
          chunks = await collection
            .aggregate(pipeline)
            .toArray();
        } catch (err) {
          // Vector index missing or unsupported
          chunks = [];
        }
      }
    } catch (err) {
      chunks = [];
    }
  }

  //////////////////////////////////////////////////
  // TEXT / REGEX FALLBACK SEARCH
  //////////////////////////////////////////////////

  if (!chunks.length) {
    const regex = keywordList.length
      ? new RegExp(
          keywordList.join('|'),
          'i'
        )
      : null;

    const query = {
      ...documentFilter
    };

    // MongoDB text search
    if (regex) {
      try {
        const textResults =
          await PatientDocumentChunk.find(
            {
              $text: {
                $search:
                  keywordList.join(' ')
              },
              ...documentFilter
            },
            {
              score: {
                $meta: 'textScore'
              }
            }
          )
            .sort({
              score: {
                $meta: 'textScore'
              }
            })
            .limit(topK)
            .lean();

        if (
          textResults &&
          textResults.length
        ) {
          chunks = textResults.map(
            (doc) => ({
              content: doc.content,
              chunkIndex:
                doc.chunkIndex,
              sourceName:
                doc.sourceName || '',
              score: doc.score
            })
          );
        }
      } catch (err) {
        // Text index missing
      }
    }

    // Regex fallback
    if (!chunks.length) {
      if (regex) {
        query.content = regex;
      }

      chunks =
        await PatientDocumentChunk.find(
          query
        )
          .sort({ chunkIndex: 1 })
          .limit(topK)
          .lean();
    }
  }

  //////////////////////////////////////////////////
  // BUILD CONTEXT
  //////////////////////////////////////////////////

  const contextText = chunks
    .map(
      (chunk) =>
        `[Chunk ${
          chunk.chunkIndex + 1
        }]\n${chunk.content}`
    )
    .join('\n\n');

  return {
    chunks,
    contextText
  };
};

module.exports = {
  ingestPatientDocument,
  retrieveDocumentContext
};