const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http');
const { Server } = require('socket.io');

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:3000',
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/psychologists', require('./routes/psychologistRoutes'));
app.use('/api/sessions', require('./routes/sessionRoutes'));
app.use('/api/chatbot', require('./routes/chatbotRoutes'));
app.use('/api/messages', require('./routes/message.routes'));
app.use('/api/dashboard', require('./routes/dashboard.routes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/sessions', require('./routes/reportRoutes'));
app.use('/api/ratings', require('./routes/ratingRoutes'));
app.use('/api/sessions', require('./routes/voiceRoutes'));
app.use('/api/verification', require('./routes/verificationRoutes'));
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