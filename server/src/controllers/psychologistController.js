const Psychologist = require('../models/Psychologist');

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
    const { photo, bio, specializations, languages, availability, city, firstName, lastName, sessionPrice, location } = req.body;
    let updateData = { photo, bio, specializations, languages, availability, city, firstName, lastName, sessionPrice };
    
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
