import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

let isConnected = false;

const buildAtlasFallbackUri = () => {
  const mongoUri = process.env.MONGO_URI;
  const atlasHosts = process.env.MONGO_ATLAS_HOSTS;
  const replicaSet = process.env.MONGO_ATLAS_REPLICA_SET;

  if (!mongoUri || !atlasHosts || !replicaSet) return null;

  const parsed = new URL(mongoUri);
  const username = decodeURIComponent(parsed.username);
  const password = decodeURIComponent(parsed.password);
  const database = parsed.pathname || "";
  const hosts = atlasHosts
    .split(",")
    .map((host) => host.trim())
    .filter(Boolean)
    .map((host) => (host.includes(":") ? host : `${host}:27017`))
    .join(",");

  if (!username || !password || !hosts) return null;

  const params = new URLSearchParams(parsed.search);
  params.set("ssl", "true");
  params.set("replicaSet", replicaSet);
  params.set("authSource", params.get("authSource") || "admin");
  params.set("retryWrites", params.get("retryWrites") || "true");
  params.set("w", params.get("w") || "majority");

  return `mongodb://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${hosts}${database}?${params.toString()}`;
};

const connectDB = async () => {
  // Skip reconnection if already connected (for EC2 or warm invocations)
  if (isConnected && mongoose.connection.readyState === 1) return;

  try {
    await mongoose.connect(process.env.MONGO_URI);

    isConnected = true;
    console.log("MongoDB connected");
  } catch (error) {
    const fallbackUri = buildAtlasFallbackUri();

    if (!fallbackUri) {
      console.error("MongoDB connection error:", error.message);
      throw error;
    }

    console.warn("MongoDB SRV lookup failed; retrying with direct Atlas hosts");

    try {
      await mongoose.connect(fallbackUri);

      isConnected = true;
      console.log("MongoDB connected");
    } catch (fallbackError) {
      console.error("MongoDB connection error:", fallbackError.message);
      throw fallbackError;
    }
  }
};

export default connectDB;
