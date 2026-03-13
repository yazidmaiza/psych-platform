const Psychologist = require('../models/Psychologist');

exports.getAllPsychologists = async (req, res) => {
  try {
    const { specialization, language, city } = req.query;
    let filter = {};
    if (specialization) filter.specializations = { $in: [specialization] };
    if (language) filter.languages = { $in: [language] };
    if (city) filter.city = { $regex: city, $options: 'i' };
    const psychologists = await Psychologist.find(filter)
      .populate('userId', 'email')
      .sort({ createdAt: -1 });
    res.status(200).json(psychologists);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.getPsychologist = async (req, res) => {
  try {
    const psychologist = await Psychologist.findById(req.params.id)
      .populate('userId', 'email');
    if (!psychologist) {
      return res.status(404).json({ message: 'Psychologist not found' });
    }
    res.status(200).json(psychologist);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.updatePsychologist = async (req, res) => {
  try {
    const { photo, bio, specializations, languages, availability, city, firstName, lastName } = req.body;
    const psychologist = await Psychologist.findOneAndUpdate(
      { userId: req.user.id },
      { photo, bio, specializations, languages, availability, city, firstName, lastName },
      { new: true }
    );
    if (!psychologist) {
      return res.status(404).json({ message: 'Psychologist not found' });
    }
    res.status(200).json(psychologist);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};
// @POST /api/psychologists/profile
exports.createProfile = async (req, res) => {
  try {
    const existing = await Psychologist.findOne({ userId: req.user.id });
    if (existing) return res.status(400).json({ message: 'Profile already exists' });

    const { firstName, lastName, bio, specializations, languages, city, availability } = req.body;

    const profile = new Psychologist({
      userId: req.user.id,
      firstName,
      lastName,
      bio,
      specializations,
      languages,
      city,
      availability
    });

    await profile.save();
    res.status(201).json(profile);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};