const axios = require('axios');
const { ChatGoogleGenerativeAI, GoogleGenerativeAIEmbeddings } = require('@langchain/google-genai');

/**
 * MCP Server: GeminiLLMServer
 * Role: Manages all interactions with Google Generative AI APIs.
 * Capabilities: embedContent, generateContent
 */
class GeminiLLMServer {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
    this.genAI = this.apiKey
      ? new ChatGoogleGenerativeAI({
          apiKey: this.apiKey,
          model: 'gemini-1.5-flash',
          temperature: 0.7,
        })
      : null;
    this.embeddingModel = this.apiKey
      ? new GoogleGenerativeAIEmbeddings({
          apiKey: this.apiKey,
          modelName: 'gemini-embedding-001',
        })
      : null;
    this.modelCandidates = ['gemini-2.0-flash', 'gemini-1.5-flash-latest', 'gemini-1.5-flash'];
  }

  /**
   * Converts text into embeddings using text-embedding-004
   * @param {string} text - Normalized text to embed
   * @returns {Promise<Array<number>>} - Vector values
   */
  async embedContent(text) {
    if (!this.embeddingModel) {
      throw new Error('GEMINI_API_KEY is not defined in environment variables.');
    }
    
    try {
      const normalizedText = String(text || '').trim();
      if (!normalizedText) {
        throw new Error('Cannot embed empty text.');
      }

      return await this.embeddingModel.embedQuery(normalizedText);
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
    if (!this.genAI) {
      throw new Error('GEMINI_API_KEY is not defined in environment variables.');
    }

    try {
      const normalizedPrompt = String(prompt || '').trim();
      if (!normalizedPrompt) {
        throw new Error('Cannot generate content from an empty prompt.');
      }

      let lastError = null;
      for (const modelName of this.modelCandidates) {
        try {
          // Change model dynamically
          this.genAI.model = modelName;
          const result = await this.genAI.invoke(normalizedPrompt);
          return result.content || '';
        } catch (error) {
          lastError = error;
          const message = String(error?.message || '');
          if (!/404 Not Found|not found|not supported/i.test(message)) {
            throw error;
          }
        }
      }

      if (process.env.GROQ_API_KEY) {
        const groqResponse = await axios.post(
          'https://api.groq.com/openai/v1/chat/completions',
          {
            model: 'llama-3.3-70b-versatile',
            messages: [{ role: 'user', content: normalizedPrompt }],
            temperature: 0.7,
            max_tokens: 500
          },
          {
            headers: {
              Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
              'Content-Type': 'application/json'
            }
          }
        );

        return String(groqResponse.data?.choices?.[0]?.message?.content || '');
      }

      throw lastError || new Error('No supported Gemini model available.');
    } catch (error) {
      console.error('GeminiLLMServer - generateContent Error:', error.message);
      throw error;
    }
  }
}

module.exports = new GeminiLLMServer();
