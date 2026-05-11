const mongoose = require('mongoose');

const patientDocumentChunkSchema = new mongoose.Schema(
  {
    documentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PatientDocument',
      required: true,
      index: true
    },
    psychologistId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    chunkIndex: {
      type: Number,
      required: true
    },
    content: {
      type: String,
      required: true
    },
    embedding: {
      type: [Number],
      default: null
    },
    sourceName: {
      type: String,
      default: ''
    }
  },
  { timestamps: true, collection: 'patient_doc_chunks' }
);

patientDocumentChunkSchema.index({ documentId: 1, chunkIndex: 1 });
// Add a text index to support fallback text search when vector index or embeddings are unavailable
patientDocumentChunkSchema.index({ content: 'text' });

module.exports = mongoose.model('PatientDocumentChunk', patientDocumentChunkSchema);
