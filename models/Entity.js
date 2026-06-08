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
    fbrApiKeys: [
      {
        environment: {
          type: String,
          enum: ["sandbox", "production"],
          required: true,
        },
        apiKey: { type: String, required: true },
        expiryDate: { type: Date, required: true },
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now },
      },
    ],

    // Link to automatically created user
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

entitySchema.index(
  { _id: 1, "fbrApiKeys.environment": 1 },
  { unique: true, sparse: true }
);

const Entity = mongoose.model("Entity", entitySchema);
export default Entity;
