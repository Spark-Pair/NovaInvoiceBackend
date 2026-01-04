import Buyer from "../models/Buyer.js";
import Entity from "../models/Entity.js";

// export const createBuyer = async (req, res, next) => {
//   try {
//     const {
//       buyerName,
//       registrationType,
//       province,
//       ntn,
//       cnic,
//       strn,
//       fullAddress,
//       relatedEntity,
//     } = req.body;

//     // Ensure parent entity exists
//     const entity = await Entity.findById(relatedEntity);
//     if (!entity) {
//       return res.status(404).json({ message: "Related entity not found" });
//     }

//     const buyer = await Buyer.create({
//       buyerName,
//       registrationType,
//       province,
//       ntn,
//       cnic,
//       strn,
//       fullAddress,
//       isActive: true,
//       relatedEntity,
//     });

//     res.status(201).json({
//       message: "Buyer created successfully",
//       buyer,
//     });
//   } catch (err) {
//     next(err);
//   }
// };

export const createBuyer = async (req, res, next) => {
  try {
    const {
      buyerName,
      registrationType,
      province,
      ntn,
      cnic,
      strn,
      fullAddress,
    } = req.body;

    // 🔐 Get entity from logged-in user
    const entity = await Entity.findOne({ user: req.user._id });
    if (!entity) {
      return res.status(403).json({
        message: "Entity not found for this user",
      });
    }

    const buyer = await Buyer.create({
      buyerName,
      registrationType,
      province,
      ntn,
      cnic,
      strn,
      fullAddress,
      isActive: true,
      relatedEntity: entity._id,
    });

    res.status(201).json({
      message: "Buyer added successfully",
      buyer,
    });
  } catch (err) {
    next(err);
  }
};

// export const getBuyers = async (req, res, next) => {
//   try {
//     const page = Math.max(1, parseInt(req.query.page) || 1);
//     const limit = Math.min(100, parseInt(req.query.limit) || 50);
//     const skip = (page - 1) * limit;

//     const {
//       buyerName,
//       registrationType,
//       province,
//       ntn,
//       cnic,
//       strn,
//       fullAddress,
//       dateFrom,
//       dateTo,
//       relatedEntity,
//     } = req.query;

//     /** -------------------------------
//      * Build Query
//      * ------------------------------- */
//     const query = {};

//     if (relatedEntity) {
//       query.relatedEntity = relatedEntity;
//     }

//     if (buyerName) {
//       query.buyerName = { $regex: buyerName, $options: "i" };
//     }

//     if (registrationType && registrationType !== "Select...") {
//       query.registrationType = registrationType;
//     }

//     if (province && province !== "Select...") {
//       query.province = province;
//     }

//     if (ntn) query.ntn = ntn;
//     if (cnic) query.cnic = cnic;
//     if (strn) query.strn = strn;

//     if (fullAddress) {
//       query.fullAddress = { $regex: fullAddress, $options: "i" };
//     }

//     if (dateFrom || dateTo) {
//       query.createdAt = {};
//       if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
//       if (dateTo) query.createdAt.$lte = new Date(dateTo);
//     }

//     /** -------------------------------
//      * Fetch Data + Count
//      * ------------------------------- */
//     const [buyers, total] = await Promise.all([
//       Buyer.find(query)
//         .populate("relatedEntity", "businessName province")
//         .sort({ createdAt: -1 })
//         .skip(skip)
//         .limit(limit),

//       Buyer.countDocuments(query),
//     ]);

//     res.status(200).json({
//       data: buyers,
//       meta: {
//         page,
//         limit,
//         total,
//         totalPages: Math.ceil(total / limit),
//       },
//     });
//   } catch (err) {
//     next(err);
//   }
// };

export const getBuyers = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 50);
    const skip = (page - 1) * limit;

    // 🔐 get entity from logged-in user
    const entity = await Entity.findOne({ user: req.user._id });
    if (!entity) {
      return res.status(404).json({ message: "Entity not found" });
    }

    // 🔍 build filters
    const filters = {
      relatedEntity: entity._id,
    };

    if (req.query.buyerName) {
      filters.buyerName = { $regex: req.query.buyerName, $options: "i" };
    }

    if (req.query.registrationType) {
      filters.registrationType = req.query.registrationType;
    }

    if (req.query.province) {
      filters.province = req.query.province;
    }

    if (req.query.ntn) {
      filters.ntn = { $regex: req.query.ntn, $options: "i" };
    }

    if (req.query.cnic) {
      filters.cnic = { $regex: req.query.cnic, $options: "i" };
    }

    if (req.query.status) {
      filters.isActive = req.query.status === "Active";
    }

    if (req.query.dateFrom || req.query.dateTo) {
      filters.createdAt = {};
      if (req.query.dateFrom) {
        filters.createdAt.$gte = new Date(req.query.dateFrom);
      }
      if (req.query.dateTo) {
        filters.createdAt.$lte = new Date(req.query.dateTo);
      }
    }

    const [buyers, total] = await Promise.all([
      Buyer.find(filters)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),

      Buyer.countDocuments(filters),
    ]);

    // 📊 stats (simple & clean)
    const activeTotal = await Buyer.countDocuments({
      relatedEntity: entity._id,
      isActive: true,
    });

    const activeProvinceTotal = await Buyer.distinct("province", {
      relatedEntity: entity._id,
      isActive: true,
    }).then(arr => arr.length);

    res.status(200).json({
      data: buyers,
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

export const updateBuyer = async (req, res, next) => {
  try {
    const { id } = req.params;

    const {
      buyerName,
      registrationType,
      province,
      ntn,
      cnic,
      strn,
      fullAddress,
    } = req.body;

    const updateData = {};

    if (buyerName !== undefined) updateData.buyerName = buyerName;
    if (registrationType !== undefined) updateData.registrationType = registrationType;
    if (province !== undefined) updateData.province = province;
    if (ntn !== undefined) updateData.ntn = ntn;
    if (cnic !== undefined) updateData.cnic = cnic;
    if (strn !== undefined) updateData.strn = strn;
    if (fullAddress !== undefined) updateData.fullAddress = fullAddress;

    const buyer = await Buyer.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    ).populate("relatedEntity", "businessName province");

    if (!buyer) {
      return res.status(404).json({ message: "Buyer not found" });
    }

    res.json({
      message: "Buyer updated successfully",
      buyer,
    });
  } catch (err) {
    next(err);
  }
};

export const toggleBuyerStatus = async (req, res, next) => {
  try {
    const { id } = req.params;

    const buyer = await Buyer.findById(id);
    if (!buyer) {
      return res.status(404).json({ message: "Buyer not found" });
    }

    buyer.isActive = !buyer.isActive;
    await buyer.save();

    const populatedBuyer = await buyer.populate(
      "relatedEntity",
      "businessName province"
    );

    res.status(200).json({
      message: `Buyer ${buyer.isActive ? "activated" : "deactivated"} successfully`,
      buyer: populatedBuyer,
    });
  } catch (err) {
    next(err);
  }
};
