const mongoose = require('mongoose');
const Session = require('./src/models/Session');
const User = require('./src/models/User');
require('dotenv').config();

async function check() {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/psych-platform');
  
  const id = "69b37368274998bfa05a381e";
  try {
    const session = await Session.findById(id);
    const psychUser = await User.findById(session.psychologistId);
    console.log("Psy Role:", psychUser.role);
    console.log("Psy ID:", psychUser._id.toString());
  } catch(e) { console.log(e); }
  
  process.exit();
}
check();
