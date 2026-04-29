const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const Psychologist = require('../models/Psychologist');
const PersonaConfig = require('../models/PersonaConfig');

const VALID = {
  tone:            ['warm', 'neutral', 'formal', 'friendly'],
  reflectionLevel: ['low', 'medium', 'high'],
  questionStyle:   ['open-ended', 'guided', 'structured'],
  directiveness:   ['low', 'medium', 'high'],
  verbosity:       ['short', 'medium', 'detailed'],
  pacing:          ['slow', 'moderate']
};

/**
 * GET /api/persona
 * Returns the authenticated psychologist's current persona config.
 */
router.get('/', protect, async (req, res) => {
  try {
    const psychologist = await Psychologist.findOne({ userId: req.user.id }).lean();
    if (!psychologist) {
      return res.status(404).json({ message: 'Psychologist profile not found.' });
    }

    const config = await PersonaConfig.findOne({ psychologistId: psychologist._id }).lean();

    // Return config or defaults
    res.json({
      persona: config || {
        tone: 'warm',
        reflectionLevel: 'medium',
        questionStyle: 'open-ended',
        directiveness: 'low',
        verbosity: 'medium',
        pacing: 'moderate',
        customGreeting: ''
      },
      isDefault: !config
    });
  } catch (err) {
    console.error('[PersonaRoute GET] Error:', err.message);
    res.status(500).json({ message: 'Failed to load persona configuration.' });
  }
});

/**
 * PUT /api/persona
 * Creates or updates the authenticated psychologist's persona config.
 * Validates all fields strictly.
 */
router.put('/', protect, async (req, res) => {
  try {
    const psychologist = await Psychologist.findOne({ userId: req.user.id }).lean();
    if (!psychologist) {
      return res.status(404).json({ message: 'Psychologist profile not found.' });
    }

    const {
      tone, reflectionLevel, questionStyle,
      directiveness, verbosity, pacing, customGreeting
    } = req.body;

    // ── Validation ─────────────────────────────────────────────────────────
    const errors = [];
    if (tone            && !VALID.tone.includes(tone))                     errors.push(`Invalid tone. Allowed: ${VALID.tone.join(', ')}`);
    if (reflectionLevel && !VALID.reflectionLevel.includes(reflectionLevel)) errors.push(`Invalid reflectionLevel. Allowed: ${VALID.reflectionLevel.join(', ')}`);
    if (questionStyle   && !VALID.questionStyle.includes(questionStyle))    errors.push(`Invalid questionStyle. Allowed: ${VALID.questionStyle.join(', ')}`);
    if (directiveness   && !VALID.directiveness.includes(directiveness))    errors.push(`Invalid directiveness. Allowed: ${VALID.directiveness.join(', ')}`);
    if (verbosity       && !VALID.verbosity.includes(verbosity))            errors.push(`Invalid verbosity. Allowed: ${VALID.verbosity.join(', ')}`);
    if (pacing          && !VALID.pacing.includes(pacing))                  errors.push(`Invalid pacing. Allowed: ${VALID.pacing.join(', ')}`);
    if (customGreeting  && customGreeting.length > 300)                     errors.push('customGreeting must be 300 characters or fewer.');

    if (errors.length > 0) {
      return res.status(400).json({ message: 'Validation failed.', errors });
    }

    // ── Upsert ─────────────────────────────────────────────────────────────
    const update = {};
    if (tone)            update.tone            = tone;
    if (reflectionLevel) update.reflectionLevel = reflectionLevel;
    if (questionStyle)   update.questionStyle   = questionStyle;
    if (directiveness)   update.directiveness   = directiveness;
    if (verbosity)       update.verbosity        = verbosity;
    if (pacing)          update.pacing           = pacing;
    if (customGreeting !== undefined) update.customGreeting = customGreeting;

    const persona = await PersonaConfig.findOneAndUpdate(
      { psychologistId: psychologist._id },
      { $set: update },
      { upsert: true, new: true, runValidators: true }
    );

    res.json({ message: 'Persona configuration saved successfully.', persona });
  } catch (err) {
    console.error('[PersonaRoute PUT] Error:', err.message);
    res.status(500).json({ message: 'Failed to save persona configuration.' });
  }
});

/**
 * DELETE /api/persona
 * Resets the psychologist's persona config to defaults.
 */
router.delete('/', protect, async (req, res) => {
  try {
    const psychologist = await Psychologist.findOne({ userId: req.user.id }).lean();
    if (!psychologist) {
      return res.status(404).json({ message: 'Psychologist profile not found.' });
    }

    await PersonaConfig.deleteOne({ psychologistId: psychologist._id });
    res.json({ message: 'Persona reset to defaults.' });
  } catch (err) {
    console.error('[PersonaRoute DELETE] Error:', err.message);
    res.status(500).json({ message: 'Failed to reset persona.' });
  }
});

module.exports = router;
