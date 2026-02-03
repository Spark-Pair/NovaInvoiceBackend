export const errorHandler = (err, req, res, next) => {
  let statusCode = res.statusCode && res.statusCode !== 200
    ? res.statusCode
    : 500;

  let message = err.message || 'Server error';

  // ✅ Mongo duplicate key (unique fields)
  if (err.code === 11000) {
    statusCode = 400;
    const field = Object.keys(err.keyValue)[0];
    message = `${field} already exists`;
  }

  // ✅ Mongoose validation errors
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = Object.values(err.errors)
      .map(e => e.message)
      .join(', ');
  }

  res.status(statusCode).json({ message });
};
