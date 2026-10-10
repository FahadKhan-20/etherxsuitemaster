const jwt = require('jsonwebtoken');
const { isId } = require('../config/db');

module.exports = (req, res, next) => {
  const authHeader = req.headers.authorization || '';

  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Authorization token is required.',
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    // Purpose tokens (e.g. signed recording links) are not sign-in sessions.
    // Ids that are not uuids come from sessions issued before the move to Postgres: those accounts are gone.
    if (decoded.purpose || !isId(decoded.id)) throw new Error('Not a sign-in token.');
    req.user = decoded;
    return next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token.',
    });
  }
};
