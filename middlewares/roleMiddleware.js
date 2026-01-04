export const checkRole = (allowedRoles = []) => {
  return (req, res, next) => {
    // protect middleware MUST run before this
    if (!req.user || !req.user.role) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        message: 'Access denied: insufficient permissions',
      });
    }

    next();
  };
};
