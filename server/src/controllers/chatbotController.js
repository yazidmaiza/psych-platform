const axios = require('axios');
const PDFDocument = require('pdfkit');
const ChatbotMessage = require('../models/ChatbotMessage');
const ChatbotSummary = require('../models/ChatbotSummary');
const IntakeSession = require('../models/IntakeSession');
const Session = require('../models/Session');
const User = require('../models/User');
const EmotionalIndicator = require('../models/EmotionalIndicator');
const ChatbotReport = require('../models/ChatbotReport');
const { createNotification } = require('../services/notificationService');
const { sha256, resolvePrivatePath, writeFileAtomic } = require('../services/ttsStorage');
const chatWorkflow = require('../workflows/chatRoute');

const getApiBaseUrl = () => {
  const envUrl = String(process.env.API_BASE_URL || '').trim();
  if (envUrl) return envUrl.replace(/\/+$/, '');
  return 'http://localhost:5000';
};

const getClientUrl = () => {
  const envUrl = String(process.env.CLIENT_URL || '').trim();
  if (envUrl) return envUrl.replace(/\/+$/, '');
  return 'http://localhost:3000';
};

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

const scoreFromSummary = (summary) => {
  const dominant = String(summary?.emotionalIndicators?.dominantEmotion || '').toLowerCase();
  const urgency = Number(summary?.emotionalIndicators?.urgencyScore) || 1;
  const trend = String(summary?.emotionalIndicators?.sentimentTrend || '').toLowerCase();
  const themes = Array.isArray(summary?.keyThemes) ? summary.keyThemes.map((t) => String(t).toLowerCase()) : [];

  const base = Math.max(1, Math.min(5, urgency)) * 15; // 15..75 baseline stress intensity

  const has = (words) => words.some((w) => dominant.includes(w) || themes.some((t) => t.includes(w)));

  let anxiety = base;
  let sadness = base * 0.8;
  let anger = base * 0.7;
  let positivity = 40;

  if (trend === 'improving') positivity = 70;
  if (trend === 'declining') positivity = 25;
  if (trend === 'stable') positivity = 50;

  if (has(['anx', 'worry', 'fear', 'panic', 'stress'])) anxiety += 25;
  if (has(['sad', 'depress', 'grief', 'loss', 'hopeless'])) sadness += 25;
  if (has(['anger', 'angry', 'rage', 'frustrat', 'irrit'])) anger += 25;
  if (has(['happy', 'hope', 'relief', 'calm', 'confiden'])) positivity += 15;

  // If dominant emotion is clearly positive, reduce distress scores.
  if (has(['happy', 'relief', 'calm', 'content', 'grateful'])) {
    anxiety -= 10;
    sadness -= 10;
    anger -= 10;
  }

  const clamp100 = (n) => Math.max(0, Math.min(100, Math.round(n)));

  return {
    anxiety: clamp100(anxiety),
    sadness: clamp100(sadness),
    anger: clamp100(anger),
    positivity: clamp100(positivity)
  };
};

