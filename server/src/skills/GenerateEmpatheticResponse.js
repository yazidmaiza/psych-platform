const axios = require('axios');
const { ChatGoogleGenerativeAI } = require('@langchain/google-genai');
const { PromptTemplate } = require('@langchain/core/prompts');
const SelectConversationExamples = require('./SelectConversationExamples');

/**
 * Skill: GenerateIntakeResponse (formerly GenerateEmpatheticResponse)
 * Purpose: Generates a stage-aware, RAG-grounded psychological intake response using Gemini,
 *          with Groq fallback and strict post-processing.
 */
class GenerateIntakeResponse {
  async execute(originalInput, contextString, stageConfig, conversationHistory = [], riskLevel = 'LOW', personaInstructions = '') {
    if (!originalInput) {
      throw new Error('GenerateIntakeResponse requires original user input.');
    }

    if (!process.env.GEMINI_API_KEY && !process.env.GROQ_API_KEY) {
      throw new Error('At least one LLM API key is required.');
    }

    const historyText = conversationHistory.length > 0
      ? conversationHistory
          .map((m) => `${m.role === 'user' ? 'PATIENT' : 'ASSISTANT'}: ${m.content}`)
          .join('\n')
      : 'This is the beginning of the conversation.';

    const probesAr = Array.isArray(stageConfig?.probesAr) ? stageConfig.probesAr.join('\n- ') : '';
    const stageGoal = stageConfig?.goalEn || 'Gather information about the patient\'s situation.';
    const stageName = stageConfig?.nameEn || 'Intake';
    const fewShotExamples = SelectConversationExamples.execute(originalInput, riskLevel);

    const promptTemplate = PromptTemplate.fromTemplate(`You are a psychological intake assistant. Your job is to respond naturally, concisely, and specifically to the user's message.

  {personaInstructions}

  === SESSION CONTEXT ===
  Stage Name: {stageName}
  Stage Goal: {stageGoal}
  Risk Level: {riskLevel}
  Suggested probe questions:
  - {probesAr}

  === RAG KNOWLEDGE & CONTEXT ===
  {contextString}

  === CONVERSATION HISTORY (last 8 turns) ===
  {historyText}

  === PATIENT'S CURRENT MESSAGE ===
  {originalInput}

  === RESPONSE RULES (STRICT) ===
  * Do NOT use phrases like "that takes courage", "I'm proud of you", "I hear you saying", or "I'm here for you".
  * Do NOT use generic questions like "tell me more" or "what would you like to explore".
  * Use natural, conversational language (e.g., "Seems like...", "It sounds like...").
  * Response must be concise: max 2 sentences before the question, total response must be short.
  * Structure: 1 acknowledgment (natural, not formulaic), then 1 specific, open-ended question grounded in the user's message. Nothing extra.
  * The question must be specific to the user's message, not generic.
  * Never ask more than one question or use more than one question mark.
  * If risk level is HIGH, respond with a short safety-first reply that acknowledges the user, expresses concern, asks whether they are safe right now, and encourages immediate human support.
  * Detect and use the patient's language (English, French, or Darija).

  === EXAMPLES OF GOOD RESPONSES (STYLE GUIDANCE ONLY — do NOT copy verbatim) ===
  {fewShotExamples}`);

    const formattedPrompt = await promptTemplate.format({
      stageName,
      stageGoal,
      riskLevel,
      probesAr: probesAr || 'Ask open-ended questions about feelings and situation.',
      contextString: contextString || 'No specific context retrieved.',
      historyText,
      originalInput,
      fewShotExamples: fewShotExamples || 'No examples available.',
      personaInstructions: personaInstructions || '(No persona configured — use default warm, empathetic style.)'
    });

    let rawResponse = '';
    try {
      rawResponse = await this._generateWithGemini(formattedPrompt);
    } catch (geminiError) {
      console.warn('[GenerateIntakeResponse] Gemini fallback:', geminiError.message);
      rawResponse = await this._generateWithGroq(formattedPrompt);
    }

    return this._postProcessResponse(rawResponse, originalInput);
  }

  async _generateWithGemini(prompt) {
    const model = new ChatGoogleGenerativeAI({
      modelName: 'gemini-1.5-flash',
      temperature: 0.7,
      apiKey: process.env.GEMINI_API_KEY
    });

    const response = await model.invoke(prompt);
    return this._extractResponseText(response);
  }

  async _generateWithGroq(prompt) {
    if (!process.env.GROQ_API_KEY) {
      throw new Error('GROQ_API_KEY is missing.');
    }

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

    return String(response.data?.choices?.[0]?.message?.content || '');
  }

