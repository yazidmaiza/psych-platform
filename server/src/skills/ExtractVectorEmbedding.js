const GeminiLLMServer = require('../mcp/GeminiLLMServer');

/**
 * Skill: ExtractVectorEmbedding
 * Purpose: Converts normalized text into a mathematical vector representation.
 */
class ExtractVectorEmbedding {
  /**
   * @param {string} normalizedText 
   * @returns {Promise<Array<number>>} 
   */
  async execute(normalizedText) {
    if (!normalizedText) {
      throw new Error('ExtractVectorEmbedding requires input text.');
    }
    
    try {
      const vector = await GeminiLLMServer.embedContent(normalizedText);
      return vector;
    } catch (error) {
      console.error('ExtractVectorEmbedding - Error:', error.message);
      throw error;
    }
  }
}

module.exports = new ExtractVectorEmbedding();
