const axios = require('axios');
const { ChatGoogleGenerativeAI } = require('@langchain/google-genai');
const { PromptTemplate } = require('@langchain/core/prompts');
const SelectConversationExamples = require('./SelectConversationExamples');

// Shared retry utility (DRY — extracted from chatRoute.js + this file)
const { withRetry } = require('../utils/withRetry');

// ─────────────────────────────────────────────────────────────────────────────
// Stage-specific disclosure linking instructions
// ─────────────────────────────────────────────────────────────────────────────
//
// These tell the LLM *how* to use earlier disclosures at each stage.
// Injected into the prompt only when a contextSummary exists.
// Kept here (not in the prompt string) so they're easy to tune per stage
// without touching the template structure.
//
const STAGE_LINKING_INSTRUCTIONS = {
  1: '', // Concern stage — no earlier context to link back to yet
  2: `You are now in the Feelings stage. If the patient's current message connects
to concerns they raised earlier (visible in the Earlier Conversation Summary),
acknowledge that connection naturally. Example: "Earlier you mentioned [paraphrase
of concern] — it sounds like that's been weighing on you emotionally too."`,

  3: `You are now in the History stage. Actively scan the Earlier Conversation
Summary for the patient's primary concern from stage 1. When relevant, link the
current message back to it. Example: "You mentioned earlier that [paraphrase of
concern] — has this been something you've experienced before, or is it new?"
Do not re-ask what the concern is — you already know it. Build on it.`,

  4: `You are now in the Impact stage. Scan the Earlier Conversation Summary for
both the patient's concern (stage 1) and their emotional state (stage 2). Connect
the current message to what you already know about how this has been affecting
them. Example: "Given what you shared about [paraphrase of feeling or concern],
how has this been showing up in [specific life domain — work, relationships,
daily routine]?" Avoid generic impact questions if specific context is available.`,

  5: `You are now in the Closing stage. Synthesize what you know from the Earlier
Conversation Summary and the recent history. Acknowledge the arc of what the
patient has shared across the session. Example: "Across our conversation you've
shared [brief paraphrase of 2-3 key themes] — is there anything important you
feel hasn't come up yet?" Do not introduce new topics. Help the patient feel heard
and prepare them for their psychologist session.`
};

/**
 * Skill: GenerateIntakeResponse (formerly GenerateEmpatheticResponse)
 *
 * Rolling Context Window:
 *   contextSummary (7th param) is a compressed clinical summary of turns older
 *   than the recent 8-turn window. When present:
 *     1. Injected into the prompt BEFORE the recent history (prevents loss of
 *        early disclosures like trauma or suicidal ideation).
 *     2. A DISCLOSURE LINKING GUIDE is injected alongside it with stage-specific
 *        instructions for how to actively reference earlier disclosures —
 *        not just avoid repeating them.
 *
 * Failure chain: Gemini (3 retries) → Groq (3 retries) → throw
 */
