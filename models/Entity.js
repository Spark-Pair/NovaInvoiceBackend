import mongoose from "mongoose";

const entitySchema = new mongoose.Schema(
  {
    image: { type: String }, // can store URL or base64 string
    businessName: { type: String, required: true },
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

    // Link to automatically created user
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

const Entity = mongoose.model("Entity", entitySchema);
export default Entity;