const upsertEmotionalIndicatorForLatestSession = async ({ patientId, summary }) => {
  const session = await Session.findOne({
    patientId,
    status: {
      $in: ['active', 'completed', 'verified', 'paid', 'pending_payment', 'pending', 'requested']
    }
  }).sort({ createdAt: -1 });

  if (!session) return null;

  const scores = scoreFromSummary(summary);

  return EmotionalIndicator.findOneAndUpdate(
    {
      patientId,
      psychologistId: session.psychologistId,
      sessionId: session._id
    },
    {
      $set: {
        scores,
        sessionDate: session.createdAt
      }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
};

const renderChatbotSummaryPdf = async ({ patient, session, summary, history, indicator }) => {
  const doc = new PDFDocument({ margin: 50 });

  const chunks = [];
  doc.on('data', (d) => chunks.push(d));

  const endPromise = new Promise((resolve, reject) => {
    doc.on('end', resolve);
    doc.on('error', reject);
  });

  const safeName = patient?.fullName || 'Unknown';
  const safeEmail = patient?.email || 'Unknown';
  const safePhone = patient?.telephone || '';
  const safeDate = new Date().toLocaleString();
  const sessionType = session?.sessionType || 'unknown';
  const sessionId = session?._id ? String(session._id) : '';

  doc.fontSize(20).font('Helvetica-Bold').text('Chatbot Intake Summary', { align: 'center' });
  doc.moveDown(0.25);
  doc.fontSize(10).font('Helvetica').fillColor('#666666').text('Generated by Psych Platform', { align: 'center' });
  doc.moveDown();

  doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor('#cccccc').stroke();
  doc.moveDown();

  doc.fontSize(13).font('Helvetica-Bold').fillColor('#000000').text('Patient / Session');
  doc.moveDown(0.5);
  doc.fontSize(11).font('Helvetica').text('Patient Email: ' + safeEmail);
  doc.text('Patient Name: ' + safeName);
  if (safePhone) doc.text('Patient Phone: ' + safePhone);
  doc.text('Patient ID: ' + String(patient?._id || ''));
  doc.text('Session ID: ' + sessionId);
  doc.text('Session Type: ' + sessionType);
  doc.text('Generated: ' + safeDate);
  doc.moveDown();

  doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor('#cccccc').stroke();
  doc.moveDown();

  doc.fontSize(13).font('Helvetica-Bold').text('Summary');
  doc.moveDown(0.5);
  doc.fontSize(11).font('Helvetica').text(String(summary?.rawSummary || ''), { lineGap: 4 });
  doc.moveDown();

  doc.fontSize(13).font('Helvetica-Bold').text('Emotional Indicators (AI)');
  doc.moveDown(0.5);
  doc.fontSize(11).font('Helvetica');
  doc.text('Dominant Emotion: ' + String(summary?.emotionalIndicators?.dominantEmotion || ''));
  doc.text('Urgency Score: ' + String(summary?.emotionalIndicators?.urgencyScore || 1) + ' / 5');
  doc.text('Sentiment Trend: ' + String(summary?.emotionalIndicators?.sentimentTrend || 'stable'));

  if (indicator?.scores) {
    doc.moveDown(0.5);
    doc.text('Anxiety: ' + String(indicator.scores.anxiety ?? 0) + '%');
    doc.text('Sadness: ' + String(indicator.scores.sadness ?? 0) + '%');
    doc.text('Anger: ' + String(indicator.scores.anger ?? 0) + '%');
    doc.text('Positivity: ' + String(indicator.scores.positivity ?? 0) + '%');
  }
  doc.moveDown();

  if (Array.isArray(summary?.keyThemes) && summary.keyThemes.length) {
    doc.fontSize(13).font('Helvetica-Bold').text('Key Themes');
    doc.moveDown(0.5);
    doc.fontSize(11).font('Helvetica');
    summary.keyThemes.slice(0, 24).forEach((t) => doc.text('- ' + String(t)));
    doc.moveDown();
  }

  if (Array.isArray(summary?.recommendations) && summary.recommendations.length) {
    doc.fontSize(13).font('Helvetica-Bold').text('Suggested Follow-ups');
    doc.moveDown(0.5);
    doc.fontSize(11).font('Helvetica');
    summary.recommendations.slice(0, 10).forEach((t, i) => doc.text(`${i + 1}. ${String(t)}`));
    doc.moveDown();
  }

  doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor('#cccccc').stroke();
  doc.moveDown();

  doc.fontSize(13).font('Helvetica-Bold').text('Conversation Excerpt');
  doc.moveDown(0.5);
  doc.fontSize(10).font('Helvetica').fillColor('#000000');
  (history || []).slice(-50).forEach((m) => {
    const role = String(m.role || '').toUpperCase();
    const content = String(m.content || '');
    doc.fillColor('#555555').text(role + ':', { continued: true });
    doc.fillColor('#000000').text(' ' + content, { lineGap: 2 });
    doc.moveDown(0.15);
  });

  doc.moveDown();
  doc.fontSize(9).fillColor('#999999').text(
    'This report was generated automatically by an AI assistant. It is intended to assist the psychologist and does not constitute a medical diagnosis.',
    { align: 'center', lineGap: 3 }
  );

  doc.end();
  await endPromise;
  return Buffer.concat(chunks);
};

const createChatbotReportForLatestSession = async ({ patientId, summary, indicator }) => {
  const session = await Session.findOne({
    patientId,
    status: {
      $in: ['active', 'completed', 'verified', 'paid', 'pending_payment', 'pending', 'requested']
    }
  }).sort({ createdAt: -1 });

  if (!session) return null;

  const [patient, history, indicatorForPdf] = await Promise.all([
    User.findById(patientId).select('email fullName telephone'),
    ChatbotMessage.find({ userId: patientId }).sort({ createdAt: 1 }).limit(600).select('role content createdAt')
    ,
    indicator
      ? Promise.resolve(indicator)
      : EmotionalIndicator.findOne({ patientId, psychologistId: session.psychologistId, sessionId: session._id })
          .sort({ createdAt: -1 })
          .select('scores sessionId psychologistId')
  ]);

  const pdfBytes = await renderChatbotSummaryPdf({ patient, session, summary, history, indicator: indicatorForPdf });
  const cacheKey = sha256([patientId, session._id.toString(), Date.now()].join(':'));
  const storagePath = `chatbot_reports/${cacheKey.slice(0, 2)}/${cacheKey}.pdf`;
  const { absolute } = resolvePrivatePath(storagePath);
  writeFileAtomic({ absolutePath: absolute, bytes: pdfBytes });

  const report = await ChatbotReport.create({
    patientId,
    psychologistId: session.psychologistId,
    sessionId: session._id,
    storagePath,
    sizeBytes: pdfBytes.length
  });

  return report;
};

exports.sendMessage = async (req, res) => {
  try {
    const { message } = req.body;
    if (req.user.role !== 'patient') {
      return res.status(403).json({ message: 'Access denied' });
    }

    if (!message || !String(message).trim()) {
      return res.status(400).json({ message: 'Message is required' });
    }
    
    const patientId = req.user.id;

    const result = await chatWorkflow.runChatTurn({ userId: patientId, message });
    res.status(200).json(result);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.resetConversation = async (req, res) => {
  try {
    if (req.user.role !== 'patient') {
      return res.status(403).json({ message: 'Access denied' });
    }

    const patientId = req.user.id;

    await Promise.all([
      ChatbotMessage.deleteMany({ userId: patientId }),
      ChatbotSummary.deleteOne({ patientId }),
      IntakeSession.findOneAndUpdate(
        { userId: patientId },
        {
          $set: {
            currentStage: 1,
            stageTurnCounts: new Map([['1', 0], ['2', 0], ['3', 0], ['4', 0], ['5', 0]]),
            isComplete: false,
            consecutiveRiskCount: 0,
            lastRiskCategory: null,
            lastRiskAt: null,
            startedAt: new Date(),
            completedAt: null
          }
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      )
    ]);

    res.status(200).json({ message: 'Conversation reset successfully.' });
  } catch (err) {
    console.error('resetConversation error:', err.message);
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

    const latestReport = await ChatbotReport.findOne({ patientId })
      .sort({ createdAt: -1 })
      .select('_id createdAt sessionId psychologistId');

    const pdfUrl = latestReport ? `${getApiBaseUrl()}/api/chatbot/reports/${latestReport._id}/pdf` : null;
    // Link to psychologist patient overview and allow the UI to trigger an authenticated download.
    const appUrl = latestReport ? `/patient/${patientId}?downloadChatbotReport=${latestReport._id}` : null;

    res.status(200).json({
      ...summary.toObject(),
      latestReport: latestReport ? latestReport.toObject() : null,
      pdfUrl,
      appUrl
    });
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

    let summary = null;
    try {
      summary = await generateSummaryForPatient({ patientId: req.user.id, includeRecommendations: true });
    } catch {
      summary = await ChatbotSummary.findOne({ patientId: req.user.id });
    }

    // Ensure we still persist something usable (and generate a PDF) even when the LLM summary fails.
    if (!summary) {
      const history = await ChatbotMessage.find({ userId: req.user.id })
        .sort({ createdAt: 1 })
        .limit(200)
        .select('role content createdAt');

      if (!history.length) {
        return res.status(400).json({ message: 'No conversation to summarize' });
      }

      const transcript = buildConversationText(history)
        .slice(-4000);

      summary = await ChatbotSummary.findOneAndUpdate(
        { patientId: req.user.id },
        {
          patientId: req.user.id,
          rawSummary: `AI summary unavailable (provider error). Transcript excerpt:\n\n${transcript}`,
          keyThemes: [],
          recommendations: []
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }

    const indicator = summary
      ? await upsertEmotionalIndicatorForLatestSession({ patientId: req.user.id, summary })
      : null;

    const report = summary
      ? await createChatbotReportForLatestSession({ patientId: req.user.id, summary, indicator })
      : null;

    const reportUrl = report ? `${getApiBaseUrl()}/api/chatbot/reports/${report._id}/pdf` : null;
    // Land on the psychologist patient overview; UI can auto-download with the query param.
    const reportAppUrl = report ? `/patient/${req.user.id}?downloadChatbotReport=${report._id}` : null;

    if (indicator?.psychologistId) {
      await createNotification({
        userId: indicator.psychologistId,
        title: 'New chatbot summary report',
        message: 'A patient closed the chatbot. A summary, emotional indicators, and a PDF report were generated.',
        link: reportAppUrl || `/patient/${req.user.id}`,
        type: 'chatbot_summary',
        channels: ['in_app'],
        data: {
          patientId: req.user.id,
          sessionId: indicator.sessionId,
          emotionalIndicatorId: indicator._id,
          ...(report ? { chatbotReportId: report._id, pdfUrl: reportUrl, appUrl: reportAppUrl } : {})
        },
        priority: 'normal'
      });
    }

    res.status(200).json({
      summary,
      emotionalIndicator: indicator,
      chatbotReport: report,
      pdfUrl: reportUrl,
      appUrl: reportAppUrl
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.downloadReportPdf = async (req, res) => {
  try {
    const report = await ChatbotReport.findById(req.params.id);
    if (!report) return res.status(404).json({ message: 'Report not found' });

    const uid = String(req.user.id);
    const isOwner =
      uid === String(report.patientId) ||
      uid === String(report.psychologistId) ||
      req.user.role === 'admin';

    if (!isOwner) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const { absolute } = resolvePrivatePath(report.storagePath);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=chatbot-report-${report._id}.pdf`);
    return res.sendFile(absolute);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};