  _extractResponseText(response) {
    if (typeof response === 'string') {
      return response;
    }

    if (Array.isArray(response)) {
      return response.map((part) => (typeof part === 'string' ? part : part?.text || '')).join(' ');
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

    if (!text) {
      return this._safeFallback(language);
    }

    return this._normalizeTherapeuticResponse(text, fallbackQuestion);
  }

  _normalizeTherapeuticResponse(text, fallbackQuestion, userInput = '') {
    // Remove all praise/validation/over-validation phrases
    let cleaned = String(text || '')
      .replace(/\b(that takes courage|it takes courage|it's brave|it is brave|I am proud of you|I'm proud of you|proud of you|brave of you|I hear you saying|I hear you|It sounds like you're feeling|I'm here for you|tell me more|what would you like to explore|tough time|difficult time|hard time)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();

    // Split into sentences
    let rawSentences = cleaned.match(/[^.!?]+[.!?]*/g) || [cleaned];
    let sentences = rawSentences
      .map((s) => s.trim())
      .filter(Boolean);

    // Remove empty, generic, or praise sentences
    sentences = sentences.filter(s =>
      s.length > 2 &&
      !/^(tell me more|what would you like to explore|that takes courage|it takes courage|it's brave|it is brave|I am proud of you|I'm proud of you|proud of you|brave of you|tough time|difficult time|hard time)$/i.test(s)
    );

    // Mirror user language for acknowledgment if possible
    let mirrored = '';
    if (userInput) {
      // Try to extract a key phrase from user input
      let match = userInput.match(/I'm not ok|I am not ok|not okay|not ok|I feel ([^.,!?]+)/i);
      if (match) {
        if (match[1]) {
          mirrored = `Something’s not okay for you about ${match[1].trim()}`;
        } else {
          mirrored = `Something’s not okay for you.`;
        }
      }
    }

    // Replace formulaic with natural phrasing
    sentences = sentences.map(s =>
      s.replace(/^(I hear you saying|It sounds like you're feeling)/i, match =>
        match.toLowerCase().includes('feeling') ? 'It sounds like' : 'Seems like'
      )
    );

    // Remove redundancy: keep only the first acknowledgment/observation
    let questionIdx = sentences.findIndex(s => s.includes('?'));
    let ack = mirrored || (sentences.length > 0 ? sentences[0] : '');
    let question = '';
    if (questionIdx === -1) {
      // No question found, add fallback
      question = fallbackQuestion.replace(/[.!?]+$/g, '');
    } else {
      question = sentences[questionIdx];
    }

    // Shorten the question: keep only the first clause, max 9 words
    question = question.split(/,| and | but | so that | because | although | though | while | as if | as though/i)[0].trim();
    let qWords = question.split(' ');
    if (qWords.length > 9) {
      question = qWords.slice(0, 9).join(' ');
      if (!question.endsWith('?')) question += '?';
    }
    // Ensure question ends with ?
    question = question.replace(/[.!?]+$/g, '') + '?';

    // Minimal structure: 1 short acknowledgment, 1 short question
    let result = '';
    if (ack) {
      // Shorten acknowledgment: keep only the first clause, max 10 words
      let ackShort = ack.split(/,| and | but | so that | because | although | though | while | as if | as though/i)[0].trim();
      let aWords = ackShort.split(' ');
      if (aWords.length > 10) {
        ackShort = aWords.slice(0, 10).join(' ');
        if (!ackShort.endsWith('.')) ackShort += '.';
      }
      ackShort = ackShort.replace(/[.!?]+$/g, '') + '.';
      result = ackShort + ' ' + question;
    } else {
      result = question;
    }
    return result.replace(/\s+/g, ' ').trim();
  }

  _safeFallback(language) {
    const replies = {
      english: 'I am here with you. What feels most important to explore right now?',
      french: 'Je suis là avec vous. Qu\'est-ce qui vous semble le plus important à explorer maintenant ?',
      darija: 'أنا معاك. شنوة أكثر حاجة مهمة تحب نحكيو عليها توّا؟'
    };

    return replies[language] || replies.english;
  }

  _fallbackQuestion(language) {
    const questions = {
      english: 'What feels most important to explore right now?',
      french: 'Qu\'est-ce qui vous semble le plus important à explorer maintenant ?',
      darija: 'شنوة أكثر حاجة مهمة تحب نحكيو عليها توّا؟'
    };

    return questions[language] || questions.english;
  }

  _detectLanguage(text = '') {
    const value = String(text || '');

    if (/[\u0600-\u06FF]/.test(value)) {
      return 'darija';
    }

    if (/\b(je|j\'|vous|merci|suis|pas|mon|ma|bizarre|fatigu[eé])\b/i.test(value)) {
      return 'french';
    }

    if (/\b(tawa|chnowa|shnoua|bech|nheb|nhess|mouch|barsha|brcha|yaani|3lech|9bal|fiha)\b/i.test(value)) {
      return 'darija';
    }

    return 'english';
  }
}

module.exports = new GenerateIntakeResponse();