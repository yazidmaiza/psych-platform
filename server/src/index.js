const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http');
const { Server } = require('socket.io');
const rateLimit = require('express-rate-limit');
const calendarRoutes = require('./routes/calendar.routes');

dotenv.config();

const app = express();
const server = http.createServer(app);

// Rate limiters
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

const io = new Server(server, {
  cors: {
    origin: 'http://localhost:3000',
    methods: ['GET', 'POST']
  }
});

app.use(cors());

// Conditional JSON parsing (for file uploads and voice)
app.use((req, res, next) => {
  if (
    req.path.startsWith('/api/documents/upload') ||
    req.path.startsWith('/api/verification/upload') ||
    (req.path.startsWith('/api/sessions') && req.path.includes('/voice'))
  ) {
    return next();
  }
  express.json()(req, res, next);
});

app.use('/uploads', express.static('uploads'));

// Routes
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

// Health check
app.get('/', (req, res) => {
  res.json({ message: 'Psych Platform API running' });
});

// Socket.io
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

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    message: err.message || 'Internal server error'
  });
});

// DB Connection
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