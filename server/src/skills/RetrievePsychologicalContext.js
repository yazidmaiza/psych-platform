const MongoVectorDBServer = require('../mcp/MongoVectorDBServer');

/**
 * Skill: RetrievePsychologicalContext
 * Purpose: Fetches relevant psychological meanings for Darija expressions via Vector search.
 */
class RetrievePsychologicalContext {
  /**
   * @param {Array<number>} vector 
   * @returns {Promise<string>} Formatted context string
   */
  async execute(vector) {
    if (!vector || !Array.isArray(vector) || vector.length === 0) {
      throw new Error('RetrievePsychologicalContext requires a valid vector array.');
    }

    try {
      const results = await MongoVectorDBServer.executeVectorSearch(vector);
      
      if (!results || results.length === 0) {
        return null; // Return null so the workflow knows to trigger auto-learning
      }

      const contextString = results.map(r => `
Darija: ${r.darija || 'Unknown'}
Meaning: ${r.english || 'Unknown'}
Category: ${r.category || 'General'}
      `).join('\n').trim();

      return contextString;
    } catch (error) {
      console.error('RetrievePsychologicalContext - Error:', error.message);
      return null;
    }
  }
}

module.exports = new RetrievePsychologicalContext();
