const jwt = require('jsonwebtoken');

const protect = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();

  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      console.log(`[authMiddleware] Access denied. User role: ${req.user.role}, required: ${roles}`);
      return res.status(403).json({ 
        message: 'Access denied - Role mismatch',
        debug: { userRole: req.user.role, required: roles }
      });
    }
    next();
  };
};

module.exports = { protect, restrictTo };