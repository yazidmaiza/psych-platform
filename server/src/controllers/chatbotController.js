const axios = require('axios');
const ChatbotMessage = require('../models/ChatbotMessage');
const ChatbotSummary = require('../models/ChatbotSummary');
const Session = require('../models/Session');

const parseJsonFromModel = (rawContent) => {
  if (typeof rawContent !== 'string') throw new Error('Invalid model response');
  const cleanContent = rawContent.replace(/```json|```/g, '').trim();
  try {
    return JSON.parse(cleanContent);
  } catch {
    const start = cleanContent.indexOf('{');
    const end = cleanContent.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) throw new Error('Failed to parse JSON');
    return JSON.parse(cleanContent.slice(start, end + 1));
  }
};

const buildConversationText = (history) => {
  return history
    .map((msg) => `${msg.role.toUpperCase()}: ${msg.content}`)
    .join('\n');
};

const generateSummaryForPatient = async ({ patientId, includeRecommendations }) => {
  const history = await ChatbotMessage.find({ userId: patientId }).sort({ createdAt: 1 });
  if (history.length === 0) return null;

  const conversationText = buildConversationText(history);

  const summaryResponse = await axios.post(
    'https://api.groq.com/openai/v1/chat/completions',
    {
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: 'You are a clinical assistant. You must respond with ONLY a valid JSON object, no other text, no explanation, no markdown. The JSON must have exactly these fields: {"dominantEmotion": "one word", "urgencyScore": 1, "sentimentTrend": "improving", "keyThemes": ["theme1"], "rawSummary": "summary text"}' },
        { role: 'user', content: `Summarize this conversation:\n\n${conversationText}` }
      ],
      temperature: 0.3,
      max_tokens: 500
    },
    { headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' } }
  );

  const parsed = parseJsonFromModel(summaryResponse.data?.choices?.[0]?.message?.content);

  if (parsed.urgencyScore < 1) parsed.urgencyScore = 1;
  if (parsed.urgencyScore > 5) parsed.urgencyScore = 5;

  const baseUpdate = {
    patientId,
    emotionalIndicators: {
      dominantEmotion: parsed.dominantEmotion,
      urgencyScore: parsed.urgencyScore,
      sentimentTrend: parsed.sentimentTrend
    },
    keyThemes: parsed.keyThemes,
    rawSummary: parsed.rawSummary
  };

  const summary = await ChatbotSummary.findOneAndUpdate(
    { patientId },
    baseUpdate,
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  if (includeRecommendations) {
    let recommendations = [];
    try {
      const recommendationResponse = await axios.post(
        'https://api.groq.com/openai/v1/chat/completions',
        {
          model: 'llama-3.3-70b-versatile',
          messages: [
            {
              role: 'system',
              content: 'You are a clinical assistant. Based on the patient summary provided, generate exactly 5 specific follow-up questions the psychologist should ask in the real consultation. Return ONLY a JSON array of 5 strings. No other text.'
            },
            {
              role: 'user',
              content: 'Patient summary: ' + parsed.rawSummary + '\nDominant emotion: ' + parsed.dominantEmotion + '\nKey themes: ' + (Array.isArray(parsed.keyThemes) ? parsed.keyThemes.join(', ') : '')
            }
          ],
          temperature: 0.3,
          max_tokens: 500
        },
        {
          headers: {
            Authorization: 'Bearer ' + process.env.GROQ_API_KEY,
            'Content-Type': 'application/json'
          }
        }
      );

      const rawRec = recommendationResponse.data?.choices?.[0]?.message?.content;
      const cleanRec = String(rawRec || '').replace(/```json|```/g, '').trim();
      recommendations = JSON.parse(cleanRec);
    } catch {
      recommendations = [];
    }

    await ChatbotSummary.findByIdAndUpdate(summary._id, { recommendations });
  }

  return await ChatbotSummary.findOne({ patientId });
};

exports.sendMessage = async (req, res) => {
  try {
    const { message } = req.body;
    if (req.user.role !== 'patient') {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    const patientId = req.user.id;

    const systemPrompt = `You are a compassionate listening assistant. The patient wants to express themselves freely.
Let them lead the conversation. Ask gentle follow-up questions to help them explore their feelings more deeply.
Be fully present and non-judgmental. Never provide medical diagnoses or suggest medications.
Never rush the patient or redirect them unless they ask for guidance.
IMPORTANT: Always detect the language the patient is writing in and respond in the SAME language. If the patient writes in Arabic, respond in Arabic. If in French, respond in French. If in English, respond in English. Never switch languages unless the patient does.`;

    const history = await ChatbotMessage.find({ userId: patientId }).sort({ createdAt: 1 }).limit(100);

    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.map(msg => ({ role: msg.role, content: msg.content })),
      { role: 'user', content: message }
    ];

    await ChatbotMessage.create({ userId: patientId, role: 'user', content: message });

    const groqResponse = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      { model: 'llama-3.3-70b-versatile', messages, temperature: 0.7, max_tokens: 300 },
      { headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' } }
    );
    const reply = groqResponse.data.choices[0].message.content;
    
    await ChatbotMessage.create({ userId: patientId, role: 'assistant', content: reply });
    res.status(200).json({ reply });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.endSession = async (req, res) => {
  try {
    if (req.user.role !== 'patient') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const patientId = req.user.id;
    const summary = await generateSummaryForPatient({ patientId, includeRecommendations: true });
    
    if (!summary) return res.status(400).json({ message: 'No conversation to summarize' });

    res.status(200).json({ summary });
  } catch (err) {
    console.log('endSession error:', err.message);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.getSummary = async (req, res) => {
  try {
    let patientId = req.user.id;
    if (req.user.role === 'psychologist' || req.user.role === 'admin') {
      patientId = req.query.patientId || req.user.id; // optionally use query param if provided
    } else if (req.user.role !== 'patient') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const summary = await ChatbotSummary.findOne({ patientId });
    if (!summary) return res.status(404).json({ message: 'Summary not found' });
    res.status(200).json(summary);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.getMessages = async (req, res) => {
  try {
    const patientId = req.user.id;
    if (req.user.role !== 'patient') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const messages = await ChatbotMessage.find({ userId: patientId })
      .sort({ createdAt: 1 })
      .limit(500)
      .select('role content createdAt');

    res.status(200).json(messages);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.generateLogoutSummaries = async (req, res) => {
  try {
    if (req.user.role !== 'patient') return res.status(403).json({ message: 'Access denied' });

    const summary = await generateSummaryForPatient({ patientId: req.user.id, includeRecommendations: true });

    res.status(200).json({ summary });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};
