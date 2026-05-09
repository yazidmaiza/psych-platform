const GeminiLLMServer = require('./GeminiLLMServer');

const VALID_LEVELS = ['LOW', 'MEDIUM', 'HIGH'];
const VALID_CATEGORIES = ['self_harm', 'suicidal_ideation', 'abuse_trauma', 'crisis_escalation'];

const HIGH_SELF_HARM_PATTERNS = [
  'i want to die',
  'i am going to kill myself',
  "i'm going to kill myself",
  'i will kill myself',
  'i want to kill myself',
  'i am going to hurt myself',
  "i'm going to hurt myself",
  'i will hurt myself',
  'je veux mourir',
  'je veux me tuer',
  'je vais me tuer',
  'j ai envie de mourir',
  'j\'ai envie de mourir',
  'نحب نموت',
  'نحب نقتل روحي',
  'نحس روحي باش نموت'
];

const HIGH_OTHER_HARM_PATTERNS = [
  'i am going to hurt you',
  "i'm going to hurt you",
  'i will hurt you',
  'i am going to kill you',
  "i'm going to kill you",
  'i will kill you',
  'je vais te faire du mal',
  'je vais te tuer',
  'نضربك',
  'نقتلك',
  'باش نأذيك'
];

const COERCION_PATTERNS = [
  'if you do not help me',
  "if you don't help me",
  'if you dont help me',
  'otherwise i will',
  'or else i will',
  'otherwise i might',
  'sinon je vais',
  'إلا ما تساعدنيش',
  'إلا ما تعاوننيش'
];

const ABUSE_PATTERNS = [
  'abuse',
  'abused',
  'assault',
  'rape',
  'violence',
  'violent',
  'beat me',
  'hit me',
  'harassed',
  'harassment',
  'violence conjugale',
  'agression',
  'عنف',
  'اعتداء'
];

const MEDIUM_PATTERNS = [
  'i want everything to stop',
  'i feel like disappearing',
  'i feel like vanishing',
  'nothing matters anymore',
  'i cannot do this anymore',
  'je veux que tout s\'arrête',
  'je veux disparaître',
  'نحب كل شي يوقف',
  'نحب نختفي'
];

class RiskAnalysisServer {
  async classify(message, contextSnippet) {
    const normalizedMessage = String(message || '').trim();
    const normalizedContext = String(contextSnippet || '').trim();

    const immediate = this._detectImmediateRisk(normalizedMessage);
    if (immediate) {
      return immediate;
    }

    const prompt = `You are a clinical risk screening system embedded in a psychological intake chatbot.
Analyze the patient message and recent context for emotional risk.

PATIENT MESSAGE:
${JSON.stringify(normalizedMessage)}

RECENT CONVERSATION CONTEXT (last 3 turns):
${normalizedContext || 'No prior context.'}

Return only valid JSON with this exact shape:
{
  "risk_level": "LOW" | "MEDIUM" | "HIGH",
  "category": "self_harm" | "suicidal_ideation" | "abuse_trauma" | "crisis_escalation",
  "score": 0-100,
  "severity": "low" | "medium" | "high" | "critical",
  "confidence": 0.0-1.0,
  "signals_detected": ["string"],
  "urgency": "none" | "soon" | "immediate",
  "reasoning": "one short sentence",
  "recommended_action": "one short sentence"
}

Rules:
- Use fail-safe classification when uncertain.
- Medium covers indirect hopelessness, escape language, or passive disappearance.
- High covers explicit or implied self-harm, harm to others, coercion, or crisis escalation.
- Keep the reasoning short and concrete.
`;

    try {
      const rawResponse = await GeminiLLMServer.generateContent(prompt);
      return this._parseClassification(rawResponse, normalizedMessage, normalizedContext);
    } catch (error) {
      console.error('RiskAnalysisServer - classify Error:', error.message);
      return this._fallbackPayload(normalizedMessage, normalizedContext);
    }
  }

