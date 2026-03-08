const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const psychologistRoutes = require('./routes/psychologist.routes');
const messageRoutes = require('./routes/message.routes');
const dashboardRoutes = require('./routes/dashboard.routes');

dotenv.config({ path: require('path').resolve(__dirname, '../.env') });

const app = express();

// Middleware
app.use(cors());
app.use(express.json());


// Health check route
app.get('/', (req, res) => {
  res.json({ message: 'Psych Platform API running' });
});

app.use('/api/psychologists', psychologistRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/dashboard', dashboardRoutes);

// DB Connection
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