const GeminiLLMServer = require('../mcp/GeminiLLMServer');

/**
 * Skill: GenerateIntakeResponse (formerly GenerateEmpatheticResponse)
 * Purpose: Generates a stage-aware, RAG-grounded psychological intake response.
 *
 * Supports all 4 platform languages: Arabic/Darija, French, English, Tunisian Darija.
 * The model detects the patient's language and responds in the same language.
 */
class GenerateIntakeResponse {
  /**
   * @param {string} originalInput - Raw patient message
   * @param {string} contextString - Darija RAG context (dialect interpretations)
   * @param {Object} stageConfig - Current stage from IntakeProtocolServer
   * @param {Array} conversationHistory - Last 8 ChatbotMessage docs [{role, content}]
   * @returns {Promise<string>} AI-generated response
   */
  async execute(originalInput, contextString, stageConfig, conversationHistory = []) {
    if (!originalInput) {
      throw new Error('GenerateIntakeResponse requires original user input.');
    }

    // Format conversation history for the prompt
    const historyText = conversationHistory.length > 0
      ? conversationHistory
          .map(m => `${m.role === 'user' ? 'PATIENT' : 'ASSISTANT'}: ${m.content}`)
          .join('\n')
      : 'This is the beginning of the conversation.';

    // Format probe questions for current stage
    const probesAr = (stageConfig?.probesAr || []).join('\n- ');
    const stageGoal = stageConfig?.goalEn || 'Gather information about the patient\'s situation.';
    const stageName = stageConfig?.nameEn || 'Intake';

    const prompt = `You are a compassionate psychological intake assistant conducting a structured clinical intake session.

=== CURRENT SESSION STAGE ===
Stage Name: ${stageName}
Stage Goal: ${stageGoal}
Suggested probe questions (Arabic/Darija — pick ONE to adapt naturally into your response):
- ${probesAr || 'Ask open-ended questions about feelings and situation.'}

=== DARIJA DIALECT CONTEXT (RAG Knowledge) ===
${contextString || 'No specific dialect context retrieved.'}

=== CONVERSATION HISTORY (last 8 turns) ===
${historyText}

=== PATIENT'S CURRENT MESSAGE ===
${originalInput}

=== INSTRUCTIONS ===
LANGUAGE DETECTION (CRITICAL):
- Detect the language the PATIENT is writing in: Tunisian Darija (Arabic script), French, English, or Arabic.
- Respond EXCLUSIVELY in the SAME language the patient uses.
- If the patient writes in Tunisian Darija (Arabic), respond in authentic Tunisian Darija ONLY — use vocabulary like "barcha", "tawa", "behi", "mta3", "kifech", "chbik". NEVER use Moroccan Darija ("bzaf", "daba", "wakha").
- If the patient writes in French, respond entirely in French.
- If the patient writes in English, respond entirely in English.
- If the patient writes in standard Arabic, respond in standard Arabic.

CLINICAL CONDUCT:
- You are conducting the "${stageName}" phase of a clinical intake. Stay focused on this stage's goal.
- Keep the conversation flowing toward the stage goal by naturally incorporating ONE probe question.
- Be warm, non-judgmental, and fully present. Never rush the patient.
- Ask exactly ONE follow-up question per response — do not stack multiple questions.
- Do NOT provide diagnoses, medications, or direct advice.
- Do NOT summarize what the patient said back to them — move the conversation forward.
- Keep your response concise (3–5 sentences max).`;

    try {
      const aiResponse = await GeminiLLMServer.generateContent(prompt);
      return aiResponse;
    } catch (error) {
      console.error('GenerateIntakeResponse - Error:', error.message);
      throw error;
    }
  }
}

module.exports = new GenerateIntakeResponse();
