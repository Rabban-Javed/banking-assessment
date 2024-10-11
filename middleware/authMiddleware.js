const jwt = require('jsonwebtoken');
require('dotenv').config();

const authenticateToken = (req, res, next) => {
  const token = req.header('Authorization').split(' ')[1]; // Bearer <token>
  if (!token) return res.status(401).json({ message: 'No token, authorization denied' });
  console.log('Token received:', token);


  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(403).json({ message: 'Token is not valid' });
  }
};

module.exports = { authenticateToken };
