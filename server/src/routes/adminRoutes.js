const express = require('express');
const router = express.Router();
const { getAllUsers, deleteUser, updateUserRole, getStats } = require('../controllers/adminController');
const { protect, restrictTo } = require('../middleware/authMiddleware');

router.use(protect, restrictTo('admin'));

router.get('/users', getAllUsers);
router.delete('/users/:id', deleteUser);
router.put('/users/:id/role', updateUserRole);
router.get('/stats', getStats);

module.exports = router;