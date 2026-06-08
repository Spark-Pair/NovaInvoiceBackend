import dotenv from "dotenv";
import mongoose from "mongoose";
import connectDB from "../config/db.js";
import User from "../models/User.js";

dotenv.config();

const seedAdminUser = async () => {
  await connectDB();

  const username = "admin";
  const password = "123456";

  let user = await User.findOne({ username });

  if (user) {
    user.name = user.name || "Admin";
    user.role = "admin";
    user.password = password;
    await user.save();

    console.log("Admin user updated");
  } else {
    user = await User.create({
      name: "Admin",
      username,
      password,
      role: "admin",
    });

    console.log("Admin user created");
  }

  console.log(`username: ${username}`);
  console.log(`password: ${password}`);
};

seedAdminUser()
  .catch((error) => {
    console.error("Failed to seed admin user:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
