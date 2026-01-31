import Entity from "../models/Entity.js";

export const resolveEntity = async (req, res, next) => {
  try {
    let entity = null;

    // 👤 Client: entity comes from user
    if (req.user.role === "client") {
      entity = await Entity.findOne({ user: req.user._id });
    }

    // 👑 Admin acting as client: entity comes from header
    if (req.user.role === "admin") {
      const entityId = req.headers["x-entity-id"];

      if (!entityId) {
        return res.status(403).json({
          message: "Entity not selected",
        });
      }

      entity = await Entity.findById(entityId);

      if (!entity) {
        return res.status(404).json({
          message: "Entity not found, message from middleware",
        });
      }

      // 🔐 optional but HIGHLY recommended
      // verify admin has access to this entity
      // if (!req.user.entities.includes(entity._id)) { ... }
    }

    if (!entity) {
      return res.status(403).json({ message: "Entity resolution failed" });
    }

    // ✅ attach resolved entity to request
    req.entity = entity;
    next();
  } catch (err) {
    next(err);
  }
};
