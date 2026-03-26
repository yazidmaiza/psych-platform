const mongoose = require('mongoose');
const Session = require('./server/src/models/Session');
const Psychologist = require('./server/src/models/Psychologist');
const User = require('./server/src/models/User');

require('dotenv').config({ path: './server/.env' });

async function check() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/psych-platform');
  
  // Find any active session
  const session = await Session.findOne({ status: 'active' });
  if (!session) {
    console.log('No active session found.');
    process.exit(0);
  }
  
  console.log('--- Session ---');
  console.log('Session ID:', session._id.toString());
  console.log('session.psychologistId (type, value):', typeof session.psychologistId, session.psychologistId.toString());

  // Find the psychologist
  const psychById = await Psychologist.findById(session.psychologistId);
  console.log('\n--- Psychologist by session.psychologistId ---');
  console.log(psychById ? `Found: _id=${psychById._id}, userId=${psychById.userId}` : 'NOT FOUND');

  const psychByUser = await Psychologist.findOne({ userId: session.psychologistId });
  console.log('\n--- Psychologist by userId = session.psychologistId ---');
  console.log(psychByUser ? `Found: _id=${psychByUser._id}, userId=${psychByUser.userId}` : 'NOT FOUND');

  const user = await User.findById(session.psychologistId);
  console.log('\n--- User by session.psychologistId ---');
  console.log(user ? `Found: _id=${user._id}, role=${user.role}` : 'NOT FOUND');

  process.exit(0);
}

check().catch(console.error);