class GenerateIntakeResponse {
  /**
   * @param {string}      originalInput       - Current patient message
   * @param {string}      contextString       - RAG + manipulation context
   * @param {object}      stageConfig         - Current intake stage config
   * @param {Array}       conversationHistory - Last N verbatim turns
   * @param {string}      riskLevel           - Current risk level
   * @param {string}      personaInstructions - Built persona system prompt
   * @param {string|null} contextSummary      - Compressed summary of earlier turns
   */
  async execute(
    originalInput,
    contextString,
    stageConfig,
    conversationHistory = [],
    riskLevel = 'LOW',
    personaInstructions = '',
    contextSummary = null,
    sessionContext = {}
  ) {
    if (!originalInput) {
      throw new Error('GenerateIntakeResponse requires original user input.');
    }
    if (!process.env.GEMINI_API_KEY && !process.env.GROQ_API_KEY) {
      throw new Error('At least one LLM API key is required.');
    }

    // ── Build history block ──────────────────────────────────────────────
    const historyText = conversationHistory.length > 0
      ? conversationHistory
          .map(m => `${m.role === 'user' ? 'PATIENT' : 'ASSISTANT'}: ${m.content}`)
          .join('\n')
      : 'This is the beginning of the conversation.';

    // ── Build early-context block + disclosure linking guide ─────────────
    //
    // When contextSummary exists the prompt gets two related sections:
    //
    //   EARLIER CONVERSATION SUMMARY
    //     → The compressed clinical record of what was said before
    //       the recent 8-turn window. The LLM treats this as established
    //       fact — it should not re-ask about anything here.
    //
    //   DISCLOSURE LINKING GUIDE
    //     → Stage-specific active instructions for how to weave earlier
    //       disclosures into the current response. This is the key addition:
    //       previously the prompt only said "don't re-ask", which is passive.
    //       Now it says "actively connect current message to what came before."
    //
    // Both sections are empty string when contextSummary is null, keeping
    // the prompt clean for short conversations.
    //
    const stageNumber       = stageConfig?.stageNumber || stageConfig?.stage || 1;
    const linkingInstruction = contextSummary
      ? (STAGE_LINKING_INSTRUCTIONS[stageNumber] || '')
      : '';

    const earlyContextBlock = contextSummary
      ? `=== EARLIER CONVERSATION SUMMARY ===
The following is a compressed clinical summary of exchanges that occurred
before the recent conversation window. Treat this as established context.
Do NOT re-ask about anything already covered here.

${contextSummary}

${linkingInstruction
  ? `=== DISCLOSURE LINKING GUIDE ===
${linkingInstruction}

When weaving in earlier disclosures:
- Paraphrase, never quote the patient's exact words back verbatim.
- Use natural bridging phrases: "Earlier you mentioned…", "You brought up…",
  "Given what you shared about…", "It sounds like this connects to…"
- Only link when it genuinely adds to the current response — do not force it.
- One connection per response maximum. Do not list everything from the summary.

`
  : ''}
`
      : '';

    const probesAr        = Array.isArray(stageConfig?.probesAr) ? stageConfig.probesAr.join('\n- ') : '';
    const stageGoal       = stageConfig?.goalEn || "Gather information about the patient's situation.";
    const stageName       = stageConfig?.nameEn || 'Intake';
    const fewShotExamples = SelectConversationExamples.execute(originalInput, riskLevel, sessionContext);

    // ── Prompt template ──────────────────────────────────────────────────
    // LLM reads context in this order:
    //   1. Persona + stage goal
    //   2. RAG / knowledge base
    //   3. Earlier conversation summary + disclosure linking guide
    //   4. Recent verbatim turns
    //   5. Current patient message
    //   6. Response rules (now includes active disclosure linking rules)
    const promptTemplate = PromptTemplate.fromTemplate(
`You are a psychological intake assistant. Your job is to respond naturally, concisely, and specifically to the user's message.

{personaInstructions}

=== SESSION CONTEXT ===
Stage Name: {stageName}
Stage Goal: {stageGoal}
Risk Level: {riskLevel}
Suggested probe questions:
- {probesAr}

=== RAG KNOWLEDGE & CONTEXT ===
{contextString}

{earlyContextBlock}=== RECENT CONVERSATION HISTORY ===
{historyText}

=== PATIENT'S CURRENT MESSAGE ===
{originalInput}

=== RESPONSE RULES (STRICT) ===
* Do NOT use phrases like "that takes courage", "I'm proud of you", "I hear you saying", or "I'm here for you".
* Do NOT use generic questions like "tell me more" or "what would you like to explore".
* Do NOT re-ask about topics already covered in the Earlier Conversation Summary above.
* When an Earlier Conversation Summary exists, actively look for connections between the patient's current message and what they shared earlier. Weave those connections in naturally — do not ignore prior disclosures.
* Paraphrase earlier disclosures — never quote the patient's exact words back verbatim. Reflection should show understanding, not just recall.
* Use natural, conversational language (e.g., "Seems like...", "It sounds like...", "Earlier you mentioned...").
* Response must be concise: max 2 sentences before the question, total response must be short.
* Structure: 1 acknowledgment (natural, not formulaic — may reference earlier disclosure if relevant), then 1 specific, open-ended question grounded in the user's message. Nothing extra.
* The question must be specific to the user's message, not generic.
* Never ask more than one question or use more than one question mark.
* If risk level is HIGH, respond with a short safety-first reply that acknowledges the user, expresses concern, asks whether they are safe right now, and encourages immediate human support.
* Detect and use the patient's language (English, French, or Darija).

=== EXAMPLES OF GOOD RESPONSES (STYLE GUIDANCE ONLY — do NOT copy verbatim) ===
{fewShotExamples}`
    );

    const formattedPrompt = await promptTemplate.format({
      stageName,
      stageGoal,
      riskLevel,
      probesAr:            probesAr || 'Ask open-ended questions about feelings and situation.',
      contextString:       contextString || 'No specific context retrieved.',
      earlyContextBlock,
      historyText,
      originalInput,
      fewShotExamples:     fewShotExamples || 'No examples available.',
      personaInstructions: personaInstructions || '(No persona configured — use default warm, empathetic style.)'
    });

    // ── LLM generation: Gemini (primary) → Groq (fallback) ───────────────
    let rawResponse = '';
    try {
      rawResponse = await this._generateWithGemini(formattedPrompt);
    } catch (geminiError) {
      console.warn('[GenerateIntakeResponse] Gemini failed after retries, falling back to Groq:', geminiError.message);
      rawResponse = await this._generateWithGroq(formattedPrompt);
    }

    return this._postProcessResponse(rawResponse, originalInput);
  }

