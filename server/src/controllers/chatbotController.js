const axios = require('axios');
const ChatbotMessage = require('../models/ChatbotMessage');
const ChatbotSummary = require('../models/ChatbotSummary');
const Session = require('../models/Session');

const getSystemPrompt = (sessionType) => {
    const prompts = {
        preparation: `You are a compassionate assistant helping a patient prepare for their first psychology consultation.
Ask one focused question at a time about their main concern, emotional state, sleep, daily functioning, and what they hope to achieve.
Be warm and non-judgmental. Never provide medical diagnoses or suggest medications.
Your goal is to help the patient articulate their difficulties clearly before meeting their psychologist.`,

        followup: `You are a supportive assistant checking in with a patient between psychology sessions.
Ask about their emotional progress since the last session, any changes in their situation, what strategies have been helpful, and any new challenges.
Ask one question at a time. Be encouraging and empathetic. Never provide medical diagnoses or suggest medications.`,

        free: `You are a compassionate listening assistant. The patient wants to express themselves freely.
Let them lead the conversation. Ask gentle follow-up questions to help them explore their feelings more deeply.
Be fully present and non-judgmental. Never provide medical diagnoses or suggest medications.
Never rush the patient or redirect them unless they ask for guidance.`
    };
    return prompts[sessionType] || prompts.free;
};

// @POST /api/chatbot/:sessionId/chatbot
exports.sendMessage = async (req, res) => {
    try {
        const { message } = req.body;
        const sessionId = req.params.id;
        const session = await Session.findById(sessionId);
        if (!session) {
            return res.status(404).json({ message: 'Session not found' });
        }
        const history = await ChatbotMessage.find({ sessionId })
            .sort({ createdAt: 1 })
            .limit(20);
        const messages = [
            { role: 'system', content: getSystemPrompt(session.sessionType) },
            ...history.map(msg => ({ role: msg.role, content: msg.content })),
            { role: 'user', content: message }
        ];
        const groqResponse = await axios.post(
            'https://api.groq.com/openai/v1/chat/completions',
            {
                model: 'llama-3.1-8b-instant',
                messages,
                temperature: 0.7,
                max_tokens: 300
            },
            {
                headers: {
                    Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        const reply = groqResponse.data.choices[0].message.content;
        await ChatbotMessage.create({ sessionId, role: 'user', content: message });
        await ChatbotMessage.create({ sessionId, role: 'assistant', content: reply });
        res.status(200).json({ reply });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

// @POST /api/chatbot/:sessionId/chatbot/end
exports.endSession = async (req, res) => {
    try {
        const sessionId = req.params.id;
        const session = await Session.findById(sessionId);
        if (!session) {
            return res.status(404).json({ message: 'Session not found' });
        }
        const history = await ChatbotMessage.find({ sessionId }).sort({ createdAt: 1 });
        if (history.length === 0) {
            return res.status(400).json({ message: 'No conversation to summarize' });
        }
        const conversationText = history
            .map(msg => `${msg.role === 'user' ? 'Patient' : 'Assistant'}: ${msg.content}`)
            .join('\n');
        const summaryResponse = await axios.post(
            'https://api.groq.com/openai/v1/chat/completions',
            {
                model: 'llama-3.1-8b-instant',
                messages: [
                    {
                        role: 'system',
                        content: `You are a clinical assistant that summarizes patient conversations for psychologists.
Analyze the conversation and return ONLY a valid JSON object with this exact structure:
{
  "dominantEmotion": "one word emotion (anxiety, sadness, anger, fear, confusion, loneliness)",
  "urgencyScore": number between 1 and 5,
  "sentimentTrend": "improving or stable or declining",
  "keyThemes": ["theme1", "theme2", "theme3"],
  "rawSummary": "2-3 sentence professional summary of the patient's state and main concerns"
}
Return only the JSON. No extra text.`
                    },
                    {
                        role: 'user',
                        content: `Summarize this conversation:\n\n${conversationText}`
                    }
                ],
                temperature: 0.3,
                max_tokens: 500
            },
            {
                headers: {
                    Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );
        const rawContent = summaryResponse.data.choices[0].message.content;
        const parsed = JSON.parse(rawContent);
        const summary = await ChatbotSummary.create({
            sessionId,
            patientId: session.patientId,
            emotionalIndicators: {
                dominantEmotion: parsed.dominantEmotion,
                urgencyScore: parsed.urgencyScore,
                sentimentTrend: parsed.sentimentTrend
            },
            keyThemes: parsed.keyThemes,
            rawSummary: parsed.rawSummary
        });
        await Session.findByIdAndUpdate(sessionId, { status: 'completed' });
        res.status(200).json({ summary });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

// @GET /api/chatbot/:sessionId/summary
exports.getSummary = async (req, res) => {
    try {
        const summary = await ChatbotSummary.findOne({ sessionId: req.params.id });
        if (!summary) {
            return res.status(404).json({ message: 'Summary not found' });
        }
        res.status(200).json(summary);
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};