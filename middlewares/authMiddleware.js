import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import UserSession from '../models/UserSession.js';
import Entity from '../models/Entity.js';

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
    // 🔐 Verify JWT
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 🔁 Check active session
    const session = await UserSession.findOne({
      token,
      user: decoded.id,
      isActive: true,
    });

    if (!session) {
      return res.status(401).json({ message: 'Session expired or logged out' });
    }

    // 👤 Load user
    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    // 🏢 If client → check entity status
    if (user.role === 'client') {
      const entity = await Entity.findOne({ user: user._id });

      if (!entity || !entity.isActive) {
        return res.status(401).json({ message: 'Entity deactivated' });
      }
    }

    // ✅ Attach to request
    req.user = user;
    req.session = session;

    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};