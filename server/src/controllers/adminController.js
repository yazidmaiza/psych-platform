const User = require('../models/User');
const Psychologist = require('../models/Psychologist');
const Session = require('../models/Session');
const CalendarSlot = require('../models/CalendarSlot');

// @GET /api/admin/users
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.status(200).json(users);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// @DELETE /api/admin/users/:id
exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user.role === 'admin') return res.status(403).json({ message: 'Cannot delete admin' });

    // Clean up related documents so deleted profiles do not keep showing up in lists
    if (user.role === 'psychologist') {
      await Psychologist.deleteMany({ userId: user._id });
      await CalendarSlot.deleteMany({ psychologistId: user._id });
      await Session.deleteMany({ psychologistId: user._id });
    }

    if (user.role === 'patient') {
      await Session.deleteMany({ patientId: user._id });
      await CalendarSlot.updateMany(
        { patientId: user._id },
        { $set: { patientId: null, isBooked: false, pendingPatientId: null, pendingSessionId: null, pendingAt: null } }
      );
    }

    await User.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: 'User deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// @PUT /api/admin/users/:id/role
exports.updateUserRole = async (req, res) => {
  try {
    const { role } = req.body;
    if (!['patient', 'psychologist', 'admin'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role' });
    }
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role },
      { returnDocument: 'after' }
    ).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.status(200).json(user);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

// @GET /api/admin/stats
exports.getStats = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalPatients = await User.countDocuments({ role: 'patient' });
    const totalPsychologists = await User.countDocuments({ role: 'psychologist' });
    const totalSessions = await Session.countDocuments();
    const activeSessions = await Session.countDocuments({ status: 'active' });
    const completedSessions = await Session.countDocuments({ status: 'completed' });

    res.status(200).json({
      totalUsers,
      totalPatients,
      totalPsychologists,
      totalSessions,
      activeSessions,
      completedSessions
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};
