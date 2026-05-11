const crypto = require('crypto');
const fs = require('fs');
const axios = require('axios');

const TtsAudio = require('../models/TtsAudio');
const TtsAccessGrant = require('../models/TtsAccessGrant');
const { audit } = require('../services/auditService');
const { sha256, buildTtsStorageRelativePath, resolvePrivatePath, writeFileAtomic } = require('../services/ttsStorage');

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

const ALLOWED_LANG = new Set(['auto', 'en', 'fr', 'ar']);
const ALLOWED_STYLE = new Set(['neutral', 'male', 'female']);

// Voice mapping (best-effort; Groq voice set may vary by model).
const VOICE_BY_STYLE = {
  en: { neutral: 'austin', male: 'troy', female: 'hannah' },
  fr: { neutral: 'austin', male: 'troy', female: 'hannah' },
  // Orpheus Arabic (Saudi) voice set differs from English.
  ar: { neutral: 'noura', male: 'abdullah', female: 'aisha' },
  auto: { neutral: 'austin', male: 'troy', female: 'hannah' }
};

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

const truthy = (v) => ['1', 'true', 'yes', 'on'].includes(String(v || '').trim().toLowerCase());

const MIME_BY_FORMAT = {
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  flac: 'audio/flac',
  mulaw: 'audio/basic'
};

const splitTextChunks = ({ text, maxChars }) => {
  const s = String(text || '').trim();
  if (!s) return [];
  if (s.length <= maxChars) return [s];

  const chunks = [];
  let i = 0;
  while (i < s.length) {
    const end = Math.min(s.length, i + maxChars);
    let cut = end;
    // Prefer splitting on whitespace to keep words intact when possible.
    for (let j = end; j > i + Math.floor(maxChars * 0.6); j--) {
      if (/\s/.test(s[j - 1])) {
        cut = j;
        break;
      }
    }
    const part = s.slice(i, cut).trim();
    if (part) chunks.push(part);
    i = cut;
  }
  return chunks.length ? chunks : [s.slice(0, maxChars)];
};

const parseWav = (buf) => {
  if (!Buffer.isBuffer(buf)) throw new Error('Invalid WAV buffer');
  if (buf.length < 44) throw new Error('WAV too small');
  if (buf.toString('ascii', 0, 4) !== 'RIFF') throw new Error('Invalid WAV: missing RIFF');
  if (buf.toString('ascii', 8, 12) !== 'WAVE') throw new Error('Invalid WAV: missing WAVE');

  let offset = 12;
  let fmt = null;
  let dataOffset = null;
  let dataSize = null;

  while (offset + 8 <= buf.length) {
    const id = buf.toString('ascii', offset, offset + 4);
    const size = buf.readUInt32LE(offset + 4);
    const chunkStart = offset + 8;
    const chunkEnd = chunkStart + size;
    if (chunkEnd > buf.length) break;

    if (id === 'fmt ') {
      if (size < 16) throw new Error('Invalid WAV fmt chunk');
      fmt = {
        audioFormat: buf.readUInt16LE(chunkStart + 0),
        numChannels: buf.readUInt16LE(chunkStart + 2),
        sampleRate: buf.readUInt32LE(chunkStart + 4),
        byteRate: buf.readUInt32LE(chunkStart + 8),
        blockAlign: buf.readUInt16LE(chunkStart + 12),
        bitsPerSample: buf.readUInt16LE(chunkStart + 14)
      };
    } else if (id === 'data') {
      dataOffset = chunkStart;
      dataSize = size;
      break;
    }

    offset = chunkEnd + (size % 2); // word alignment padding
  }

  if (!fmt) throw new Error('Invalid WAV: missing fmt chunk');
  if (fmt.audioFormat !== 1 && fmt.audioFormat !== 3) throw new Error('Unsupported WAV format');
  if (dataOffset == null || dataSize == null) throw new Error('Invalid WAV: missing data chunk');
  if (dataOffset + dataSize > buf.length) throw new Error('Invalid WAV: data out of bounds');

  return { fmt, data: buf.subarray(dataOffset, dataOffset + dataSize) };
};

const buildWav = ({ fmt, data }) => {
  const fmtChunkSize = 16;
  const dataChunkSize = data.length;
  const riffSize = 4 + (8 + fmtChunkSize) + (8 + dataChunkSize);
  const out = Buffer.allocUnsafe(12 + (8 + fmtChunkSize) + (8 + dataChunkSize));

  out.write('RIFF', 0, 4, 'ascii');
  out.writeUInt32LE(riffSize, 4);
  out.write('WAVE', 8, 4, 'ascii');

  let o = 12;
  out.write('fmt ', o, 4, 'ascii'); o += 4;
  out.writeUInt32LE(fmtChunkSize, o); o += 4;
  out.writeUInt16LE(fmt.audioFormat, o); o += 2;
  out.writeUInt16LE(fmt.numChannels, o); o += 2;
  out.writeUInt32LE(fmt.sampleRate, o); o += 4;
  out.writeUInt32LE(fmt.byteRate, o); o += 4;
  out.writeUInt16LE(fmt.blockAlign, o); o += 2;
  out.writeUInt16LE(fmt.bitsPerSample, o); o += 2;

  out.write('data', o, 4, 'ascii'); o += 4;
  out.writeUInt32LE(dataChunkSize, o); o += 4;
  data.copy(out, o);
  return out;
};

