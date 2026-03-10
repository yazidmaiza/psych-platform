const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');

const authRoutes = require('./routes/authRoutes');
const psychologistRoutes = require('./routes/psychologistRoutes');
const sessionRoutes = require('./routes/sessionRoutes');
const chatbotRoutes = require('./routes/chatbotRoutes');
const messageRoutes = require('./routes/message.routes');
const dashboardRoutes = require('./routes/dashboard.routes');

dotenv.config({ path: require('path').resolve(__dirname, '../.env') });

const app = express();

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

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('MongoDB connected');
    app.listen(process.env.PORT || 5000, () => {
      console.log(`Server running on port ${process.env.PORT || 5000}`);
    });
  })
  .catch((err) => {
    console.error('MongoDB connection failed:', err.message);
    process.exit(1);
  });