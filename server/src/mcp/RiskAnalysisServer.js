const GeminiLLMServer = require('./GeminiLLMServer');

/**
 * MCP Server: RiskAnalysisServer
 * Role: Wraps GeminiLLMServer with a structured clinical risk classification prompt.
 * Always returns a safe, valid JSON object — never throws on parse failure.
 */
class RiskAnalysisServer {
  /**
   * Classifies a patient message for behavioral risk signals.
   * @param {string} message - Raw patient message
   * @param {string} contextSnippet - Last 3 turns of conversation (formatted text)
   * @returns {Promise<{ category: string, score: number, reasoning: string }>}
   */
  async classify(message, contextSnippet) {
    const prompt = `You are a clinical risk screening system embedded in a psychological intake chatbot.
Your task is to analyze the following patient message for signs of potential harm.

PATIENT MESSAGE:
"${message}"

RECENT CONVERSATION CONTEXT (last 3 turns):
${contextSnippet || 'No prior context.'}

Analyze for these specific risk categories only:
- "self_harm": explicit or implied references to self-injury, cutting, burning, hurting oneself
- "suicidal_ideation": wishes to die, statements of hopelessness, "no point in living", passive death wishes
- "abuse_trauma": disclosures of physical, sexual, or emotional violence, abuse by others
- "crisis_escalation": sudden incoherence, panic, rapid emotional destabilization, explicit danger
- "safe": no meaningful risk detected — includes figurative language, metaphors, venting without harm signals

SCORING RULES:
- Be conservative. Figurative language ("I want to kill this stress") = safe.
- Only flag concrete, direct, or strongly implied harm signals.
- Score 0–100 represents confidence that this category applies.

Respond ONLY with a single valid JSON object. No other text, no explanation, no markdown:
{
  "category": "safe" | "self_harm" | "suicidal_ideation" | "abuse_trauma" | "crisis_escalation",
  "score": <integer 0-100>,
  "reasoning": "<one concise sentence explaining the classification>"
}`;

    try {
      const rawResponse = await GeminiLLMServer.generateContent(prompt);
      return this._parseClassification(rawResponse);
    } catch (error) {
      console.error('RiskAnalysisServer - classify Error:', error.message);
      // Fail safe: never crash the pipeline
      return { category: 'safe', score: 0, reasoning: 'Classification failed — defaulting to safe.' };
    }
  }

  /**
   * Parses and validates the LLM JSON output.
   * @param {string} raw
   * @returns {{ category: string, score: number, reasoning: string }}
   */
  _parseClassification(raw) {
    const VALID_CATEGORIES = ['safe', 'self_harm', 'suicidal_ideation', 'abuse_trauma', 'crisis_escalation'];

    try {
      const cleaned = raw.replace(/```json|```/g, '').trim();
      const start = cleaned.indexOf('{');
      const end = cleaned.lastIndexOf('}');
      if (start === -1 || end === -1) throw new Error('No JSON object found');

      const parsed = JSON.parse(cleaned.slice(start, end + 1));

      if (!VALID_CATEGORIES.includes(parsed.category)) {
        parsed.category = 'safe';
      }
      parsed.score = Math.min(100, Math.max(0, parseInt(parsed.score, 10) || 0));
      parsed.reasoning = String(parsed.reasoning || '').slice(0, 300);

      return parsed;
    } catch {
      return { category: 'safe', score: 0, reasoning: 'Parse error — defaulting to safe.' };
    }
  }
}

module.exports = new RiskAnalysisServer();
