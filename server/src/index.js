const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http');
const { Server } = require('socket.io');
const rateLimit = require('express-rate-limit');
const axios = require('axios');
const helmet = require('helmet');
  // Routes
const calendarRoutes = require('./routes/calendar.routes');

dotenv.config();

const app = express();
const server = http.createServer(app);
  
//////////////////////////////////////////////////
// 🔐 RATE LIMITERS
//////////////////////////////////////////////////

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { message: 'Too many requests, please try again later.' }
});

const apiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 100,
  message: { message: 'Too many requests, please try again later.' }
});

const chatbotLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 50,
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

// Set security HTTP headers
app.use(helmet({
  crossOriginResourcePolicy: false, // For image/audio fetching if cross-domain needed, adjust as needed
}));


app.use((req, res, next) => {
  if (
    req.path.startsWith('/api/documents/upload') ||
    req.path.startsWith('/api/verification/upload') ||
    (req.path.startsWith('/api/sessions') && req.path.includes('/voice'))
  ) {
    return next();
  }
  express.json({ limit: '10kb' })(req, res, next);
});

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

  socket.on('join_room', (roomId) => {
    socket.join(roomId);
    console.log(`User joined room: ${roomId}`);
  });

  socket.on('send_message', (data) => {
    io.to(data.roomId).emit('receive_message', data);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

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
app.use('/api/sessions', apiLimiter, require('./routes/reportRoutes'));
app.use('/api/sessions', apiLimiter, require('./routes/voiceRoutes'));
app.use('/api/ratings', apiLimiter, require('./routes/ratingRoutes'));
app.use('/api/verification', apiLimiter, require('./routes/verificationRoutes'));
app.use('/api/documents', apiLimiter, require('./routes/documentRoutes'));
app.use('/api/calendar', apiLimiter, calendarRoutes);
app.use('/api/notifications', apiLimiter, require('./routes/notificationRoutes'));

//////////////////////////////////////////////////
// 🤖 PLATFORM ASSISTANT (Groq)
//////////////////////////////////////////////////

app.post('/api/assistant', chatbotLimiter, async (req, res) => {
  try {
    const { message, page } = req.body;
    if (!message) return res.status(400).json({ message: 'Message is required' });

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
- How payment works (patient pays, receives 6-digit code by email, enters code to start session)
- How the AI chatbot works (3 types: preparation, followup, free expression)
- How to rate a psychologist (10 questions after session ends)
- How psychologist registration works (CV + diploma upload, admin approval required)
- How voice messages work (microphone button in conversation)
- How to view session history
- How the calendar works (psychologist adds slots, patient books them)

You must NOT give psychological advice or act as a therapist.
If asked for psychological help, say: "I recommend discussing this with your psychologist during a session."
If asked unrelated questions, say: "I can only help you navigate and use the platform."
Keep answers short, friendly and clear.

User is currently on page: ${page || 'unknown'}`
          },
          { role: 'user', content: message }
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

    const reply = response.data.choices[0].message.content;
    res.json({ reply });
  } catch (err) {
    console.error('ASSISTANT ERROR:', err.message);
    res.status(500).json({ message: 'AI request failed' });
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
  res.status(err.status || 500).json({
    message: err.message || 'Internal server error'
  });
});

//////////////////////////////////////////////////
// 🗄️ DATABASE CONNECTION
//////////////////////////////////////////////////

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('MongoDB connected');
    server.listen(process.env.PORT || 5000, () => {
      console.log('Server running on port ' + (process.env.PORT || 5000));
    });
  })
  .catch((err) => {
    console.error('MongoDB connection failed:', err.message);
    process.exit(1);
    });