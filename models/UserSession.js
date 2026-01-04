import mongoose from 'mongoose';

const userSessionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    token: {
      type: String,
      required: true,
    },
    ipAddress: String,
    userAgent: String,
    loggedInAt: {
      type: Date,
      default: Date.now,
    },
    loggedOutAt: Date,
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

const UserSession = mongoose.model('UserSession', userSessionSchema);
export default UserSession;