  // ── LLM providers ────────────────────────────────────────────────────────

  async _generateWithGemini(prompt) {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY not set — skipping Gemini');
    }
    return withRetry(
      async () => {
        const model = new ChatGoogleGenerativeAI({
          modelName: 'gemini-1.5-flash',
          temperature: 0.7,
          apiKey: process.env.GEMINI_API_KEY
        });
        const response = await model.invoke(prompt);
        const text = this._extractResponseText(response);
        if (!text) throw new Error('Gemini returned empty response');
        return text;
      },
      { maxAttempts: 3, baseDelayMs: 1000, factor: 2 },
      'GenerateIntakeResponse._generateWithGemini'
    );
  }

  async _generateWithGroq(prompt) {
    // [DATA: PHI — patient intake prompt (may contain mental health disclosures).
    // Sent to Groq Cloud API as fallback LLM. Ensure Groq DPA is in place.]
    if (!process.env.GROQ_API_KEY) {
      throw new Error('GROQ_API_KEY is missing and Gemini also failed — no LLM available.');
    }
    return withRetry(
      async () => {
        const response = await axios.post(
          'https://api.groq.com/openai/v1/chat/completions',
          {
            model: 'llama-3.3-70b-versatile',
            messages: [
              {
                role: 'system',
                content: 'You are a psychological intake assistant. Follow the prompt exactly and keep the response to 2-3 sentences with exactly one question.'
              },
              { role: 'user', content: prompt }
            ],
            temperature: 0.7,
            max_tokens: 220
          },
          {
            headers: {
              Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
              'Content-Type': 'application/json'
            }
          }
        );
        const text = String(response.data?.choices?.[0]?.message?.content || '');
        if (!text) throw new Error('Groq returned empty response');
        return text;
      },
      { maxAttempts: 3, baseDelayMs: 1000, factor: 2 },
      'GenerateIntakeResponse._generateWithGroq'
    );
  }

  // ── Response extraction & post-processing ────────────────────────────────

  _extractResponseText(response) {
    if (typeof response === 'string') return response;
    if (Array.isArray(response)) {
      return response.map(part => (typeof part === 'string' ? part : part?.text || '')).join(' ');
    }
    return String(response?.content || response?.text || response || '');
  }

  _postProcessResponse(rawResponse, originalInput) {
    const language = this._detectLanguage(originalInput);
    const fallbackQuestion = this._fallbackQuestion(language);

    let text = String(rawResponse || '')
      .replace(/```json|```/gi, '')
      .replace(/^[\s>*-]+/gm, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (!text) return this._safeFallback(language);

    // Strip any sentences that contain hallucinated clinical claims
    text = this._hallucinationFilter(text);
    if (!text) return this._safeFallback(language);

    return this._normalizeTherapeuticResponse(text, fallbackQuestion);
  }

  _normalizeTherapeuticResponse(text, fallbackQuestion, userInput = '') {
    let cleaned = String(text || '')
      .replace(/\b(that takes courage|it takes courage|it's brave|it is brave|I am proud of you|I'm proud of you|proud of you|brave of you|I hear you saying|I hear you|It sounds like you're feeling|I'm here for you|tell me more|what would you like to explore|tough time|difficult time|hard time)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    let rawSentences = cleaned.match(/[^.!?]+[.!?]*/g) || [cleaned];
    let sentences = rawSentences.map(s => s.trim()).filter(Boolean);

    sentences = sentences.filter(s =>
      s.length > 2 &&
      !/^(tell me more|what would you like to explore|that takes courage|it takes courage|it's brave|it is brave|I am proud of you|I'm proud of you|proud of you|brave of you|tough time|difficult time|hard time)$/i.test(s)
    );

    let mirrored = '';
    if (userInput) {
      let match = userInput.match(/I'm not ok|I am not ok|not okay|not ok|I feel ([^.,!?]+)/i);
      if (match) {
        mirrored = match[1]
          ? `Something's not okay for you about ${match[1].trim()}`
          : `Something's not okay for you.`;
      }
    }

    sentences = sentences.map(s =>
      s.replace(/^(I hear you saying|It sounds like you're feeling)/i, match =>
        match.toLowerCase().includes('feeling') ? 'It sounds like' : 'Seems like'
      )
    );

    let questionIdx = sentences.findIndex(s => s.includes('?'));
    let ack = mirrored;
    if (!ack && sentences.length > 0) {
      // Find the first sentence that is not a question
      const nonQuestion = sentences.find(s => !s.includes('?'));
      if (nonQuestion) {
        ack = nonQuestion;
      }
    }

    let question = '';
    if (questionIdx === -1) {
      question = fallbackQuestion;
    } else {
      question = sentences[questionIdx];
    }

    // Ensure the question ends with a question mark
    if (question && !question.endsWith('?')) {
      question = question.replace(/[.!?]+$/g, '') + '?';
    }

    // Ensure the acknowledgment ends with a period
    if (ack && !ack.endsWith('.')) {
      ack = ack.replace(/[.!?]+$/g, '') + '.';
    }

    let result = ack ? `${ack} ${question}` : question;
    return result.replace(/\s+/g, ' ').trim();
  }

  // ── Hallucination guardrail ─────────────────────────────────────────────
  //
  // Strips sentences containing confident clinical claims that the LLM
  // could not have grounded in the RAG context:
  //   - Specific medication names (common psychiatric drugs)
  //   - Diagnostic label assertions ("you have X disorder")
  //   - Fabricated statistics ("studies show X%")
  //   - Dosage language ("take X mg")
  //
  // Sentence-level filtering: only the offending sentence is removed, not
  // the whole response. Logs a warning so prompt issues can be tracked.
  //
  _hallucinationFilter(text) {
    const MEDICATION_NAMES = [
      'prozac', 'fluoxetine', 'lexapro', 'escitalopram', 'zoloft', 'sertraline',
      'effexor', 'venlafaxine', 'wellbutrin', 'bupropion', 'celexa', 'citalopram',
      'paxil', 'paroxetine', 'cymbalta', 'duloxetine', 'xanax', 'alprazolam',
      'valium', 'diazepam', 'klonopin', 'clonazepam', 'ativan', 'lorazepam',
      'ritalin', 'methylphenidate', 'adderall', 'amphetamine', 'lithium',
      'risperdal', 'risperidone', 'seroquel', 'quetiapine', 'abilify', 'aripiprazole',
      'zyprexa', 'olanzapine', 'haldol', 'haloperidol', 'lamictal', 'lamotrigine',
      'depakote', 'valproate'
    ];

    const DIAGNOSIS_PATTERNS = [
      /\b(?:you have|you are diagnosed with|you suffer from|you\s+(?:likely|clearly|definitely)\s+have)\s+(?:major depressive disorder|bipolar|schizophrenia|borderline personality|ocd|ptsd|anxiety disorder|panic disorder|adhd)/i,
      /\b(?:this (?:is|sounds like)|that (?:is|sounds like))\s+(?:major depressive disorder|bipolar disorder|schizophrenia|borderline personality disorder)/i
    ];

    const FABRICATED_STAT_PATTERN = /\b(?:studies?|research|data)\s+(?:show|suggest|indicate|find|found|report)s?\s+(?:that\s+)?\d+(?:\.\d+)?\s*%/i;
    const DOSAGE_PATTERN = /\b\d+\s*mg\b|\btake\s+\d+\s*(?:mg|milligram)/i;

    // Split into sentences, filter bad ones
    const sentences = text.match(/[^.!?]+[.!?]*/g) || [text];
    const cleaned = sentences.filter(sentence => {
      const s = sentence.toLowerCase();

      // Check medication names
      if (MEDICATION_NAMES.some(drug => s.includes(drug))) {
        console.warn('[HallucinationGuard] Stripped medication reference:', sentence.trim());
        return false;
      }
      // Check diagnosis assertions
      if (DIAGNOSIS_PATTERNS.some(p => p.test(sentence))) {
        console.warn('[HallucinationGuard] Stripped diagnosis assertion:', sentence.trim());
        return false;
      }
      // Check fabricated statistics
      if (FABRICATED_STAT_PATTERN.test(sentence)) {
        console.warn('[HallucinationGuard] Stripped fabricated statistic:', sentence.trim());
        return false;
      }
      // Check dosage language
      if (DOSAGE_PATTERN.test(sentence)) {
        console.warn('[HallucinationGuard] Stripped dosage language:', sentence.trim());
        return false;
      }
      return true;
    });

    return cleaned.join(' ').replace(/\s+/g, ' ').trim();
  }

  // ── Fallbacks ───────────────────────────────────────────────────────────

  _safeFallback(language) {
    const replies = {
      english: 'I am here with you. What feels most important to explore right now?',
      french:  "Je suis là avec vous. Qu'est-ce qui vous semble le plus important à explorer maintenant ?",
      darija:  'أنا معاك. شنوة أكثر حاجة مهمة تحب نحكيو عليها توّا؟'
    };
    return replies[language] || replies.english;
  }

  _fallbackQuestion(language) {
    const questions = {
      english: 'What feels most important to explore right now?',
      french:  "Qu'est-ce qui vous semble le plus important à explorer maintenant ?",
      darija:  'شنوة أكثر حاجة مهمة تحب نحكيو عليها توّا؟'
    };
    return questions[language] || questions.english;
  }

  _detectLanguage(text = '') {
    const value = String(text || '');
    if (/[\u0600-\u06FF]/.test(value)) return 'darija';
    if (/\b(je|j'|vous|merci|suis|pas|mon|ma|bizarre|fatigu[eé])\b/i.test(value)) return 'french';
    if (/\b(tawa|chnowa|shnoua|bech|nheb|nhess|mouch|barsha|brcha|yaani|3lech|9bal|fiha)\b/i.test(value)) return 'darija';
    return 'english';
  }
}

module.exports = new GenerateIntakeResponse();