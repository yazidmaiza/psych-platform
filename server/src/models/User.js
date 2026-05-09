const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['patient', 'psychologist', 'admin'],
    required: true
  },
  // Optional fine-grained permissions for admins. Legacy deployments may not set this field.
  // When unset/empty for an admin, routes guarded by admin permissions will allow access by default.
  adminPermissions: {
    type: [String],
    default: []
  },
  isVerified: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

userSchema.pre('save', async function() {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 10);
});

userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
