const GeminiLLMServer = require('../mcp/GeminiLLMServer');
const MongoVectorDBServer = require('../mcp/MongoVectorDBServer');
const ExtractVectorEmbedding = require('./ExtractVectorEmbedding');

/**
 * Skill: EnrichDarijaVocabulary
 * Purpose: Analyzes unknown Tunisian Darija expressions, generates definitions, and inserts them into the knowledge base to perpetually enrich the RAG dataset.
 */
class EnrichDarijaVocabulary {
  /**
   * @param {string} unknownText 
   * @returns {Promise<string>} The newly generated context string to be used immediately.
   */
  async execute(unknownText) {
    if (!unknownText) {
      return '';
    }

    try {
      // 1. Act as a linguist to decipher the word and format as JSON
      const linguisticPrompt = `
You are an expert in the Tunisian dialect (Darija) and psychological terminology.
The system encountered this user input: "${unknownText}"

Please identify the main dialect word(s) indicating an emotional or psychological state.
Return ONLY a strictly formatted JSON object with the following structure, no markdown blocks, no extra text:
{
  "darija": "the main dialect word(s) identified",
  "english": "the English translation and psychological meaning",
  "category": "One of: anxiety, depression, stress, anger, neutral, unknown"
}
      `;

      const aiResponse = await GeminiLLMServer.generateContent(linguisticPrompt);
      
      // Parse the JSON safely (handling possible markdown or raw json)
      let parsedData;
      try {
        const cleanJSON = aiResponse.replace(/```json/gi, '').replace(/```/gi, '').trim();
        parsedData = JSON.parse(cleanJSON);
      } catch (err) {
        console.warn('EnrichDarijaVocabulary - Failed to parse LLM JSON:', aiResponse);
        return ''; // Abort enrichment if JSON fails, fallback to empty context
      }

      // 2. Generate vector embedding for this new definition
      // We embed the English translation + category so it can be found semantically later
      const semanticPayload = `${parsedData.darija} means ${parsedData.english}. Category: ${parsedData.category}`;
      const embedding = await ExtractVectorEmbedding.execute(semanticPayload);

      // 3. Construct Document
      const newDocument = {
        darija: parsedData.darija,
        english: parsedData.english,
        category: parsedData.category,
        embedding: embedding,
        addedAt: new Date()
      };

      // 4. Save to Database indefinitely
      console.log(`[Auto-Learning] Enriching vocabulary with new term: ${parsedData.darija}`);
      await MongoVectorDBServer.insertKnowledge(newDocument);

      // 5. Return context string to be used for the immediate empathetic response
      return `
Darija: ${parsedData.darija}
Meaning: ${parsedData.english}
Category: ${parsedData.category}
      `.trim();

    } catch (error) {
      console.error('EnrichDarijaVocabulary - Error:', error.message);
      return ''; // Graceful degradation
    }
  }
}

module.exports = new EnrichDarijaVocabulary();
