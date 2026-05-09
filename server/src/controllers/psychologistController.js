const Psychologist = require('../models/Psychologist');
const CalendarSlot = require('../models/CalendarSlot');

const toLower = (value) => String(value || '').toLowerCase();

const computeTextScore = (psy, query) => {
  if (!query) return 0;
  const term = toLower(query);
  const fields = [
    toLower(psy.firstName),
    toLower(psy.lastName),
    toLower(psy.city),
    Array.isArray(psy.specializations) ? psy.specializations.map(toLower).join(' ') : toLower(psy.specializations),
    Array.isArray(psy.languages) ? psy.languages.map(toLower).join(' ') : toLower(psy.languages)
  ];

  const haystack = fields.join(' ');
  if (!haystack.includes(term)) return 0;

  const specializationHit = Array.isArray(psy.specializations)
    ? psy.specializations.some((s) => toLower(s).includes(term))
    : toLower(psy.specializations).includes(term);

  return specializationHit ? 1 : 0.7;
};

const computeRatingScore = (psy) => {
  const average = Number(psy.averageRating || 0) / 5;
  const total = Number(psy.totalRatings || 0);
  const confidence = 1 - Math.exp(-total / 5);
  return average * confidence;
};

const computeDistanceScore = (distanceKm, maxKm) => {
  if (distanceKm === null || distanceKm === undefined) return null;
  const ratio = Math.max(0, 1 - distanceKm / Math.max(maxKm, 1));
  return Math.min(1, ratio);
};

