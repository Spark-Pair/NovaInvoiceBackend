import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Entity from "../models/Entity.js";
import UserSession from "../models/UserSession.js";

// GET /api/users
export const getAllUsers = async (req, res, next) => {
  try {
    const users = await User.find().select("-password"); // Don't return passwords
    res.status(200).json(users);
  } catch (err) {
    next(err);
  }
};

// Generate JWT
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
};

// POST /api/users/login
export const loginUser = async (req, res, next) => {
  try {
    const { username, password } = req.body;

    const user = await User.findOne({ username });
    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ message: "Invalid username or password" });
    }

    // Check if user role is client and verify entity is active
    if (user.role === "client") {
      const entity = await Entity.findOne({ user: user._id });
      if (!entity || !entity.isActive) {
        return res.status(403).json({ message: "Account is inactive" });
      }
    }

    // 🚫 Check for active session
    const activeSession = await UserSession.findOne({
      user: user._id,
      isActive: true,
    });

    if (activeSession) {
      return res.status(403).json({
        message:
          "User is already logged in",
      });
    }

    // ✅ No active session → allow login
    const token = generateToken(user._id);

    await UserSession.create({
      user: user._id,
      token,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    res.status(200).json({
      _id: user._id,
      name: user.name,        
      username: user.username,
      role: user.role,
      token,
    });
  } catch (err) {
    next(err);
  }
};

// POST /api/users/logout
export const logoutUser = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (!token) {
      return res.status(400).json({ message: "No token provided" });
    }

    const session = await UserSession.findOne({
      token,
      isActive: true,
    });

    if (!session) {
      return res.status(401).json({ message: "No active session found" });
    }

    session.isActive = false;
    session.loggedOutAt = new Date();
    await session.save();

    res.status(200).json({ message: "Logged out successfully" });
  } catch (err) {
    next(err);
  }
};
