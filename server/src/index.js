const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http');
const { Server } = require('socket.io');

const authRoutes = require('./routes/authRoutes');
const psychologistRoutes = require('./routes/psychologistRoutes');
const sessionRoutes = require('./routes/sessionRoutes');
const chatbotRoutes = require('./routes/chatbotRoutes');
const messageRoutes = require('./routes/message.routes');
const dashboardRoutes = require('./routes/dashboard.routes');

dotenv.config({ path: require('path').resolve(__dirname, '../.env') });

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

app.get('/', (req, res) => {
  res.json({ message: 'Psych Platform API running' });
});

app.use('/api/auth', authRoutes);
app.use('/api/psychologists', psychologistRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/chatbot', chatbotRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Socket.io
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Join a conversation room
  socket.on('join_room', (roomId) => {
    socket.join(roomId);
    console.log(`User joined room: ${roomId}`);
  });

  // Send a message
  socket.on('send_message', (data) => {
    console.log('Message received by server, emitting to room:', data.roomId);
    io.to(data.roomId).emit('receive_message', data);
  });

  // Disconnect
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('MongoDB connected');
    server.listen(process.env.PORT || 5000, () => {
      console.log(`Server running on port ${process.env.PORT || 5000}`);
    });
  })
  .catch((err) => {
    console.error('MongoDB connection failed:', err.message);
    process.exit(1);
  });