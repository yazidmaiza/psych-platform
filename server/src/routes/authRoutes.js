const express = require('express');
const router = express.Router();
const {
	register,
	startRegistration,
	confirmRegistration,
	uploadPendingRegistrationDocuments,
	resendPendingRegistrationCode,
	login,
	verifyLogin2fa,
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
router.post('/register/start', validateRegister, startRegistration);
router.post('/register/confirm', validateVerifyEmail, confirmRegistration);
router.post('/register/pending/:id/resend', resendPendingRegistrationCode);
router.post('/login', validateLogin, login);
router.post('/login/verify', validateVerifyEmail, verifyLogin2fa);
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

// Pending registration docs upload (psychologists only). No auth yet; protected by pendingId+expiry.
const multer = require('multer');
const pendingUpload = multer({ dest: 'uploads/', limits: { fileSize: 100 * 1024 * 1024 } });
router.post('/register/pending/:id/documents', pendingUpload.fields([
	{ name: 'cv', maxCount: 1 },
	{ name: 'diploma', maxCount: 1 },
	{ name: 'idFront', maxCount: 1 },
	{ name: 'idBack', maxCount: 1 },
	{ name: 'introVideo', maxCount: 1 }
]), uploadPendingRegistrationDocuments);

module.exports = router;
