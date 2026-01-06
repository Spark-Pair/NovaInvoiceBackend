import Buyer from "../models/Buyer.js";
import Entity from "../models/Entity.js";
import Invoice from "../models/Invoice.js";
import { calculateItemBackend } from "../utils/invoiceCalculator.js";

// export const createInvoice = async (req, res, next) => {
//   try {
//     const {
//       invoiceNumber,
//       date,
//       documentType,
//       salesman,
//       referenceNumber,
//       buyerId,
//       items,
//     } = req.body;

//     // 🔐 Get entity from logged-in user
//     const entity = await Entity.findOne({ user: req.user._id });
//     if (!entity) {
//       return res.status(403).json({
//         message: "Entity not found for this user",
//       });
//     }

//     // 🔍 Validate buyer & ownership
//     const buyer = await Buyer.findOne({
//       _id: buyerId,
//       relatedEntity: entity._id,
//       isActive: true,
//     });

//     if (!buyer) {
//       return res.status(404).json({
//         message: "Buyer not found",
//       });
//     }

//     // 🧾 Create invoice
//     const invoice = await Invoice.create({
//       invoiceNumber,
//       date: date ? new Date(date) : new Date(),
//       referenceNumber,
//       salesman,
//       documentType,
//       buyer: buyer._id,
//       items,
//       relatedEntity: entity._id, // ✅ auto-linked
//     });

//     res.status(201).json({
//       message: "Invoice created successfully",
//       invoice,
//     });
//   } catch (err) {
//     next(err);
//   }
// };

export const createInvoice = async (req, res, next) => {
  try {
    const {
      invoiceNumber,
      date,
      documentType,
      salesman,
      referenceNumber,
      buyerId,
      items = [],
    } = req.body;

    // 🔐 Get entity from logged-in user
    const entity = await Entity.findOne({ user: req.user._id });
    if (!entity) {
      return res
        .status(403)
        .json({ message: "Entity not found for this user" });
    }

    // 🔍 Validate buyer ownership
    const buyer = await Buyer.findOne({
      _id: buyerId,
      relatedEntity: entity._id,
      isActive: true,
    });

    if (!buyer) {
      return res.status(404).json({ message: "Buyer not found" });
    }

    // 🧮 Recalculate items securely
    const calculatedItems = items.map(calculateItemBackend);

    // 🧮 Invoice total
    const totalValue = calculatedItems.reduce(
      (sum, item) => sum + item.totalItemValue,
      0
    );

    console.log({ calculatedItems, totalValue });

    // 🧾 Create invoice
    const invoice = await Invoice.create({
      invoiceNumber,
      date: date ? new Date(date) : new Date(),
      referenceNumber,
      salesman,
      documentType,
      buyer: buyer._id,
      items: calculatedItems,
      totalValue,
      relatedEntity: entity._id,
    });

    res.status(201).json({
      message: "Invoice created successfully",
      invoice,
    });
  } catch (err) {
    next(err);
  }
};

export const getInvoices = async (req, res, next) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 50);
    const skip = (page - 1) * limit;

    const { invoiceNumber, buyerName, documentType, dateFrom, dateTo } =
      req.query;

    /** -------------------------------
     *  Get Entity from logged-in user
     *  ------------------------------- */
    const entity = await Entity.findOne({ user: req.user._id });
    if (!entity) {
      return res.status(404).json({
        message: "Entity not found",
      });
    }

    /** -------------------------------
     *  Build Invoice Query
     *  ------------------------------- */
    const query = {
      relatedEntity: entity._id, // 🔐 tenant isolation
    };

    if (invoiceNumber) {
      query.invoiceNumber = { $regex: invoiceNumber, $options: "i" };
    }

    if (documentType && documentType !== "Select...") {
      query.documentType = documentType;
    }

    if (dateFrom || dateTo) {
      query.date = {};
      if (dateFrom) query.date.$gte = new Date(dateFrom);
      if (dateTo) query.date.$lte = new Date(dateTo);
    }

    /** -------------------------------
     *  Buyer Name Filter (via Buyer)
     *  ------------------------------- */
    if (buyerName) {
      const buyers = await Buyer.find({
        buyerName: { $regex: buyerName, $options: "i" },
        relatedEntity: entity._id,
      }).select("_id");

      const buyerIds = buyers.map((b) => b._id);

      // If no buyers match → return empty result fast
      if (buyerIds.length === 0) {
        return res.status(200).json({
          data: [],
          meta: {
            page,
            limit,
            total: 0,
            totalPages: 0,
          },
        });
      }

      query.buyer = { $in: buyerIds };
    }

    /** -------------------------------
     *  Fetch Data + Count
     *  ------------------------------- */
    const [
      invoices,
      total,
      sentInvoices
    ] = await Promise.all([
      Invoice.find(query)
        .populate("buyer", "buyerName ntn cnic strn")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),

      Invoice.countDocuments(query),

      Invoice.countDocuments({ isSent: true })
    ]);

    res.status(200).json({
      invoices,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      stats: {
        sentInvoices
      },
    });
  } catch (err) {
    next(err);
  }
};

export const deleteInvoice = async (req, res, next) => {
  try {
    const entity = await Entity.findOne({ user: req.user._id });
    if (!entity) {
      return res.status(404).json({ message: "Entity not found" });
    }

    const invoice = await Invoice.findOne({
      _id: req.params.id,
      relatedEntity: entity._id,
      isSent: false,
    });

    if (!invoice) {
      return res.status(403).json({
        message: "Invoice not found or already sent to FBR",
      });
    }

    await invoice.deleteOne();

    res.status(200).json({
      message: "Invoice deleted successfully",
    });
  } catch (err) {
    next(err);
  }
};

export const getBuyers = async (req, res, next) => {
  try {
    // 🔐 get entity from logged-in user
    const entity = await Entity.findOne({ user: req.user._id });
    if (!entity) {
      return res.status(404).json({ message: "Entity not found" });
    }

    // const buyers = await Buyer.find({ relatedEntity: entity._id }).select('_id buyerName');
    const buyers = await Buyer.find({
      relatedEntity: entity._id,
      isActive: true,
    }).select("_id buyerName");

    res.status(200).json({
      buyers,
    });
  } catch (err) {
    next(err);
  }
};

export const getBuyerDetails = async (req, res, next) => {
  try {
    const buyer = await Buyer.findById(req.params.id);
    if (!buyer) return res.status(404).json({ message: "Buyer not found" });

    res.status(200).json({
      buyer,
    });
  } catch (err) {
    next(err);
  }
};

// export const getBuyerDetails = async (req, res, next) => {
//   try {
//     // 🔐 get entity from logged-in user
//     const entity = await Entity.findOne({ user: req.user._id });
//     if (!entity) {
//       return res.status(404).json({ message: "Entity not found" });
//     }

//     const buyer = await Buyer.find({ _id: req.params.id, relatedEntity: entity._id });
//     if (!buyer) return res.status(404).json({ message: "Buyer not found" });

//     res.status(200).json({
//       buyer
//     });
//   } catch (err) {
//     next(err);
//   }
// };
