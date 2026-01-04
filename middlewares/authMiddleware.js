import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import UserSession from '../models/UserSession.js';

export const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ message: 'Not authorized, no token' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const session = await UserSession.findOne({
      token,
      isActive: true,
    });

    if (!session) {
      return res.status(401).json({ message: 'Session expired or logged out' });
    }

    req.user = await User.findById(decoded.id).select('-password');
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid token' });
  }
};
