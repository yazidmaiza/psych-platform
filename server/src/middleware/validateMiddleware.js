const { body, validationResult } = require('express-validator');

const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            message: errors.array()[0].msg
        });
    }
    next();
};

const validateRegister = [
    body('email')
        .isEmail().withMessage('Please provide a valid email address')
        .normalizeEmail(),
    body('password')
        .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
        .matches(/\d/).withMessage('Password must contain at least one number'),
    body('role')
        .isIn(['patient', 'psychologist']).withMessage('Role must be patient or psychologist'),
    handleValidationErrors
];

const validateLogin = [
    body('email')
        .isEmail().withMessage('Please provide a valid email address')
        .normalizeEmail(),
    body('password')
        .notEmpty().withMessage('Password is required'),
    handleValidationErrors
];

const validateSession = [
    body('psychologistId')
        .notEmpty().withMessage('Psychologist ID is required')
        .isMongoId().withMessage('Invalid psychologist ID'),
    handleValidationErrors
];

const validateRating = [
    body('psychologistId')
        .notEmpty().withMessage('Psychologist ID is required')
        .isMongoId().withMessage('Invalid psychologist ID'),
    body('answers')
        .isArray({ min: 10, max: 10 }).withMessage('Please answer all 10 questions')
        .custom(answers => answers.every(a => a >= 1 && a <= 5))
        .withMessage('Each answer must be between 1 and 5'),
    handleValidationErrors
];

const validateProfile = [
    body('firstName').notEmpty().withMessage('First name is required'),
    body('lastName').notEmpty().withMessage('Last name is required'),
    body('city').notEmpty().withMessage('City is required'),
    handleValidationErrors
];

module.exports = {
    validateRegister,
    validateLogin,
    validateSession,
    validateRating,
    validateProfile
};
