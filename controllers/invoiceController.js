import xlsx from 'xlsx';
import Buyer from "../models/Buyer.js";
import Entity from "../models/Entity.js";
import Invoice from "../models/Invoice.js";
import { calculateItemBackend } from "../utils/invoiceCalculator.js";

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
    const entity = req.entity;

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
    const noLimit = req.query.noLimit === "true";

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 2);
    const skip = (page - 1) * limit;

    const { invoiceNumber, buyerName, documentType, dateFrom, dateTo } =
      req.query;

    /** -------------------------------
     *  Get Entity from logged-in user
     *  ------------------------------- */
    const entity = req.entity;

    /** -------------------------------
     *  Build Invoice Query
     *  ------------------------------- */
    const query = {
      relatedEntity: entity._id,
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
     *  Buyer Filter
     *  ------------------------------- */
    if (buyerName) {
      const buyers = await Buyer.find({
        buyerName: { $regex: buyerName, $options: "i" },
        relatedEntity: entity._id,
      }).select("_id");

      const buyerIds = buyers.map((b) => b._id);

      if (!buyerIds.length) {
        return res.status(200).json({
          invoices: [],
          meta: {
            page: 1,
            limit: noLimit ? null : limit,
            total: 0,
            totalPages: 0,
          },
          stats: { sentInvoices: 0 },
        });
      }

      query.buyer = { $in: buyerIds };
    }

    /** -------------------------------
     *  Build Query Executor
     *  ------------------------------- */
    let invoiceQuery = Invoice.find(query)
      .populate("buyer", "buyerName ntn cnic strn fullAddress province registrationType")
      .populate("relatedEntity")
      .sort({ createdAt: -1 });

    if (!noLimit) {
      invoiceQuery = invoiceQuery.skip(skip).limit(limit);
    }

    /** -------------------------------
     *  Fetch Data + Count
     *  ------------------------------- */
    const [invoices, total, sentInvoices] = await Promise.all([
      invoiceQuery,
      Invoice.countDocuments(query),
      Invoice.countDocuments({ isSent: true }),
    ]);

    res.status(200).json({
      invoices,
      meta: {
        page: noLimit ? 1 : page,
        limit: noLimit ? null : limit,
        total,
        totalPages: noLimit ? 1 : Math.ceil(total / limit),
      },
      stats: { sentInvoices },
    });
  } catch (err) {
    next(err);
  }
};

export const updateInvoice = async (req, res, next) => {
  try {
    const { id } = req.params;

    const {
      invoiceNumber,
      date,
      documentType,
      salesman,
      referenceNumber,
      buyer,
      items = [],
    } = req.body;

    // 🔐 Get entity from logged-in user
    const entity = req.entity;

    // 🔍 Validate buyer ownership
    const relatedBuyer = await Buyer.findOne({
      _id: buyer._id,
      relatedEntity: entity._id,
      isActive: true,
    });

    if (!relatedBuyer) {
      return res.status(404).json({ message: "Buyer not found" });
    }

    // 🧮 Recalculate items securely
    const calculatedItems = items.map(calculateItemBackend);

    // 🧮 Invoice total
    const totalValue = calculatedItems.reduce(
      (sum, item) => sum + item.totalItemValue,
      0
    );

    // 🧾 Create invoice
    const invoice = await Invoice.findByIdAndUpdate(
      id,
      {
        invoiceNumber,
        date: date ? new Date(date) : new Date(),
        referenceNumber,
        salesman,
        documentType,
        buyer: relatedBuyer._id,
        items: calculatedItems,
        totalValue,
        relatedEntity: entity._id,
      },
      { new: true }
    );

    res.status(201).json({
      message: "Invoice updated successfully",
      invoice,
    });
  } catch (err) {
    next(err);
  }
};

