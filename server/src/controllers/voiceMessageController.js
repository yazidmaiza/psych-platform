const crypto = require('crypto');
const fs = require('fs');
const axios = require('axios');
const FormData = require('form-data');
const Session = require('../models/Session');
const Message = require('../models/Message');
const VoiceMessageAccessGrant = require('../models/VoiceMessageAccessGrant');
const { audit } = require('../services/auditService');
const { buildVoiceStorageRelativePath, persistUploadedTempFile, resolvePrivatePath } = require('../services/voiceMessageStorage');

const ALLOWED_MIMES = new Set(['audio/webm', 'audio/ogg', 'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/mp4']);
const MAX_VOICE_BYTES = 5 * 1024 * 1024; // 5MB (short voice notes)
const MAX_DURATION_MS = 30_000; // best-effort; enforced when duration can be detected

const safeUnlink = (filePath) => {
  try {
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (e) {}
};

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

const getDurationMs = async (absolutePath) => {
  // Best-effort duration check using ffprobe if available.
  try {
    const ffmpeg = require('fluent-ffmpeg');
    const ffmpegPath = process.env.FFMPEG_PATH;
    const ffprobePath = process.env.FFPROBE_PATH;
    if (ffmpegPath) ffmpeg.setFfmpegPath(ffmpegPath);
    if (ffprobePath) ffmpeg.setFfprobePath(ffprobePath);

    const probe = await new Promise((resolve, reject) => {
      ffmpeg.ffprobe(absolutePath, (err, data) => (err ? reject(err) : resolve(data)));
    });
    const sec = Number(probe?.format?.duration || 0);
    if (!Number.isFinite(sec) || sec <= 0) return 0;
    return Math.round(sec * 1000);
  } catch (e) {
    return 0;
  }
};

const transcribeWithGroqWhisper = async ({ absolutePath, mimeType, originalName }) => {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    const err = new Error('GROQ_API_KEY is not configured');
    err.status = 500;
    throw err;
  }

  const formData = new FormData();
  formData.append('file', fs.createReadStream(absolutePath), {
    filename: originalName || 'voice',
    contentType: mimeType
  });
  formData.append('model', 'whisper-large-v3');
  formData.append('response_format', 'json');

  const whisperResponse = await axios.post(
    'https://api.groq.com/openai/v1/audio/transcriptions',
    formData,
    {
      headers: {
        Authorization: 'Bearer ' + apiKey,
        ...formData.getHeaders()
      },
      timeout: 60_000
    }
  );

  return String(whisperResponse?.data?.text || '').trim();
};

const assertSessionParticipant = async ({ sessionId, userId }) => {
  const session = await Session.findById(sessionId).select('patientId psychologistId status');
  if (!session) {
    const err = new Error('Session not found');
    err.status = 404;
    throw err;
  }
  const isPatient = String(session.patientId) === String(userId);
  const isPsychologist = String(session.psychologistId) === String(userId);
  if (!isPatient && !isPsychologist) {
    const err = new Error('Unauthorized session access');
    err.status = 403;
    throw err;
  }
  return { session, isPatient, isPsychologist };
};

const assertActiveSessionParticipant = async ({ sessionId, userId }) => {
  const result = await assertSessionParticipant({ sessionId, userId });
  if (String(result.session.status) !== 'active') {
    const err = new Error('Session is not active');
    err.status = 409;
    throw err;
  }
  return result;
};