const concatWavs = (wavBuffers) => {
  if (!wavBuffers.length) throw new Error('No WAVs to concat');
  const first = parseWav(wavBuffers[0]);
  const parts = [first.data];
  for (let i = 1; i < wavBuffers.length; i++) {
    const next = parseWav(wavBuffers[i]);
    const a = first.fmt;
    const b = next.fmt;
    if (
      a.audioFormat !== b.audioFormat ||
      a.numChannels !== b.numChannels ||
      a.sampleRate !== b.sampleRate ||
      a.bitsPerSample !== b.bitsPerSample ||
      a.blockAlign !== b.blockAlign
    ) {
      throw new Error('WAV chunks have incompatible formats');
    }
    parts.push(next.data);
  }
  const merged = Buffer.concat(parts);
  return buildWav({ fmt: first.fmt, data: merged });
};

const callGroqTts = async ({ input, voice, model, responseFormat, speed, sampleRate }) => {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    const err = new Error('GROQ_API_KEY is not configured');
    err.status = 500;
    throw err;
  }

  try {
    const res = await axios.post(
      'https://api.groq.com/openai/v1/audio/speech',
      {
        model,
        voice,
        input,
        response_format: responseFormat,
        speed,
        ...(sampleRate ? { sample_rate: sampleRate } : {})
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
  } catch (e) {
    const status = e?.response?.status;
    const rawBody =
      e?.response?.data && Buffer.isBuffer(e.response.data) ? e.response.data.toString('utf8') : String(e?.response?.data || '');
    let parsed = null;
    try {
      parsed = rawBody ? JSON.parse(rawBody) : null;
    } catch {}
    const groqCode = parsed?.error?.code || parsed?.code || null;
    const body = rawBody ? rawBody.slice(0, 800) : '';
    const msg = `Groq TTS failed${status ? ` (${status})` : ''}${body ? `: ${body}` : ''}`;
    const err = new Error(msg);
    err.status = status || 500;
    err.groqCode = groqCode;
    throw err;
  }
};

const callGroqTextCorrect = async ({ input, language }) => {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    const err = new Error('GROQ_API_KEY is not configured');
    err.status = 500;
    throw err;
  }

  const model = String(process.env.GROQ_TEXT_CORRECT_MODEL || 'llama-3.1-8b-instant');
  const safeLang = String(language || 'auto').toLowerCase();
  const system =
    'You are a careful text corrector for psychotherapy chat messages. ' +
    'Fix spelling, grammar, and punctuation ONLY. Preserve meaning, tone, and intent. ' +
    'Do not add new information, advice, or extra sentences. Do not censor or remove content. ' +
    'Keep the same language as the input. Output ONLY the corrected text, with no quotes and no explanations.';

  const user = `Language hint: ${safeLang}\n\nText:\n${String(input || '')}`;

  try {
    const resp = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model,
        temperature: 0,
        max_tokens: 600,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user }
        ]
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 30_000
      }
    );

    const out = String(resp?.data?.choices?.[0]?.message?.content || '').trim();
    // If the model failed to return something usable, fall back to original input.
    if (!out) return String(input || '');
    return out;
  } catch (e) {
    const status = e?.response?.status;
    const rawBody =
      e?.response?.data && Buffer.isBuffer(e.response.data) ? e.response.data.toString('utf8') : String(e?.response?.data || '');
    const body = rawBody ? rawBody.slice(0, 500) : '';
    const msg = `Groq text correction failed${status ? ` (${status})` : ''}${body ? `: ${body}` : ''}`;
    const err = new Error(msg);
    err.status = status || 500;
    throw err;
  }
};

