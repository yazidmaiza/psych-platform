const mongoose = require('mongoose');

/**
 * MCP Server: MongoVectorDBServer
 * Role: Handles retrieval from the vector database index.
 * Capabilities: executeVectorSearch
 */
class MongoVectorDBServer {
  /**
   * Runs an aggregation query to perform vector search on Atlas
   * @param {Array<number>} queryVector - Embedding array of numbers
   * @param {string} indexName - Name of the Atlas Vector Search Index
   * @param {string} collectionName - Name of the collection
   * @returns {Promise<Array<Object>>} - Raw BSON/JSON matched documents
   */
  async executeVectorSearch(queryVector, indexName = 'darija_vector_index', collectionName = 'darija_knowledge') {
    try {
      if (!mongoose.connection || mongoose.connection.readyState !== 1) {
        throw new Error('MongoDB is not connected.');
      }

      const collection = mongoose.connection.db.collection(collectionName);
      
      const results = await collection.aggregate([
        {
          $vectorSearch: {
            index: indexName,
            path: 'embedding',
            queryVector: queryVector,
            numCandidates: 100,
            limit: 5
          }
        }
      ]).toArray();

      return results;
    } catch (error) {
      console.error('MongoVectorDBServer - executeVectorSearch Error:', error.message);
      throw error;
    }
  }

  /**
   * Inserts a new derived knowledge document into the vector database
   * @param {Object} document - { darija, english, category, embedding }
   * @param {string} collectionName
   * @returns {Promise<boolean>}
   */
  async insertKnowledge(document, collectionName = 'darija_knowledge') {
    try {
      if (!mongoose.connection || mongoose.connection.readyState !== 1) {
        throw new Error('MongoDB is not connected.');
      }
      
      const collection = mongoose.connection.db.collection(collectionName);
      await collection.insertOne(document);
      
      return true;
    } catch (error) {
      console.error('MongoVectorDBServer - insertKnowledge Error:', error.message);
      throw error;
    }
  }
}

module.exports = new MongoVectorDBServer();