export const deleteInvoice = async (req, res, next) => {
  try {
    const entity = req.entity;

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

const excelDateToJSDate = (excelDate) => {
  if (excelDate instanceof Date) return excelDate;

  // convert numeric strings → number
  if (typeof excelDate === 'string' && !isNaN(excelDate)) {
    excelDate = Number(excelDate);
  }

  if (typeof excelDate === 'number') {
    return new Date((excelDate - 25569) * 86400 * 1000);
  }

  if (typeof excelDate === 'string') {
    return new Date(excelDate); // ISO / formatted dates
  }

  return null;
};

const parseRate = (rate) => {
  if (typeof rate === 'number' && rate >= 0 && rate <= 1) {
    return (rate * 100).toFixed(2) + '%';
  }
  return rate;
};

export const bulkUploadInvoices = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    /** 🔐 Get entity */
    const entity = req.entity;

    /** 📄 Read Excel */
    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(sheet, { defval: null });

    if (!rows.length) {
      return res.status(400).json({ message: 'Excel file is empty' });
    }

    /** 🧠 Group rows by Invoice Number */
    const grouped = {};
    for (const row of rows) {
      if (!grouped[row['Invoice Number *']]) {
        grouped[row['Invoice Number *']] = [];
      }
      grouped[row['Invoice Number *']].push(row);
    }
    
    const createdInvoices = [];

    /** 🔁 Process each invoice */
    for (const invoiceNumber of Object.keys(grouped)) {
      const invoiceRows = grouped[invoiceNumber];
      const firstRow = invoiceRows[0];

      /** 👤 Buyer: find or create */
      let buyer = await Buyer.findOne({
        buyerName: firstRow['Buyer Name *'],
        relatedEntity: entity._id,
        isActive: true,
      });

      if (!buyer) {
        buyer = await Buyer.create({
          buyerName: firstRow['Buyer Name *'],
          registrationType: firstRow['Buyer Registration Type *'],
          province: firstRow['Buyer Province *'].toUpperCase(),
          ntn: firstRow['Buyer NTN *'],
          cnic: firstRow['BUYER CNIC *'],
          strn: firstRow['Buyer STRN'],
          fullAddress: firstRow['Buyer Address *'],
          relatedEntity: entity._id,
        });
      }

      /** 🧾 Build items */
      const items = invoiceRows.map(row =>
        calculateItemBackend({
          hsCode: row['HS Code *'],
          description: row['Product Description *'],
          saleType: row['Sale Type *'],
          quantity: Number(row['Quantity *'] || 0),
          uom: row['UOM *'],
          rate: parseRate(row['Rate *']),
          unitPrice: Number(row['Unit Price *'] || 0),
          discount: Number(row['Discount (Sent to FBR)'] || 0),
          otherDiscount: Number(row['Other Discount (not sent)'] || 0),
          tradeDiscount: Number(row['Trade Discount (not sent)'] || 0),
          salesTaxWithheld: Number(row['Sales Tax WHT'] || 0),
          salesTax: Number(row['Sales Tax *'] || 0),
          extraTax: Number(row['Extra Tax'] || 0),
          furtherTax: Number(row['Further Tax'] || 0),
          federalExciseDuty: Number(row['FED Payable'] || 0),
          fixedValue: Number(row['Retail Price *'] || 0),
          sroScheduleNo: row['SRO NO./Schedule No'] || row[' SRO NO./Schedule No '],
          sroItemSerialNo: row['SRO Item'],
          t236g: Number(row['236G'] || 0),
          t236h: Number(row['236H'] || 0),
        })
      );

      /** 🧮 Invoice total */
      const totalValue = items.reduce(
        (sum, item) => sum + item.totalItemValue,
        0
      );
      
      /** 🧾 Create invoice */
      const invoice = await Invoice.create({
        invoiceNumber,
        date: firstRow['Invoice Date *'] ? excelDateToJSDate(firstRow['Invoice Date *']) : new Date(),
        documentType: firstRow['Invoice Type *'] || 'Sale Invoice',
        referenceNumber: firstRow['Invoice Ref No'],
        salesman: firstRow['Salesman'],
        buyer: buyer._id,
        items,
        totalValue,
        relatedEntity: entity._id,
      });

      createdInvoices.push(invoice._id);
    }

    return res.status(201).json({
      message: 'Bulk invoices uploaded successfully',
      totalInvoices: createdInvoices.length,
    });
  } catch (err) {
    next(err);
  }
};

export const getBuyers = async (req, res, next) => {
  try {
    // 🔐 get entity from logged-in user
    const entity = req.entity;

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