// @POST /api/tts/speak
exports.speak = async (req, res) => {
  try {
    const input = String(req.body?.text || '').trim();
    const language = String(req.body?.language || 'auto').toLowerCase();
    const style = String(req.body?.style || 'neutral').toLowerCase();
    const speed = clamp(Number(req.body?.speed || 1.0), 0.25, 2.0);
    const correctText =
      typeof req.body?.correctText === 'boolean' ? req.body.correctText : truthy(process.env.GROQ_TTS_CORRECT_TEXT);

    if (!input) return res.status(400).json({ message: 'text is required' });
    if (!ALLOWED_LANG.has(language)) return res.status(400).json({ message: 'Invalid language' });
    if (!ALLOWED_STYLE.has(style)) return res.status(400).json({ message: 'Invalid style' });

    const defaultModel = language === 'ar' ? 'canopylabs/orpheus-arabic-saudi' : 'canopylabs/orpheus-v1-english';
    const model = String(process.env.GROQ_TTS_MODEL || defaultModel);
    const responseFormat = String(process.env.GROQ_TTS_FORMAT || (model.includes('orpheus') ? 'wav' : 'mp3')).toLowerCase();
    const sampleRate = req.body?.sampleRate ? Number(req.body.sampleRate) : null;
    const voiceFromBody = String(req.body?.voice || '').trim();
    const voice = voiceFromBody || VOICE_BY_STYLE[language]?.[style] || VOICE_BY_STYLE.auto.neutral;
    const fallbackModel = String(process.env.GROQ_TTS_FALLBACK_MODEL || '').trim();

    // Optionally correct the text before TTS (best-effort).
    const correctedText = correctText ? await callGroqTextCorrect({ input, language }) : input;

    // Orpheus has a strict per-request input limit. When exceeded, chunk and merge WAVs server-side.
    const isOrpheus = model.includes('orpheus');
    const maxChars = isOrpheus ? 200 : 8000;
    if (!isOrpheus && correctedText.length > maxChars) return res.status(413).json({ message: `text too long (max ${maxChars} chars)` });

    const cacheKey = sha256(
      JSON.stringify({
        provider: 'groq',
        model,
        voice,
        language,
        style,
        speed,
        responseFormat,
        sampleRate: sampleRate || null,
        correctText: Boolean(correctText),
        correctModel: correctText ? String(process.env.GROQ_TEXT_CORRECT_MODEL || 'llama-3.1-8b-instant') : null,
        input: correctedText
      })
    );
    const storagePath = buildTtsStorageRelativePath({ cacheKey, responseFormat });
    const { absolute } = resolvePrivatePath(storagePath);

    let audio = await TtsAudio.findOne({ cacheKey }).select('_id storagePath mimeType sizeBytes');
    const fileExists = fs.existsSync(absolute);

    if (!audio || !fileExists) {
      let bytes;
      if (isOrpheus && correctedText.length > 200) {
        // Orpheus only supports WAV; enforce for chunking safety.
        const wavFormat = 'wav';
        const parts = splitTextChunks({ text: correctedText, maxChars: 200 });
        const wavs = [];
        for (const part of parts) {
          try {
            wavs.push(await callGroqTts({ input: part, voice, model, responseFormat: wavFormat, speed, sampleRate }));
          } catch (e) {
            if (e?.groqCode === 'model_terms_required') throw e;
            if (e?.groqCode === 'model_decommissioned') throw e;
            throw e;
          }
        }
        if (!bytes) bytes = concatWavs(wavs);
      } else {
        try {
          bytes = await callGroqTts({ input: correctedText, voice, model, responseFormat, speed, sampleRate });
        } catch (e) {
          if (e?.groqCode === 'model_terms_required') throw e;
          if (e?.groqCode === 'model_decommissioned') throw e;
          if (fallbackModel) {
            bytes = await callGroqTts({
              input: correctedText,
              voice,
              model: fallbackModel,
              responseFormat: String(process.env.GROQ_TTS_FALLBACK_FORMAT || 'mp3').toLowerCase(),
              speed,
              sampleRate
            });
          } else throw e;
        }
      }
      writeFileAtomic({ absolutePath: absolute, bytes });

      const sizeBytes = bytes.length;
      const mimeType = MIME_BY_FORMAT[responseFormat] || 'application/octet-stream';

      if (!audio) {
        audio = await TtsAudio.create({
          cacheKey,
          provider: 'groq',
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
        metadata: {
          language,
          style,
          speed,
          model,
          voice,
          responseFormat,
          sampleRate: sampleRate || null,
          correctText: Boolean(correctText),
          sizeBytes
        }
      });
    } else {
      await audit(req, {
        action: 'TTS_SPEECH_CACHE_HIT',
        targetType: 'TtsAudio',
        targetId: audio._id,
        outcome: 'success',
        severity: 'info',
        metadata: { language, style, speed, model, voice, responseFormat, sampleRate: sampleRate || null, correctText: Boolean(correctText) }
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
    if (err?.groqCode === 'model_terms_required') {
      await audit(req, {
        action: 'TTS_SPEECH_GENERATE',
        targetType: 'TtsAudio',
        targetId: '',
        outcome: 'failure',
        severity: 'security',
        message: 'Groq model terms not accepted'
      });
      return res.status(403).json({
        message:
          'Groq TTS model terms not accepted. Ask your Groq org admin to accept the model terms in the Groq Console (Playground) for the configured Orpheus model.'
      });
    }
    if (err?.groqCode === 'model_decommissioned') {
      await audit(req, {
        action: 'TTS_SPEECH_GENERATE',
        targetType: 'TtsAudio',
        targetId: '',
        outcome: 'failure',
        severity: 'security',
        message: 'Groq TTS model decommissioned'
      });
      return res.status(500).json({
        message:
          'Groq TTS model is decommissioned. Update GROQ_TTS_MODEL / GROQ_TTS_FALLBACK_MODEL to a supported model (see Groq deprecations page).'
      });
    }
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
