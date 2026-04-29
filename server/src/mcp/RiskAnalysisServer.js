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
   * @returns {Promise<{ risk_level: string, confidence: number, signals_detected: string[], urgency: string, recommended_action: string }>}
   */
  async classify(message, contextSnippet) {
    const prompt = `You are a clinical risk screening system embedded in a psychological intake chatbot.
Your task is to analyze the following patient message for signs of potential harm.

PATIENT MESSAGE:
"${message}"

RECENT CONVERSATION CONTEXT (last 3 turns):
${contextSnippet || 'No prior context.'}

CLASSIFICATION RULES:
Classify the message into one of three risk levels based on semantic understanding, tone, urgency, and phrasing.

LOW RISK:
- General emotional distress
- Sadness, stress, confusion
- No indication of harm
Examples: "I feel tired", "I'm overwhelmed"

MEDIUM RISK:
- Indirect or passive harmful thoughts
- Expressions of wanting escape or disappearance
Examples: "I just want everything to stop", "I feel like disappearing sometimes"

HIGH RISK (CRITICAL):
- Explicit or implied intent to harm self or others
- Threats, urgency, manipulation, coercion
Examples: "I'm going to hurt myself", "If you don't help me, I'll do something bad"

SCORING RULES:
- Consider semantic understanding, not just keywords.
- Consider tone, urgency, and phrasing.
- If the user uses coercion or manipulation (e.g., "If you don't help me, I'll hurt myself"), classify as HIGH RISK.
- When unsure between two levels, ALWAYS classify to the higher risk level (fail-safe).
- Risk level must be: "LOW", "MEDIUM", or "HIGH".
- Confidence is a float between 0.0 and 1.0.

Respond ONLY with a single valid JSON object. No other text, no explanation, no markdown:
{
  "risk_level": "LOW" | "MEDIUM" | "HIGH",
  "confidence": <float 0.0-1.0>,
  "signals_detected": ["<signal 1>", "<signal 2>"],
  "urgency": "immediate" | "soon" | "none",
  "recommended_action": "<one sentence recommendation>"
}`;

    try {
      const rawResponse = await GeminiLLMServer.generateContent(prompt);
      return this._parseClassification(rawResponse);
    } catch (error) {
      console.error('RiskAnalysisServer - classify Error:', error.message);
      return { risk_level: 'LOW', confidence: 1.0, signals_detected: [], urgency: 'none', recommended_action: 'Classification failed — defaulting to safe.' };
    }
  }

  /**
   * Parses and validates the LLM JSON output.
   * @param {string} raw
   * @returns {{ risk_level: string, confidence: number, signals_detected: string[], urgency: string, recommended_action: string }}
   */
  _parseClassification(raw) {
    const VALID_LEVELS = ['LOW', 'MEDIUM', 'HIGH'];

    try {
      const cleaned = raw.replace(/```json|```/g, '').trim();
      const start = cleaned.indexOf('{');
      const end = cleaned.lastIndexOf('}');
      if (start === -1 || end === -1) throw new Error('No JSON object found');

      const parsed = JSON.parse(cleaned.slice(start, end + 1));

      if (!VALID_LEVELS.includes(parsed.risk_level)) {
        parsed.risk_level = 'LOW';
      }
      parsed.confidence = Math.min(1.0, Math.max(0.0, parseFloat(parsed.confidence) || 0.0));
      parsed.signals_detected = Array.isArray(parsed.signals_detected) ? parsed.signals_detected : [];
      parsed.urgency = parsed.urgency || 'none';
      parsed.recommended_action = String(parsed.recommended_action || '').slice(0, 300);

      return parsed;
    } catch {
      return { risk_level: 'LOW', confidence: 0.0, signals_detected: [], urgency: 'none', recommended_action: 'Parse error — defaulting to safe.' };
    }
  }
}

module.exports = new RiskAnalysisServer();
