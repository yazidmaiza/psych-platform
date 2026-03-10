const Psychologist = require('../models/Psychologist');

// @GET /api/psychologists
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

// @GET /api/psychologists/:id
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

// @PUT /api/psychologists/:id
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