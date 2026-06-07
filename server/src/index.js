const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http');
const { Server } = require('socket.io');
const rateLimit = require('express-rate-limit');
const axios = require('axios');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const xssClean = require('xss-clean');
const dns = require('dns');
const path = require('path');
const multer = require('multer');

const { startNotificationWorker } = require('./services/notificationWorker');
const { startBookingExpiryWorker } = require('./services/bookingExpiryWorker');
const { getPublicUploadsRoot } = require('./utils/uploadRoots');

// Routes
const calendarRoutes = require('./routes/calendar.routes');
const ttsRoutes = require('./routes/ttsRoutes');
const userRoutes = require('./routes/userRoutes');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

// Optional: force DNS resolvers
if (process.env.DNS_SERVERS) {
  const servers = process.env.DNS_SERVERS
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (servers.length) dns.setServers(servers);
}

const app = express();
const server = http.createServer(app);

const scheduleNightlyGapCheck = () => {
  const intervalMs = Number(process.env.NIGHTLY_GAP_CHECK_INTERVAL_MS) || 24 * 60 * 60 * 1000;

  const runCheck = async () => {
    try {
      const { runGapDetection, checkAndAutoReseed } = require('./controllers/chatbotController');
      const { createNotification } = require('./services/notificationService');
      const User = require('./models/User');

      const result = await runGapDetection({ forceRefresh: true });

      for (const gap of result.gaps || []) {
        await checkAndAutoReseed(gap.emotion).catch((err) =>
          console.error('[GapScheduler] Auto-reseed error:', err.message)
        );
      }

      const unreseedableGaps = (result.gaps || []).filter(
        (gap) => Number(gap.correctionCount || 0) < 3
      );

      if (unreseedableGaps.length > 0) {
        const admins = await User.find({ role: 'admin' }, '_id');
        for (const admin of admins) {
          await createNotification({
            userId: admin._id,
            title: 'Knowledge base gaps detected',
            message:
              `${unreseedableGaps.length} gap(s) need more corrections before auto-reseed triggers. ` +
              `Affected emotions: ${unreseedableGaps.map((g) => g.emotion).join(', ')}. ` +
              `Visit the admin panel to monitor status.`,
            link: '/admin',
            type: 'knowledge_gap_monitoring',
            channels: ['in_app'],
            data: { gaps: unreseedableGaps, summary: result.summary },
            priority: 'normal'
          });
        }
      }
    } catch (err) {
      console.error('[GapScheduler] Error:', err.message);
    }
  };

  setTimeout(() => {
    runCheck().catch(() => {});
    setInterval(() => {
      runCheck().catch(() => {});
    }, intervalMs);
  }, 5 * 60 * 1000);
};

//////////////////////////////////////////////////
// 🔐 RATE LIMITERS
//////////////////////////////////////////////////

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:
    Number(process.env.AUTH_RATE_LIMIT_MAX) ||
    (process.env.NODE_ENV === 'production' ? 10 : 1000),
  message: { message: 'Too many requests, please try again later.' }
});

const apiLimiter = rateLimit({
  windowMs: Number(process.env.API_RATE_LIMIT_WINDOW_MS) || 60 * 60 * 1000,
  max:
    Number(process.env.API_RATE_LIMIT_MAX) ||
    (process.env.NODE_ENV === 'production' ? 100 : 10000),
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again later.' }
});

const chatbotLimiter = rateLimit({
  windowMs: Number(process.env.CHATBOT_RATE_LIMIT_WINDOW_MS) || 60 * 60 * 1000,
  max:
    Number(process.env.CHATBOT_RATE_LIMIT_MAX) ||
    (process.env.NODE_ENV === 'production' ? 50 : 10000),
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Chatbot message limit reached. Please try again later.' }
});

//////////////////////////////////////////////////
// 🌐 CORS + MIDDLEWARE
//////////////////////////////////////////////////

