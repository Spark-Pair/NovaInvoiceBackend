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

export const getAdmins = async (req, res, next) => {
  try {
    const admins = await User.find({ role: "admin" })
      .select("name username role isActive createdAt updatedAt")
      .sort({ createdAt: -1 })
      .lean();

    const activeUserIds = await UserSession.distinct("user", {
      user: { $in: admins.map((admin) => admin._id) },
      isActive: true,
    });
    const activeUserIdSet = new Set(activeUserIds.map((id) => String(id)));

    res.status(200).json({
      admins: admins.map((admin) => ({
        ...admin,
        isActive: admin.isActive !== false,
        isLoggedIn: activeUserIdSet.has(String(admin._id)),
      })),
    });
  } catch (err) {
    next(err);
  }
};

export const createAdmin = async (req, res, next) => {
  try {
    const name = String(req.body.name || "").trim();
    const username = String(req.body.username || "").trim().toLowerCase();
    const password = String(req.body.password || "");

    if (!name || !username || !password) {
      return res.status(400).json({
        message: "Name, username and password are required",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        message: "Password must be at least 6 characters",
      });
    }

    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ message: "Username already exists" });
    }

    const admin = await User.create({
      name,
      username,
      password,
      role: "admin",
    });

    res.status(201).json({
      message: "Admin created successfully",
      admin: {
        _id: admin._id,
        name: admin.name,
        username: admin.username,
        role: admin.role,
        isActive: admin.isActive,
        isLoggedIn: false,
        createdAt: admin.createdAt,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const logoutAdminSessions = async (req, res, next) => {
  try {
    const admin = await User.findOne({
      _id: req.params.id,
      role: "admin",
    });

    if (!admin) {
      return res.status(404).json({ message: "Admin not found" });
    }

    const sessionResult = await UserSession.updateMany(
      { user: admin._id, isActive: true },
      { isActive: false, loggedOutAt: new Date() }
    );

    res.status(200).json({
      message:
        sessionResult.modifiedCount > 0
          ? "Admin logged out successfully"
          : "Admin has no active sessions",
      loggedOutSessions: sessionResult.modifiedCount,
    });
  } catch (err) {
    next(err);
  }
};

export const toggleAdminStatus = async (req, res, next) => {
  try {
    const admin = await User.findOne({
      _id: req.params.id,
      role: "admin",
    });

    if (!admin) {
      return res.status(404).json({ message: "Admin not found" });
    }

    const isCurrentlyActive = admin.isActive !== false;
    admin.isActive = !isCurrentlyActive;
    await admin.save();

    let loggedOutSessions = 0;
    if (!admin.isActive) {
      const sessionResult = await UserSession.updateMany(
        { user: admin._id, isActive: true },
        { isActive: false, loggedOutAt: new Date() }
      );
      loggedOutSessions = sessionResult.modifiedCount;
    }

    res.status(200).json({
      message: `Admin ${admin.isActive ? "activated" : "deactivated"} successfully`,
      admin: {
        _id: admin._id,
        isActive: admin.isActive,
      },
      loggedOutSessions,
    });
  } catch (err) {
    next(err);
  }
};

export const resetAdminPassword = async (req, res, next) => {
  try {
    const password = String(req.body.password || "");

    if (password.length < 6) {
      return res.status(400).json({
        message: "Password must be at least 6 characters",
      });
    }

    const admin = await User.findOne({
      _id: req.params.id,
      role: "admin",
    });

    if (!admin) {
      return res.status(404).json({ message: "Admin not found" });
    }

    admin.password = password;
    await admin.save();

    const sessionResult = await UserSession.updateMany(
      { user: admin._id, isActive: true },
      { isActive: false, loggedOutAt: new Date() }
    );

    res.status(200).json({
      message:
        sessionResult.modifiedCount > 0
          ? "Admin password reset and active sessions logged out"
          : "Admin password reset successfully",
      loggedOutSessions: sessionResult.modifiedCount,
    });
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
    const { username, password, forceLogin = false } = req.body;

    const user = await User.findOne({ username });
    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ message: "Invalid username or password" });
    }

    if (user.isActive === false) {
      return res.status(403).json({ message: "Account is inactive" });
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
      if (user.role !== "dev") {
        return res.status(403).json({
          code: "ACTIVE_SESSION",
          message: "This account is already logged in somewhere else",
        });
      }

      if (!forceLogin) {
        return res.status(409).json({
          code: "ACTIVE_SESSION",
          message: "Already logged in somewhere else",
        });
      }

      await UserSession.updateMany(
        { user: user._id, isActive: true },
        { isActive: false, loggedOutAt: new Date() }
      );
    } else if (forceLogin && user.role !== "dev") {
      return res.status(403).json({
        message: "Force login is only available to developer accounts",
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
      settings: user.settings,
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

// GTET /api/users/settings
export const getUserSettings = async (req, res, next) => {
  try {
    const userId = req.entity.user; // Assuming user ID is available in req.user
    const user = await User.findById(userId).select("settings");
    res.status(200).json(user.settings);
  } catch (err) {
    next(err);
  }
};

// PATCH /api/users/settings
export const setUserSettings = async (req, res, next) => {
  try {
    const userId = req.entity.user; // Assuming user ID is available in req.user
    const { settings } = req.body;

    // Update user settings
    await User.findByIdAndUpdate(userId, { settings });

    res.status(200).json({ message: "Settings updated successfully" });
  } catch (err) {
    next(err);
  }
};
