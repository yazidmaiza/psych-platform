const mongoose = require('mongoose');

/**
 * Model: PersonaConfig
 * Stores a psychologist's chatbot persona configuration.
 * One document per psychologist (upsert on update).
 *
 * Safety Note: This model controls STYLE only.
 * Risk detection and safety protocols are NEVER governed by persona config.
 */
const personaConfigSchema = new mongoose.Schema(
  {
    psychologistId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Psychologist',
      required: true,
      unique: true,
      index: true
    },

    // ── Tone ──────────────────────────────────────────────────────────────────
    tone: {
      type: String,
      enum: ['warm', 'neutral', 'formal', 'friendly'],
      default: 'warm'
    },

    // ── Reflection depth ──────────────────────────────────────────────────────
    reflectionLevel: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'medium'
    },

    // ── Question style ────────────────────────────────────────────────────────
    questionStyle: {
      type: String,
      enum: ['open-ended', 'guided', 'structured'],
      default: 'open-ended'
    },

    // ── How much the bot steers the conversation ──────────────────────────────
    directiveness: {
      type: String,
      enum: ['low', 'medium', 'high'],
      default: 'low'
    },

    // ── Response length ───────────────────────────────────────────────────────
    verbosity: {
      type: String,
      enum: ['short', 'medium', 'detailed'],
      default: 'medium'
    },

    // ── Conversation pacing ───────────────────────────────────────────────────
    pacing: {
      type: String,
      enum: ['slow', 'moderate'],
      default: 'moderate'
    },

    // ── Optional custom intro message ─────────────────────────────────────────
    customGreeting: {
      type: String,
      default: '',
      maxlength: 300
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('PersonaConfig', personaConfigSchema);