exports.getNearbyPsychologists = async (req, res) => {
  try {
    const { lat, lng, distance = 10, search, sort = 'distance' } = req.query; // distance in km
    
    if (!lat || !lng) {
      return res.status(400).json({ message: 'Latitude and longitude are required' });
    }

    let filter = { isApproved: true };

    if (search) {
      const regex = new RegExp(search, 'i');
      filter.$or = [
        { firstName: regex },
        { lastName: regex },
        { city: regex },
        { specializations: regex },
        { languages: regex }
      ];
    }

    if (sort === 'rating') {
      const radius = parseFloat(distance) / 6378.1;
      filter.location = {
        $geoWithin: {
          $centerSphere: [[parseFloat(lng), parseFloat(lat)], radius]
        }
      };
      
      const psychologists = await Psychologist.find(filter)
        .populate('userId', 'email')
        .sort({ averageRating: -1, totalRatings: -1, createdAt: -1 });
        
      return res.status(200).json((psychologists || []).filter(p => p.userId));
    } else {
      filter.location = {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [parseFloat(lng), parseFloat(lat)]
          },
          $maxDistance: parseFloat(distance) * 1000 // meters
        }
      };
      
      const psychologists = await Psychologist.find(filter)
        .populate('userId', 'email');
        
      return res.status(200).json((psychologists || []).filter(p => p.userId));
    }
  } catch (err) {
    if (err && err.name === 'ValidationError') {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.getAllPsychologists = async (req, res) => {
  try {
    const { search, sort = 'rating' } = req.query;
    let filter = { isApproved: true };
    
    if (search) {
      const regex = new RegExp(search, 'i');
      filter.$or = [
        { firstName: regex },
        { lastName: regex },
        { city: regex },
        { specializations: regex },
        { languages: regex }
      ];
    }
    
    const psychologists = await Psychologist.find(filter)
      .populate('userId', 'email')
      .sort(sort === 'rating' ? { averageRating: -1, createdAt: -1 } : { createdAt: -1 });

    res.status(200).json((psychologists || []).filter(p => p.userId));
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

exports.searchPsychologists = async (req, res) => {
  try {
    const {
      search,
      lat,
      lng,
      distance = 50,
      limit = 100
    } = req.query;

    const maxDistanceKm = Number(distance) || 50;
    const resultLimit = Math.min(Number(limit) || 100, 200);

    let baseList = [];
    if (lat && lng) {
      const pipeline = [
        {
          $geoNear: {
            near: {
              type: 'Point',
              coordinates: [parseFloat(lng), parseFloat(lat)]
            },
            distanceField: 'distanceMeters',
            maxDistance: maxDistanceKm * 1000,
            spherical: true,
            query: { isApproved: true }
          }
        }
      ];

      if (search) {
        const regex = new RegExp(search, 'i');
        pipeline.push({
          $match: {
            $or: [
              { firstName: regex },
              { lastName: regex },
              { city: regex },
              { specializations: regex },
              { languages: regex }
            ]
          }
        });
      }

      pipeline.push({ $limit: resultLimit });

      baseList = await Psychologist.aggregate(pipeline);
      await Psychologist.populate(baseList, { path: 'userId', select: 'email' });
    } else {
      const filter = { isApproved: true };
      if (search) {
        const regex = new RegExp(search, 'i');
        filter.$or = [
          { firstName: regex },
          { lastName: regex },
          { city: regex },
          { specializations: regex },
          { languages: regex }
        ];
      }

      baseList = await Psychologist.find(filter)
        .populate('userId', 'email')
        .limit(resultLimit)
        .lean();
    }

    const psychologists = (baseList || []).filter((p) => p.userId);
    const psychologistUserIds = psychologists
      .map((p) => p.userId?._id || p.userId)
      .filter(Boolean);

    const now = new Date();
    const horizon = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const availabilityAgg = await CalendarSlot.aggregate([
      {
        $match: {
          psychologistId: { $in: psychologistUserIds },
          isBooked: false,
          pendingSessionId: null,
          start: { $gte: now, $lte: horizon }
        }
      },
      {
        $group: {
          _id: '$psychologistId',
          count: { $sum: 1 },
          nextAvailableAt: { $min: '$start' }
        }
      }
    ]);

    const availabilityMap = new Map(
      availabilityAgg.map((item) => [String(item._id), item])
    );

    const scored = psychologists.map((psy) => {
      const userId = String(psy.userId?._id || psy.userId || '');
      const availability = availabilityMap.get(userId) || { count: 0, nextAvailableAt: null };
      const availabilityScore = Math.min(availability.count, 6) / 6;
      const ratingScore = computeRatingScore(psy);
      const textScore = computeTextScore(psy, search);

      const distanceKm = psy.distanceMeters ? psy.distanceMeters / 1000 : null;
      const distanceScore = computeDistanceScore(distanceKm, maxDistanceKm);

      const signals = {
        rating: 0.4,
        availability: 0.25,
        distance: distanceScore === null ? 0 : 0.2,
        text: search ? 0.15 : 0
      };

      const weightSum = Object.values(signals).reduce((sum, v) => sum + v, 0) || 1;
      const normalized = Object.keys(signals).reduce((acc, key) => {
        acc[key] = signals[key] / weightSum;
        return acc;
      }, {});

      const score =
        ratingScore * normalized.rating +
        availabilityScore * normalized.availability +
        (distanceScore === null ? 0 : distanceScore * normalized.distance) +
        textScore * normalized.text;

      return {
        ...psy,
        availabilityCount: availability.count,
        nextAvailableAt: availability.nextAvailableAt,
        distanceKm,
        rankScore: Number(score.toFixed(4))
      };
    });

    scored.sort((a, b) => b.rankScore - a.rankScore);
    res.status(200).json(scored);
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

exports.getPsychologistByUserId = async (req, res) => {
  try {
    const psychologist = await Psychologist.findOne({ userId: req.params.userId })
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
    const { bio, specializations, languages, availability, city, firstName, lastName, sessionPrice, location } = req.body;
    let updateData = { bio, specializations, languages, availability, city, firstName, lastName, sessionPrice };
    
    if (location && location.lat && location.lng) {
      updateData.location = {
        type: 'Point',
        coordinates: [parseFloat(location.lng), parseFloat(location.lat)]
      };
    }

    const psychologist = await Psychologist.findOneAndUpdate(
      { userId: req.user.id },
      updateData,
      { returnDocument: 'after' }
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

  const { firstName, lastName, bio, specializations, languages, city, availability, sessionPrice, location } = req.body;

    const profileData = {
      userId: req.user.id,
      firstName,
      lastName,
      bio,
      specializations,
      languages,
      city,
      availability,
      sessionPrice: sessionPrice || 0
    };

    if (location && location.lat && location.lng) {
      profileData.location = {
        type: 'Point',
        coordinates: [parseFloat(location.lng), parseFloat(location.lat)]
      };
    }

    const profile = new Psychologist(profileData);

    await profile.save();
    res.status(201).json(profile);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};
