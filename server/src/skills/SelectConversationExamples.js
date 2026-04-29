const EXAMPLES = require('../data/conversationExamples');

/**
 * Skill: SelectConversationExamples (v2 — Context-Aware)
 *
 * Improvements over v1:
 *  1. Scoring-based tone detection  — no longer binary, scores every tone
 *  2. Emotional intensity detection — selects examples that match message depth
 *  3. Anti-repetition mechanism     — skips recently used example IDs
 *  4. High-risk safety cap          — max 1 example, safety-aligned only
 *  5. Style anchor injected         — explicit "match tone, not words" instruction
 *
 * Interface is unchanged: execute(message, riskLevel, sessionContext?)
 * Future upgrade: replace scoring with embedding similarity search.
 */

// ── 1. Tone scoring vocabulary ─────────────────────────────────────────────
const TONE_KEYWORDS = {
  sadness:      { weight: 1, terms: ['sad', 'empty', 'hopeless', 'grief', 'loss', 'alone', 'lonely', 'isolated', 'depress', 'worthless', 'pointless', 'cry', 'down', 'numb', 'dark'] },
  anxiety:      { weight: 1, terms: ['anxious', 'anxiety', 'worry', 'scared', 'fear', 'panic', 'nervous', 'racing', 'breathe', 'heart pounding', 'control', 'uncertain', 'dread', 'tense'] },
  stress:       { weight: 1, terms: ['overwhelm', 'stress', 'pressure', 'exhaust', 'burnout', 'tired', 'too much', 'drown', 'falling apart', 'responsibilit', 'deadline', 'busy', 'no time'] },
  anger:        { weight: 1, terms: ['angry', 'anger', 'frustrat', 'mad', 'furious', 'resentment', 'resent', 'unfair', 'hate', 'rage', 'irritat'] },
  relationship: { weight: 1, terms: ['partner', 'friend', 'family', 'disconnect', 'misunderstood', 'betrayal', 'trust', 'lonely', 'relationship', 'marriage', 'divorce', 'conflict'] },
  self_worth:   { weight: 1, terms: ['not good enough', 'failure', 'worthless', 'confidence', 'identity', 'lost', 'purpose', 'direction', 'who am i', 'shame', 'guilt', 'inadequate'] }
};

// ── 2. Intensity heuristic vocabulary ─────────────────────────────────────
const HIGH_INTENSITY_MARKERS = [
  "can't", "cannot", 'anymore', 'everything', 'nothing', 'always', 'never',
  'completely', 'absolutely', 'hopeless', 'drowning', 'falling apart', 'killing me',
  'terrifying', 'hate myself', 'no point', 'done', 'exhausted', 'all the time'
];
const LOW_INTENSITY_MARKERS = [
  'sometimes', 'a bit', 'a little', 'sort of', 'kind of', 'manageable',
  'not too bad', 'okay', 'fine', 'slightly', 'occasionally', 'now and then'
];

class SelectConversationExamples {
  /**
   * @param {string} userMessage    - Raw patient message
   * @param {string} riskLevel      - 'LOW' | 'MEDIUM' | 'HIGH'
   * @param {Object} sessionContext - Optional: { usedIds: Set<string> }
   *                                  Pass in and mutate to enable anti-repetition.
   * @returns {string} Formatted few-shot examples string for prompt injection
   */
  execute(userMessage, riskLevel = 'LOW', sessionContext = {}) {
    if (!userMessage) return '';

    const lower = userMessage.toLowerCase();

    // ── Step 1: Score every tone ───────────────────────────────────────────
    const toneScores = {};
    for (const [tone, config] of Object.entries(TONE_KEYWORDS)) {
      const matches = config.terms.filter(term => lower.includes(term)).length;
      toneScores[tone] = matches * config.weight;
    }

    // Pick tones with score > 0, sorted descending
    const activeTones = Object.entries(toneScores)
      .filter(([, score]) => score > 0)
      .sort(([, a], [, b]) => b - a)
      .map(([tone]) => tone);

    // ── Step 2: Detect emotional intensity ────────────────────────────────
    const highCount = HIGH_INTENSITY_MARKERS.filter(m => lower.includes(m)).length;
    const lowCount  = LOW_INTENSITY_MARKERS.filter(m => lower.includes(m)).length;
    const intensity = highCount >= 2 ? 'high' : lowCount >= 2 ? 'low' : 'medium';

    // ── Step 3: Filter candidates ─────────────────────────────────────────
    const usedIds = sessionContext.usedIds instanceof Set ? sessionContext.usedIds : new Set();

    let candidates = EXAMPLES.filter(ex => {
      // HIGH risk: only safetyAligned examples
      if (riskLevel === 'HIGH' && !ex.safetyAligned) return false;
      // Tone match
      const toneMatch = activeTones.length === 0 || ex.tags.some(t => activeTones.includes(t));
      return toneMatch;
    });

    // Prefer intensity-matched examples
    const intensityMatched = candidates.filter(ex => ex.intensity === intensity);
    if (intensityMatched.length >= 2) {
      candidates = intensityMatched;
    }

    // Fallback if nothing matched
    if (candidates.length === 0) {
      candidates = EXAMPLES.filter(ex => ex.tags.includes('general') || !riskLevel || riskLevel === 'LOW');
    }

    // ── Step 4: Anti-repetition — prefer unseen examples ──────────────────
    const unseen = candidates.filter(ex => !usedIds.has(ex.id));
    const pool   = unseen.length > 0 ? unseen : candidates; // fallback to all if exhausted

    // ── Step 5: Safety cap — max 1 example for HIGH risk ──────────────────
    const maxExamples = riskLevel === 'HIGH' ? 1 : riskLevel === 'MEDIUM' ? 2 : 3;

    // Shuffle and slice
    const selected = pool
      .sort(() => 0.5 - Math.random())
      .slice(0, maxExamples);

    // Mark selected IDs as used (mutates caller's Set for persistence)
    selected.forEach(ex => usedIds.add(ex.id));
    if (sessionContext) sessionContext.usedIds = usedIds;

    // ── Step 6: Format with style anchor ──────────────────────────────────
    const examplesText = selected
      .map(ex => `User: ${ex.user}\nAssistant: ${ex.assistant}`)
      .join('\n\n');

    // Style anchor instruction (appended after examples)
    const safetyNote = riskLevel === 'HIGH'
      ? '\nIMPORTANT: Risk level is HIGH. Prioritize safety behavior over stylistic imitation. The example above is for minimal tone reference only.'
      : '';

    return `${examplesText}\n\nStyle anchor: Use the examples above as a reference for tone and empathetic structure. Do not copy them verbatim — match their warmth and open-ended style.${safetyNote}`;
  }
}

module.exports = new SelectConversationExamples();

