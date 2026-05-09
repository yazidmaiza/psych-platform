const crypto = require('crypto');
const fs = require('fs');
const axios = require('axios');

const TtsAudio = require('../models/TtsAudio');
const TtsAccessGrant = require('../models/TtsAccessGrant');
const { audit } = require('../services/auditService');
const { sha256, buildTtsStorageRelativePath, resolvePrivatePath, writeFileAtomic } = require('../services/ttsStorage');

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

const ALLOWED_LANG = new Set(['auto', 'en', 'ar']);
const ALLOWED_STYLE = new Set(['neutral', 'male', 'female']);

// Voice mapping (best-effort; OpenAI voice set may vary by model).
const VOICE_BY_STYLE = {
  en: { neutral: 'marin', male: 'onyx', female: 'shimmer' },
  ar: { neutral: 'marin', male: 'onyx', female: 'shimmer' },
  auto: { neutral: 'marin', male: 'onyx', female: 'shimmer' }
};

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

const callOpenAiTts = async ({ input, voice, model, responseFormat, speed }) => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    const err = new Error('OPENAI_API_KEY is not configured');
    err.status = 500;
    throw err;
  }

  const res = await axios.post(
    'https://api.openai.com/v1/audio/speech',
    {
      model,
      voice,
      input,
      response_format: responseFormat,
      speed
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      responseType: 'arraybuffer',
      timeout: 60_000
    }
  );

  return Buffer.from(res.data);
};

// @POST /api/tts/speak
exports.speak = async (req, res) => {
  try {
    const input = String(req.body?.text || '').trim();
    const language = String(req.body?.language || 'auto').toLowerCase();
    const style = String(req.body?.style || 'neutral').toLowerCase();
    const speed = clamp(Number(req.body?.speed || 1.0), 0.25, 2.0);

    if (!input) return res.status(400).json({ message: 'text is required' });
    if (input.length > 1000) return res.status(413).json({ message: 'text too long (max 1000 chars)' });
    if (!ALLOWED_LANG.has(language)) return res.status(400).json({ message: 'Invalid language' });
    if (!ALLOWED_STYLE.has(style)) return res.status(400).json({ message: 'Invalid style' });

    const model = String(process.env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts');
    const responseFormat = 'mp3';
    const voice = VOICE_BY_STYLE[language]?.[style] || VOICE_BY_STYLE.auto.neutral;

    const cacheKey = sha256(JSON.stringify({ provider: 'openai', model, voice, language, style, speed, responseFormat, input }));
    const storagePath = buildTtsStorageRelativePath({ cacheKey, responseFormat });
    const { absolute } = resolvePrivatePath(storagePath);

    let audio = await TtsAudio.findOne({ cacheKey }).select('_id storagePath mimeType sizeBytes');
    const fileExists = fs.existsSync(absolute);

    if (!audio || !fileExists) {
      const bytes = await callOpenAiTts({ input, voice, model, responseFormat, speed });
      writeFileAtomic({ absolutePath: absolute, bytes });

      const sizeBytes = bytes.length;
      const mimeType = 'audio/mpeg';

      if (!audio) {
        audio = await TtsAudio.create({
          cacheKey,
          provider: 'openai',
          model,
          voice,
          language,
          speed,
          responseFormat,
          mimeType,
          sizeBytes,
          durationMs: 0,
          storagePath,
          createdByUserId: req.user.id
        });
      } else {
        await TtsAudio.updateOne({ _id: audio._id }, { $set: { storagePath, mimeType, sizeBytes } });
      }

      await audit(req, {
        action: 'TTS_SPEECH_GENERATE',
        targetType: 'TtsAudio',
        targetId: audio._id,
        outcome: 'success',
        severity: 'info',
        metadata: { language, style, speed, model, voice, sizeBytes }
      });
    } else {
      await audit(req, {
        action: 'TTS_SPEECH_CACHE_HIT',
        targetType: 'TtsAudio',
        targetId: audio._id,
        outcome: 'success',
        severity: 'info',
        metadata: { language, style, speed, model, voice }
      });
    }

    const ttlSeconds = Math.max(60, Math.min(600, Number(req.query.ttlSeconds || 300)));
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

    await TtsAccessGrant.create({
      tokenHash: hashToken(token),
      ttsAudioId: audio._id,
      requestedByUserId: req.user.id,
      requestedByRole: req.user.role,
      expiresAt,
      requestIp: String(req.ip || ''),
      requestUserAgent: String(req.headers['user-agent'] || '')
    });

    await audit(req, {
      action: 'TTS_ACCESS_URL_ISSUED',
      targetType: 'TtsAudio',
      targetId: audio._id,
      outcome: 'success',
      severity: 'security',
      metadata: { ttlSeconds }
    });

    return res.status(200).json({
      url: `/api/tts/download?token=${token}`,
      expiresAt: expiresAt.toISOString()
    });
  } catch (err) {
    await audit(req, {
      action: 'TTS_SPEECH_GENERATE',
      targetType: 'TtsAudio',
      targetId: '',
      outcome: 'failure',
      severity: 'security',
      message: err.message
    });
    return res.status(err.status || 500).json({ message: err.message || 'Server error' });
  }
};

// @GET /api/tts/download?token=...
exports.download = async (req, res) => {
  const token = String(req.query.token || '');
  if (!token || token.length < 20) return res.status(400).json({ message: 'Invalid token' });
  try {
    const grant = await TtsAccessGrant.findOne({ tokenHash: hashToken(token) });
    if (!grant) return res.status(403).json({ message: 'Invalid token' });
    if (grant.expiresAt.getTime() < Date.now()) return res.status(403).json({ message: 'Token expired' });

    const audio = await TtsAudio.findById(grant.ttsAudioId).select('storagePath mimeType');
    if (!audio) return res.status(404).json({ message: 'Not found' });

    const { absolute } = resolvePrivatePath(audio.storagePath);
    if (!fs.existsSync(absolute)) return res.status(404).json({ message: 'File not found' });

    await TtsAccessGrant.updateOne({ _id: grant._id }, { usedAt: new Date() });
    await audit(req, {
      action: 'TTS_DOWNLOAD',
      targetType: 'TtsAudio',
      targetId: audio._id,
      outcome: 'success',
      severity: 'security',
      metadata: { requestedByRole: grant.requestedByRole }
    });

    res.setHeader('Content-Type', audio.mimeType || 'audio/mpeg');
    res.setHeader('Cache-Control', 'private, max-age=300');
    return res.sendFile(absolute);
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
};