  _detectImmediateRisk(message) {
    const fullText = String(message || '').toLowerCase();

    const selfHarmHit = HIGH_SELF_HARM_PATTERNS.find((pattern) => fullText.includes(pattern));
    if (selfHarmHit) {
      return this._buildPayload({
        risk_level: 'HIGH',
        category: 'suicidal_ideation',
        score: 98,
        severity: 'critical',
        confidence: 1,
        signals_detected: [selfHarmHit],
        urgency: 'immediate',
        reasoning: 'Explicit self-harm or suicide language was detected.',
        recommended_action: 'Use the safety protocol immediately and ask whether the user is safe right now.'
      });
    }

    const otherHarmHit = HIGH_OTHER_HARM_PATTERNS.find((pattern) => fullText.includes(pattern));
    if (otherHarmHit) {
      return this._buildPayload({
        risk_level: 'HIGH',
        category: 'crisis_escalation',
        score: 96,
        severity: 'critical',
        confidence: 1,
        signals_detected: [otherHarmHit],
        urgency: 'immediate',
        reasoning: 'Explicit threat or harm-to-others language was detected.',
        recommended_action: 'Use the safety protocol immediately and move the conversation toward immediate de-escalation.'
      });
    }

    const coercionHit = COERCION_PATTERNS.find((pattern) => fullText.includes(pattern));
    if (coercionHit) {
      return this._buildPayload({
        risk_level: 'HIGH',
        category: 'crisis_escalation',
        score: 94,
        severity: 'critical',
        confidence: 1,
        signals_detected: [coercionHit],
        urgency: 'immediate',
        reasoning: 'Coercive or manipulative crisis language was detected.',
        recommended_action: 'Do not negotiate with the threat; switch to safety-first support immediately.'
      });
    }

    const abuseHit = ABUSE_PATTERNS.find((pattern) => fullText.includes(pattern));
    if (abuseHit) {
      return this._buildPayload({
        risk_level: 'MEDIUM',
        category: 'abuse_trauma',
        score: 68,
        severity: 'medium',
        confidence: 0.88,
        signals_detected: [abuseHit],
        urgency: 'soon',
        reasoning: 'The message suggests abuse, assault, or trauma-related distress.',
        recommended_action: 'Use careful, validating exploration and check for immediate safety if needed.'
      });
    }

    const mediumHit = MEDIUM_PATTERNS.find((pattern) => fullText.includes(pattern));
    if (mediumHit) {
      return this._buildPayload({
        risk_level: 'MEDIUM',
        category: 'crisis_escalation',
        score: 62,
        severity: 'medium',
        confidence: 0.8,
        signals_detected: [mediumHit],
        urgency: 'soon',
        reasoning: 'The message contains passive escape language or collapsing hopelessness.',
        recommended_action: 'Continue gently, validate the distress, and explore what is driving the pressure.'
      });
    }

    return null;
  }

  _buildPayload(payload) {
    return {
      risk_level: payload.risk_level || 'LOW',
      category: payload.category || 'crisis_escalation',
      score: Math.max(0, Math.min(100, Number(payload.score) || 0)),
      severity: payload.severity || 'low',
      confidence: Math.max(0, Math.min(1, Number(payload.confidence) || 0)),
      signals_detected: Array.isArray(payload.signals_detected) ? payload.signals_detected : [],
      urgency: payload.urgency || 'none',
      reasoning: String(payload.reasoning || '').slice(0, 300),
      recommended_action: String(payload.recommended_action || '').slice(0, 300)
    };
  }

  _parseClassification(raw, message, contextSnippet) {
    try {
      const cleaned = String(raw || '').replace(/```json|```/g, '').trim();
      const start = cleaned.indexOf('{');
      const end = cleaned.lastIndexOf('}');
      if (start === -1 || end === -1 || end <= start) {
        throw new Error('No JSON object found');
      }

      const parsed = JSON.parse(cleaned.slice(start, end + 1));
      return this._normalizeParsedPayload(parsed, message, contextSnippet);
    } catch (error) {
      console.warn('RiskAnalysisServer - parse fallback:', error.message);
      return this._fallbackPayload(message, contextSnippet);
    }
  }

  _normalizeParsedPayload(parsed, message, contextSnippet) {
    const riskLevel = VALID_LEVELS.includes(String(parsed.risk_level || parsed.riskLevel || '').toUpperCase())
      ? String(parsed.risk_level || parsed.riskLevel).toUpperCase()
      : this._deriveRiskLevel(parsed.score, parsed.severity, message, contextSnippet);

    const score = this._clampNumber(parsed.score ?? parsed.riskScore ?? parsed.confidenceScore, 0, 100, riskLevel === 'HIGH' ? 90 : riskLevel === 'MEDIUM' ? 60 : 15);
    const severity = this._normalizeSeverity(parsed.severity, score, riskLevel);
    const category = VALID_CATEGORIES.includes(String(parsed.category || '').toLowerCase())
      ? String(parsed.category).toLowerCase()
      : this._inferCategory(message, contextSnippet, riskLevel);

    return this._buildPayload({
      risk_level: riskLevel,
      category,
      score,
      severity,
      confidence: this._clampNumber(parsed.confidence, 0, 1, riskLevel === 'HIGH' ? 0.95 : riskLevel === 'MEDIUM' ? 0.8 : 0.65),
      signals_detected: Array.isArray(parsed.signals_detected) ? parsed.signals_detected : [],
      urgency: parsed.urgency || (riskLevel === 'HIGH' ? 'immediate' : riskLevel === 'MEDIUM' ? 'soon' : 'none'),
      reasoning: String(parsed.reasoning || parsed.explanation || '').trim() || this._defaultReasoning(riskLevel),
      recommended_action: String(parsed.recommended_action || '').trim() || this._defaultRecommendation(riskLevel)
    });
  }

