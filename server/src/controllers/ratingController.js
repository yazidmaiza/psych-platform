const Rating = require('../models/Rating');
const Psychologist = require('../models/Psychologist');
const Session = require('../models/Session');

const resolvePsychologist = async (psychologistIdOrUserId) => {
    // Accept either Psychologist document _id OR User _id for convenience
    let psy = await Psychologist.findById(psychologistIdOrUserId).select('userId');
    if (psy) return psy;
    psy = await Psychologist.findOne({ userId: psychologistIdOrUserId }).select('userId');
    return psy;
};

// @POST /api/ratings
exports.submitRating = async (req, res) => {
    try {
        const { psychologistId, answers, comment } = req.body;

        const psy = await resolvePsychologist(psychologistId);
        if (!psy) return res.status(404).json({ message: 'Psychologist not found' });
        const resolvedPsychologistId = psy._id;

        // Must have booked (and completed) at least one consultation to rate
        const hasCompletedSession = await Session.exists({
            patientId: req.user.id,
            psychologistId: psy.userId,
            status: 'completed'
        });
        if (!hasCompletedSession) {
            return res.status(403).json({ message: 'You can only rate a psychologist after completing a consultation.' });
        }

        // Check if already rated
        const existing = await Rating.findOne({
            patientId: req.user.id,
            psychologistId: resolvedPsychologistId
        });
        if (existing) {
            return res.status(400).json({ message: 'You have already rated this psychologist' });
        }

        // Validate answers
        if (!answers || answers.length !== 10) {
            return res.status(400).json({ message: 'Please answer all 10 questions' });
        }

        // Calculate score (sum of all answers)
        const score = answers.reduce((sum, a) => sum + a, 0);

        // Save rating
        const rating = await Rating.create({
            patientId: req.user.id,
            psychologistId: resolvedPsychologistId,
            answers,
            score,
            comment
        });

        // Update psychologist average rating
        const allRatings = await Rating.find({ psychologistId: resolvedPsychologistId });
        const totalRatings = allRatings.length;
        const averageScore = allRatings.reduce((sum, r) => sum + r.score, 0) / totalRatings;
        // Convert to 0-5 scale (score is 10-50, divide by 10)
        const averageRating = Math.round((averageScore / 10) * 10) / 10;

        await Psychologist.findByIdAndUpdate(resolvedPsychologistId, {
            averageRating,
            totalRatings
        });

        res.status(201).json({ rating, averageRating, totalRatings, psychologistId: resolvedPsychologistId });

    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

// @GET /api/ratings/psychologist/:psychologistId
exports.getPsychologistRating = async (req, res) => {
    try {
        const psychologist = await resolvePsychologist(req.params.psychologistId)
            .select('averageRating totalRatings');
        if (!psychologist) return res.status(404).json({ message: 'Psychologist not found' });
        res.status(200).json({
            averageRating: psychologist.averageRating,
            totalRatings: psychologist.totalRatings
        });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

// @GET /api/ratings/check/:psychologistId
exports.checkRating = async (req, res) => {
    try {
        const psy = await resolvePsychologist(req.params.psychologistId);
        if (!psy) return res.status(200).json({ hasRated: false });

        const existing = await Rating.findOne({
            patientId: req.user.id,
            psychologistId: psy._id
        });
        res.status(200).json({ hasRated: !!existing });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};
