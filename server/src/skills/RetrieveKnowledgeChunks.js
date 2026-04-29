const { GoogleGenerativeAIEmbeddings } = require('@langchain/google-genai');
const { MongoDBAtlasVectorSearch } = require('@langchain/mongodb');
const { MongoClient } = require('mongodb');

/**
 * Skill: RetrieveKnowledgeChunks
 * Purpose: Fetches top-K relevant chunks from MongoDB Atlas Vector Search using LangChain.
 */
class RetrieveKnowledgeChunks {
  async execute(queryText) {
    if (!queryText) return null;

    if (!process.env.MONGO_URI || !process.env.GEMINI_API_KEY) {
      console.warn('RetrieveKnowledgeChunks: Missing MONGO_URI or GEMINI_API_KEY');
      return null;
    }

    let client;
    try {
      client = new MongoClient(process.env.MONGO_URI);
      await client.connect();
      const collection = client.db('psych-platform').collection('rag_chunks');

      const embeddings = new GoogleGenerativeAIEmbeddings({
        modelName: 'text-embedding-004',
        apiKey: process.env.GEMINI_API_KEY
      });

      const vectorStore = new MongoDBAtlasVectorSearch(embeddings, {
        collection: collection,
        indexName: 'vector_index', // Must match Atlas index
        textKey: 'text',
        embeddingKey: 'embedding'
      });

      // Retrieve top 4 chunks
      const results = await vectorStore.similaritySearch(queryText, 4);

      if (!results || results.length === 0) {
        return null;
      }

      const contextString = results.map((doc, i) => `[Chunk ${i+1} from ${doc.metadata.source || 'Knowledge Base'}]:\n${doc.pageContent}`).join('\n\n');
      
      return contextString;
    } catch (error) {
      console.error('RetrieveKnowledgeChunks - Error:', error.message);
      return null;
    } finally {
      if (client) {
        await client.close();
      }
    }
  }
}

module.exports = new RetrieveKnowledgeChunks();