app.use(cors({
  origin: 'http://localhost:3000',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));

// Security headers
app.use(
  helmet({
    crossOriginResourcePolicy: false,
  })
);

// JSON parser (skip multipart/file upload routes)
app.use((req, res, next) => {
  if (
    req.path.startsWith('/api/documents/upload') ||
    req.path.startsWith('/api/verification/upload') ||
    req.path.startsWith('/api/credential-documents/upload') ||
    req.path.startsWith('/api/profile-photos/upload') ||
    (req.path.startsWith('/api/sessions') &&
      req.path.includes('/voice'))
  ) {
    return next();
  }

  express.json({ limit: '10kb' })(req, res, next);
});

// Sanitization
// Disabled due to Express 5 read-only query compatibility
// app.use(mongoSanitize());
// app.use(xssClean());

// Serve ONLY approved profile photos publicly
app.use(
  '/uploads/profile-photos',
  express.static(
    path.join(getPublicUploadsRoot(), 'profile_photos', 'approved'),
    {
      setHeaders: (res) => {
        res.setHeader(
          'Cache-Control',
          'public, max-age=86400'
        );
      }
    }
  )
);

// Patient profile photos (no moderation pipeline yet)
app.use(
  '/uploads/patient-photos',
  express.static(
    path.join(getPublicUploadsRoot(), 'patient_photos'),
    {
      setHeaders: (res) => {
        res.setHeader('Cache-Control', 'public, max-age=86400');
      }
    }
  )
);

//////////////////////////////////////////////////
// 🔌 SOCKET.IO
//////////////////////////////////////////////////

const io = new Server(server, {
  cors: {
    origin: 'http://localhost:3000',
    methods: ['GET', 'POST']
  }
});

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join_user', (userId) => {
    if (!userId) return;
    socket.join(`user_${userId}`);
  });

  socket.on('join_room', (roomId) => {
    socket.join(roomId);
    console.log(`User joined room: ${roomId}`);
  });

  socket.on('send_message', (data) => {
    io.to(data.roomId).emit('receive_message', data);
  });

  // Risk alert room
  socket.on('join_psychologist_room', (psychologistId) => {
    const room = `psychologist_${psychologistId}`;
    socket.join(room);
    console.log(
      `Psychologist joined risk-alert room: ${room}`
    );
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Export io
module.exports.io = io;

//////////////////////////////////////////////////
// 📡 ROUTES
//////////////////////////////////////////////////

app.use('/api/auth', authLimiter, require('./routes/authRoutes'));
app.use('/api/chatbot', chatbotLimiter, require('./routes/chatbotRoutes'));
app.use('/api/psychologists', apiLimiter, require('./routes/psychologistRoutes'));
app.use('/api/sessions', apiLimiter, require('./routes/sessionRoutes'));
app.use('/api/messages', apiLimiter, require('./routes/message.routes'));
app.use('/api/dashboard', apiLimiter, require('./routes/dashboard.routes'));
app.use('/api/admin', apiLimiter, require('./routes/adminRoutes'));
app.use('/api/audit-events', apiLimiter, require('./routes/auditEventRoutes'));
app.use('/api/sessions', apiLimiter, require('./routes/reportRoutes'));
app.use('/api/sessions', apiLimiter, require('./routes/voiceRoutes'));
app.use('/api/ratings', apiLimiter, require('./routes/ratingRoutes'));
app.use('/api/verification', apiLimiter, require('./routes/verificationRoutes'));
app.use('/api/documents', apiLimiter, require('./routes/documentRoutes'));
app.use('/api/credential-documents', apiLimiter, require('./routes/credentialDocumentRoutes'));
app.use('/api/calendar', apiLimiter, calendarRoutes);
app.use('/api/notifications', apiLimiter, require('./routes/notificationRoutes'));
app.use('/api/users', apiLimiter, userRoutes);
app.use('/api/risk-alerts', apiLimiter, require('./routes/riskAlertRoutes'));
app.use('/api/persona', apiLimiter, require('./routes/personaRoutes'));
app.use('/api/tts', apiLimiter, ttsRoutes);
app.use('/api/review-queue', apiLimiter, require('./routes/reviewQueueRoutes'));
app.use('/api/onboarding', apiLimiter, require('./routes/onboardingRoutes'));
app.use('/api/profile-photos', apiLimiter, require('./routes/profilePhotoRoutes'));
app.use('/api/chat', chatbotLimiter, require('./workflows/chatRoute'));

//////////////////////////////////////////////////
// 🤖 PLATFORM ASSISTANT (Groq)
//////////////////////////////////////////////////

app.post('/api/assistant', chatbotLimiter, async (req, res) => {
  try {
    const { message, page } = req.body;

    if (!message) {
      return res.status(400).json({
        message: 'Message is required'
      });
    }

    const response = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: `You are a helpful assistant for PsychPlatform, an AI-assisted psychological consultation platform.

Your role is ONLY to help users navigate and use the platform.

You can help with:
- How to book a session
- How to find psychologists
- How payment works
- How the AI chatbot works
- How to rate a psychologist
- How psychologist registration works
- How voice messages work
- How to view session history
- How the calendar works

You must NOT give psychological advice or act as a therapist.

If asked for psychological help, say:
"I recommend discussing this with your psychologist during a session."

If asked unrelated questions, say:
"I can only help you navigate and use the platform."

Keep answers short, friendly and clear.

User is currently on page: ${page || 'unknown'}`
          },
          {
            role: 'user',
            content: message
          }
        ],
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

    const reply =
      response.data.choices[0].message.content;

    res.json({ reply });

  } catch (err) {
    console.error('ASSISTANT ERROR:', err.message);

    res.status(500).json({
      message: 'AI request failed'
    });
  }
});

//////////////////////////////////////////////////
// ❤️ HEALTH CHECK
//////////////////////////////////////////////////

app.get('/', (req, res) => {
  res.json({ message: 'Psych Platform API running' });
});

//////////////////////////////////////////////////
// ⚠️ GLOBAL ERROR HANDLER
//////////////////////////////////////////////////

app.use((err, req, res, next) => {
  console.error(err.stack);

  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        message: 'Uploaded file is too large.'
      });
    }

    return res.status(400).json({
      message: err.message || 'Upload failed'
    });
  }

  if (
    err &&
    (err.code === 'LIMIT_FILE_SIZE' ||
      err.code === 'REQUEST_ENTITY_TOO_LARGE')
  ) {
    return res.status(413).json({
      message: 'Uploaded file is too large.'
    });
  }

  res.status(err.status || 500).json({
    message: err.message || 'Internal server error'
  });
});

//////////////////////////////////////////////////
// 🗄️ DATABASE CONNECTION
//////////////////////////////////////////////////

if (!process.env.MONGO_URI) {
  console.error(
    'MONGO_URI is not set. Create server/.env and add MONGO_URI=your_mongodb_connection_string'
  );

  process.exit(1);
}

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log('MongoDB connected');

    startNotificationWorker();
    startBookingExpiryWorker();
    scheduleNightlyGapCheck();

    server.listen(process.env.PORT || 5000, () => {
      console.log(
        'Server running on port ' +
          (process.env.PORT || 5000)
      );
    });
  })
  .catch((err) => {
    console.error(
      'MongoDB connection failed:',
      err.message
    );

    process.exit(1);
  });
