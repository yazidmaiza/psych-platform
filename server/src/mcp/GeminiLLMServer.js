const { GoogleGenerativeAI } = require('@google/generative-ai');

/**
 * MCP Server: GeminiLLMServer
 * Role: Manages all interactions with Google Generative AI APIs.
 * Capabilities: embedContent, generateContent
 */
class GeminiLLMServer {
  constructor() {
    // Initialize standard generative AI client
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
  }

  /**
   * Converts text into embeddings using text-embedding-004
   * @param {string} text - Normalized text to embed
   * @returns {Promise<Array<number>>} - Vector values
   */
  async embedContent(text) {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is not defined in environment variables.');
    }
    
    try {
      const embeddingModel = this.genAI.getGenerativeModel({
        model: 'text-embedding-004'
      });

      const embeddingResponse = await embeddingModel.embedContent({
        content: text
      });

      return embeddingResponse.embedding.values;
    } catch (error) {
      console.error('GeminiLLMServer - embedContent Error:', error.message);
      throw error;
    }
  }

  /**
   * Executes structured prompts using gemini-1.5-flash
   * @param {string} prompt - Structured prompt including context and user input
   * @returns {Promise<string>} - Generated AI response text
   */
  async generateContent(prompt) {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is not defined in environment variables.');
    }

    try {
      const model = this.genAI.getGenerativeModel({
        model: 'gemini-1.5-flash'
      });

      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (error) {
      console.error('GeminiLLMServer - generateContent Error:', error.message);
      throw error;
    }
  }
}

module.exports = new GeminiLLMServer();
