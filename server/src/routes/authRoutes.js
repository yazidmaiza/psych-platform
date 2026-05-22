const express = require('express');
const router = express.Router();
const {
	register,
	login,
	getMe,
	refreshToken,
	logout,
	logoutAll,
	listSessions,
	revokeSessionById,
	requestPasswordReset,
	resetPassword,
	verifyEmail,
	resendVerification
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');
const {
	validateRegister,
	validateLogin,
	validateRefreshToken,
	validatePasswordResetRequest,
	validatePasswordReset,
	validateVerifyEmail,
	validateResendVerification
} = require('../middleware/validateMiddleware');

router.post('/register', validateRegister, register);
router.post('/login', validateLogin, login);
router.post('/refresh', validateRefreshToken, refreshToken);
router.post('/logout', protect, logout);
router.post('/logout-all', protect, logoutAll);
router.get('/sessions', protect, listSessions);
router.post('/sessions/:id/revoke', protect, revokeSessionById);
router.post('/password/forgot', validatePasswordResetRequest, requestPasswordReset);
router.post('/password/reset', validatePasswordReset, resetPassword);
router.post('/verify-email', validateVerifyEmail, verifyEmail);
router.post('/verify-email/resend', validateResendVerification, resendVerification);
router.get('/me', protect, getMe);

module.exports = router;