// @POST /api/sessions/:id/voice-message
exports.createVoiceMessage = async (req, res) => {
  const sessionId = req.params.id;
  const tempPath = req.file?.path;
  try {
    if (!req.file) return res.status(400).json({ message: 'No audio file provided' });
    if (!ALLOWED_MIMES.has(req.file.mimetype)) return res.status(400).json({ message: 'Unsupported audio format' });
    if (req.file.size > MAX_VOICE_BYTES) return res.status(413).json({ message: 'Voice message is too large (max 5MB)' });

    const { session, isPatient } = await assertActiveSessionParticipant({ sessionId, userId: req.user.id });
    const receiverId = isPatient ? session.psychologistId : session.patientId;
    const receiverModel = isPatient ? 'Psychologist' : 'User';
    const senderModel = req.user.role === 'psychologist' ? 'Psychologist' : 'User';

    const storagePath = buildVoiceStorageRelativePath({ sessionId, mimeType: req.file.mimetype });
    const absolute = persistUploadedTempFile({ tempFilePath: req.file.path, storagePath });
    const durationMs = await getDurationMs(absolute);
    if (durationMs && durationMs > MAX_DURATION_MS) {
      safeUnlink(absolute);
      return res.status(413).json({ message: 'Voice message is too long (max 30s)' });
    }

    const msg = await Message.create({
      sessionId,
      senderId: req.user.id,
      senderModel,
      receiverId,
      receiverModel,
      kind: 'voice',
      content: '',
      voice: {
        storagePath,
        mimeType: req.file.mimetype,
        sizeBytes: req.file.size,
        durationMs,
        transcription: { status: 'pending', text: '', error: '', updatedAt: new Date() }
      }
    });

    // Best-effort transcription (store on message). If it fails, keep the voice note usable.
    try {
      const text = await transcribeWithGroqWhisper({
        absolutePath: absolute,
        mimeType: req.file.mimetype,
        originalName: req.file.originalname
      });
      await Message.updateOne(
        { _id: msg._id },
        { $set: { 'voice.transcription': { status: 'ready', text, error: '', updatedAt: new Date() } } }
      );
    } catch (e) {
      await Message.updateOne(
        { _id: msg._id },
        { $set: { 'voice.transcription': { status: 'error', text: '', error: String(e?.message || 'Transcription failed'), updatedAt: new Date() } } }
      );
    }

    await audit(req, {
      action: 'VOICE_MESSAGE_UPLOAD',
      targetType: 'Message',
      targetId: msg._id,
      outcome: 'success',
      severity: 'info',
      metadata: { sessionId, mimeType: req.file.mimetype, sizeBytes: req.file.size, durationMs }
    });

    const fresh = await Message.findById(msg._id).select('voice createdAt senderId receiverId sessionId kind content').lean();

    return res.status(201).json({
      _id: msg._id,
      sessionId: msg.sessionId,
      senderId: msg.senderId,
      receiverId: msg.receiverId,
      kind: msg.kind,
      content: msg.content,
      createdAt: msg.createdAt,
      voice: {
        mimeType: msg.voice?.mimeType || '',
        sizeBytes: msg.voice?.sizeBytes || 0,
        durationMs: msg.voice?.durationMs || 0,
        url: `/api/messages/${msg._id}/voice`,
        transcription: fresh?.voice?.transcription || { status: 'pending', text: '' }
      }
    });
  } catch (err) {
    if (tempPath) safeUnlink(tempPath);
    await audit(req, {
      action: 'VOICE_MESSAGE_UPLOAD',
      targetType: 'Message',
      targetId: '',
      outcome: 'failure',
      severity: 'security',
      message: err.message,
      metadata: { sessionId }
    });
    return res.status(err.status || 500).json({ message: err.message || 'Server error' });
  }
};

