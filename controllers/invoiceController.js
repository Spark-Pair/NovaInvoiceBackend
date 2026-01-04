import Buyer from "../models/Buyer.js";

export const createInvoice = async (req, res, next) => {
  try {
    console.log(req.body);

    res.status(200).json({
      message: "recieved"
    });
  } catch (err) {
    next(err);
  }
};

export const getBuyers = async (req, res, next) => {
  try {
    const buyers = await Buyer.find().select('_id buyerName');

    res.status(200).json({
      buyers
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
      buyer
    });
  } catch (err) {
    next(err);
  }
};