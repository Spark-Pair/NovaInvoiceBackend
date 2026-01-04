import mongoose from "mongoose";

const buyerSchema = new mongoose.Schema(
  {
    buyerName: { type: String },
    registrationType: {
      type: String,
      enum: [
        "Registered",
        "Unregistered",
        "Unregistered Distributor",
        "Retail Customer",
      ],
      required: true,
    },
    province: {
      type: String,
      enum: [
        "BALOCHISTAN",
        "AZAD JAMMU AND KASHMIR",
        "CAPITAL TERRITORY",
        "KHYBER PAKHTUNKHWA",
        "PUNJAB",
        "SINDH",
        "GILGIT BALTISTAN",
      ],
      required: true,
    },
    ntn: { type: String },
    cnic: { type: String },
    strn: { type: String },
    fullAddress: { type: String, required: true },
    isActive: { type: Boolean, default: true },

    /** 🔗 Relation to Entity */
    relatedEntity: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Entity",
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

const Buyer = mongoose.model("Buyer", buyerSchema);
export default Buyer;