  _fallbackPayload(message, contextSnippet) {
    const immediate = this._detectImmediateRisk(message);
    if (immediate) {
      return immediate;
    }

    const heuristic = this._detectHeuristicRisk(message, contextSnippet);
    return this._buildPayload({
      risk_level: heuristic.risk_level,
      category: heuristic.category,
      score: heuristic.score,
      severity: heuristic.severity,
      confidence: heuristic.confidence,
      signals_detected: heuristic.signals_detected,
      urgency: heuristic.urgency,
      reasoning: heuristic.reasoning,
      recommended_action: heuristic.recommended_action
    });
  }

  _detectHeuristicRisk(message, contextSnippet) {
    const fullText = `${message} ${contextSnippet}`.toLowerCase();
    const mediumHit = MEDIUM_PATTERNS.find((pattern) => fullText.includes(pattern));

    if (mediumHit) {
      return {
        risk_level: 'MEDIUM',
        category: this._inferCategory(message, contextSnippet, 'MEDIUM'),
        score: 58,
        severity: 'medium',
        confidence: 0.72,
        signals_detected: [mediumHit],
        urgency: 'soon',
        reasoning: 'Passive escape language suggests elevated distress.',
        recommended_action: 'Use a gentle follow-up question and keep the response concise.'
      };
    }

    return {
      risk_level: 'LOW',
      category: 'crisis_escalation',
      score: 18,
      severity: 'low',
      confidence: 0.58,
      signals_detected: [],
      urgency: 'none',
      reasoning: 'No explicit risk markers were detected.',
      recommended_action: 'Continue with supportive exploration and keep the tone steady.'
    };
  }

  _inferCategory(message, contextSnippet, riskLevel) {
    const fullText = `${message} ${contextSnippet}`.toLowerCase();

    if (HIGH_SELF_HARM_PATTERNS.some((pattern) => fullText.includes(pattern))) {
      return 'suicidal_ideation';
    }

    if (ABUSE_PATTERNS.some((pattern) => fullText.includes(pattern))) {
      return 'abuse_trauma';
    }

    if (riskLevel === 'HIGH') {
      return 'crisis_escalation';
    }

    return 'crisis_escalation';
  }

  _normalizeSeverity(severity, score, riskLevel) {
    const normalized = String(severity || '').toLowerCase();
    if (['low', 'medium', 'high', 'critical'].includes(normalized)) {
      return normalized;
    }

    if (riskLevel === 'HIGH') return 'critical';
    if (riskLevel === 'MEDIUM') return 'medium';
    return score >= 80 ? 'high' : 'low';
  }

  _deriveRiskLevel(score, severity, message, contextSnippet) {
    const numericScore = Number(score);
    if (Number.isFinite(numericScore)) {
      if (numericScore >= 70) return 'HIGH';
      if (numericScore >= 40) return 'MEDIUM';
      return 'LOW';
    }

    const normalizedSeverity = String(severity || '').toLowerCase();
    if (normalizedSeverity === 'critical' || normalizedSeverity === 'high') return 'HIGH';
    if (normalizedSeverity === 'medium') return 'MEDIUM';

    const heuristic = this._detectHeuristicRisk(message, contextSnippet);
    return heuristic.risk_level;
  }

  _clampNumber(value, min, max, fallback) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return fallback;
    }
    return Math.min(max, Math.max(min, numeric));
  }

  _defaultReasoning(riskLevel) {
    if (riskLevel === 'HIGH') {
      return 'High-risk language was detected and the safety protocol should be used immediately.';
    }
    if (riskLevel === 'MEDIUM') {
      return 'The message suggests elevated distress and passive escape language.';
    }
    return 'The message reads as low risk.';
  }

  _defaultRecommendation(riskLevel) {
    if (riskLevel === 'HIGH') {
      return 'Use the safety protocol immediately and ask whether the user is safe right now.';
    }
    if (riskLevel === 'MEDIUM') {
      return 'Keep the reply gentle and explore the distress with one focused question.';
    }
    return 'Continue with supportive exploration.';
  }
}

module.exports = new RiskAnalysisServer();