// @POST /api/messages/:id/voice-transcribe (retry)
exports.retryVoiceTranscription = async (req, res) => {
  const messageId = req.params.id;
  try {
    const msg = await Message.findById(messageId).select('kind voice sessionId senderId receiverId');
    if (!msg) return res.status(404).json({ message: 'Message not found' });
    if (String(msg.kind) !== 'voice') return res.status(400).json({ message: 'Not a voice message' });

    if (msg.sessionId) {
      await assertSessionParticipant({ sessionId: msg.sessionId, userId: req.user.id });
    } else {
      const ok = String(msg.senderId) === String(req.user.id) || String(msg.receiverId) === String(req.user.id);
      if (!ok) return res.status(403).json({ message: 'Access denied' });
    }

    const { absolute } = resolvePrivatePath(msg.voice?.storagePath || '');
    if (!fs.existsSync(absolute)) return res.status(404).json({ message: 'File not found' });

    await Message.updateOne(
      { _id: msg._id },
      { $set: { 'voice.transcription': { status: 'pending', text: '', error: '', updatedAt: new Date() } } }
    );

    try {
      const text = await transcribeWithGroqWhisper({
        absolutePath: absolute,
        mimeType: msg.voice?.mimeType,
        originalName: 'voice'
      });
      await Message.updateOne(
        { _id: msg._id },
        { $set: { 'voice.transcription': { status: 'ready', text, error: '', updatedAt: new Date() } } }
      );
      return res.status(200).json({ status: 'ready', text });
    } catch (e) {
      const error = String(e?.message || 'Transcription failed');
      await Message.updateOne(
        { _id: msg._id },
        { $set: { 'voice.transcription': { status: 'error', text: '', error, updatedAt: new Date() } } }
      );
      return res.status(200).json({ status: 'error', error });
    }
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
};

// @GET /api/messages/:id/voice
exports.streamVoiceMessage = async (req, res) => {
  const messageId = req.params.id;
  try {
    const msg = await Message.findById(messageId).select('kind voice sessionId senderId receiverId');
    if (!msg) return res.status(404).json({ message: 'Message not found' });
    if (String(msg.kind) !== 'voice') return res.status(400).json({ message: 'Not a voice message' });

    // Authorization: either session participant (preferred) or sender/receiver for non-session messages.
    if (msg.sessionId) {
      await assertSessionParticipant({ sessionId: msg.sessionId, userId: req.user.id });
    } else {
      const ok = String(msg.senderId) === String(req.user.id) || String(msg.receiverId) === String(req.user.id);
      if (!ok) {
        await audit(req, {
          action: 'VOICE_MESSAGE_DOWNLOAD_DENIED',
          targetType: 'Message',
          targetId: messageId,
          outcome: 'failure',
          severity: 'security',
          message: 'Unauthorized media access'
        });
        return res.status(403).json({ message: 'Access denied' });
      }
    }

    const { absolute } = resolvePrivatePath(msg.voice?.storagePath || '');
    if (!fs.existsSync(absolute)) {
      await audit(req, {
        action: 'VOICE_MESSAGE_DOWNLOAD',
        targetType: 'Message',
        targetId: messageId,
        outcome: 'failure',
        severity: 'warn',
        message: 'File missing from storage'
      });
      return res.status(404).json({ message: 'File not found' });
    }

    await audit(req, {
      action: 'VOICE_MESSAGE_DOWNLOAD',
      targetType: 'Message',
      targetId: messageId,
      outcome: 'success',
      severity: 'info'
    });

    res.setHeader('Content-Type', msg.voice?.mimeType || 'application/octet-stream');
    res.setHeader('Cache-Control', 'private, max-age=300');
    return res.sendFile(absolute);
  } catch (err) {
    return res.status(err.status || 500).json({ message: err.message || 'Server error' });
  }
};

// @GET /api/messages/:id/voice-access-url
exports.getVoiceAccessUrl = async (req, res) => {
  const messageId = req.params.id;
  try {
    const msg = await Message.findById(messageId).select('kind voice sessionId senderId receiverId');
    if (!msg) return res.status(404).json({ message: 'Message not found' });
    if (String(msg.kind) !== 'voice') return res.status(400).json({ message: 'Not a voice message' });

    // Authorization same as stream endpoint (but uses auth header here).
    if (msg.sessionId) {
      await assertSessionParticipant({ sessionId: msg.sessionId, userId: req.user.id });
    } else {
      const ok = String(msg.senderId) === String(req.user.id) || String(msg.receiverId) === String(req.user.id);
      if (!ok) {
        await audit(req, {
          action: 'VOICE_MESSAGE_ACCESS_URL_DENIED',
          targetType: 'Message',
          targetId: messageId,
          outcome: 'failure',
          severity: 'security',
          message: 'Unauthorized media access'
        });
        return res.status(403).json({ message: 'Access denied' });
      }
    }

    const ttlSeconds = Math.max(60, Math.min(600, Number(req.query.ttlSeconds || 300)));
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

    await VoiceMessageAccessGrant.create({
      tokenHash: hashToken(token),
      messageId: msg._id,
      requestedByUserId: req.user.id,
      requestedByRole: req.user.role,
      expiresAt,
      requestIp: String(req.ip || ''),
      requestUserAgent: String(req.headers['user-agent'] || '')
    });

    await audit(req, {
      action: 'VOICE_MESSAGE_ACCESS_URL_ISSUED',
      targetType: 'Message',
      targetId: msg._id,
      outcome: 'success',
      severity: 'info',
      metadata: { ttlSeconds }
    });

    return res.status(200).json({
      url: `/api/messages/voice-download?token=${token}`,
      expiresAt: expiresAt.toISOString()
    });
  } catch (err) {
    await audit(req, {
      action: 'VOICE_MESSAGE_ACCESS_URL_DENIED',
      targetType: 'Message',
      targetId: messageId,
      outcome: 'failure',
      severity: 'security',
      message: err.message
    });
    return res.status(err.status || 500).json({ message: err.message || 'Server error' });
  }
};

// @GET /api/messages/voice-download?token=...
exports.downloadVoiceByToken = async (req, res) => {
  const token = String(req.query.token || '');
  if (!token || token.length < 20) return res.status(400).json({ message: 'Invalid token' });
  try {
    const tokenHash = hashToken(token);
    const grant = await VoiceMessageAccessGrant.findOne({ tokenHash });
    if (!grant) return res.status(403).json({ message: 'Invalid token' });
    if (grant.expiresAt.getTime() < Date.now()) return res.status(403).json({ message: 'Token expired' });

    const msg = await Message.findById(grant.messageId).select('kind voice');
    if (!msg) return res.status(404).json({ message: 'Message not found' });
    if (String(msg.kind) !== 'voice') return res.status(400).json({ message: 'Not a voice message' });

    const { absolute } = resolvePrivatePath(msg.voice?.storagePath || '');
    if (!fs.existsSync(absolute)) return res.status(404).json({ message: 'File not found' });

    await VoiceMessageAccessGrant.updateOne({ _id: grant._id }, { usedAt: new Date() });
    await audit(req, {
      action: 'VOICE_MESSAGE_DOWNLOAD',
      targetType: 'Message',
      targetId: msg._id,
      outcome: 'success',
      severity: 'info',
      metadata: { requestedByRole: grant.requestedByRole }
    });

    res.setHeader('Content-Type', msg.voice?.mimeType || 'application/octet-stream');
    res.setHeader('Cache-Control', 'private, max-age=300');
    return res.sendFile(absolute);
  } catch (err) {
    return res.status(500).json({ message: 'Server error' });
  }
};
