import Entity from "../models/Entity.js";
import User from "../models/User.js";
import UserSession from "../models/UserSession.js";

// POST /api/entities
export const createEntity = async (req, res, next) => {
  try {
    const {
      image,
      businessName,
      registrationType,
      province,
      ntn,
      cnic,
      strn,
      fullAddress,
      username,
      password,
    } = req.body;

    const entityUser = await User.create({
      name: businessName,
      username,
      password: password,
    });

    // Create the entity
    const entity = await Entity.create({
      image,
      businessName,
      registrationType,
      province,
      ntn,
      cnic,
      strn,
      fullAddress,
      isActive: true,
      user: entityUser._id,
    });

    // Populate user field before sending response
    const populatedEntity = await entity.populate('user', 'name username role');

    res.status(201).json({
      message: "Entity created successfully",
      entity: populatedEntity,
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/entities?page=1&limit=50&businessName=abc&status=Active
export const getEntities = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 50);
    const skip = (page - 1) * limit;

    const {
      username,
      businessName,
      ntn,
      cnic,
      strn,
      registrationType,
      province,
      status,
      dateFrom,
      dateTo,
    } = req.query;

    /** -------------------------------
     *  Build Entity Query
     *  ------------------------------- */
    const query = {};

    if (businessName) {
      query.businessName = { $regex: businessName, $options: "i" };
    }

    if (ntn) query.ntn = ntn;
    if (cnic) query.cnic = cnic;
    if (strn) query.strn = strn;

    if (registrationType && registrationType !== "Select...") {
      query.registrationType = registrationType;
    }

    if (province && province !== "Select...") {
      query.province = province;
    }

    if (status) {
      query.isActive = status === "Active";
    }

    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
      if (dateTo) query.createdAt.$lte = new Date(dateTo);
    }

    /** -------------------------------
     *  Handle username filter (via User)
     *  ------------------------------- */
    let userIds = null;

    if (username) {
      const users = await User.find({
        username: { $regex: username, $options: "i" },
      }).select("_id");

      userIds = users.map((u) => u._id);
      query.user = { $in: userIds };
    }

    /** -------------------------------
     *  Fetch Data + Count
     *  ------------------------------- */
    const [
      entities,
      total,
      activeTotal,
      activeProvinceTotal
    ] = await Promise.all([
      // paginated data
      Entity.find(query)
        .populate("user", "name username role")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),

      // filtered total
      Entity.countDocuments(query),

      // total active entities
      Entity.countDocuments({ isActive: true }),

      // distinct provinces count where active
      Entity.distinct("province", { isActive: true }).then(p => p.length),
    ]);

    res.status(200).json({
      data: entities,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      stats: {
        activeTotal,
        activeProvinceTotal,
      },
    });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/entities/:id/
export const updateEntity = async (req, res, next) => {
  try {
    const { id } = req.params;

    const {
      image,
      businessName,
      registrationType,
      province,
      ntn,
      cnic,
      strn,
      fullAddress,
    } = req.body;

    // Build update object dynamically (PATCH best practice)
    const updateData = {};

    if (image !== undefined) updateData.image = image;
    if (businessName !== undefined) updateData.businessName = businessName;
    if (registrationType !== undefined) updateData.registrationType = registrationType;
    if (province !== undefined) updateData.province = province;
    if (ntn !== undefined) updateData.ntn = ntn;
    if (cnic !== undefined) updateData.cnic = cnic;
    if (strn !== undefined) updateData.strn = strn;
    if (fullAddress !== undefined) updateData.fullAddress = fullAddress;

    const entity = await Entity.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    ).populate('user', 'name username role');

    if (!entity) {
      return res.status(404).json({ message: 'Entity not found' });
    }

    res.json({
      message: 'Entity updated successfully',
      entity,
    });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/entities/:id/toggle-status
export const toggleEntityStatus = async (req, res, next) => {
  try {
    const { id } = req.params;

    const entity = await Entity.findById(id).populate('user', 'name username role');
    if (!entity) {
      return res.status(404).json({ message: 'Entity not found' });
    }

    // Toggle active status
    entity.isActive = !entity.isActive;
    await entity.save();

    // If entity is being deactivated, deactivate all active sessions for its user
    if (!entity.isActive && entity.user) {
      await UserSession.updateMany(
        { user: entity.user._id, isActive: true },
        { isActive: false }
      );
    }

    res.status(200).json({
      message: `Entity ${entity.isActive ? 'activated' : 'deactivated'} successfully`,
      entity,
    });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/entities/:id/reset-password
export const resetEntityPassword = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ message: 'Password is required' });
    }

    const entity = await Entity.findById(id).populate('user');
    if (!entity || !entity.user) {
      return res.status(404).json({ message: 'Entity or user not found' });
    }

    entity.user.password = password;
    await entity.user.save();

    res.status(200).json({
      message: 'Password reset successfully',
    });
  } catch (err) {
    next(err);
  }
};