import dotenv from "dotenv";
import mongoose from "mongoose";
import connectDB from "../config/db.js";
import User from "../models/User.js";

dotenv.config();

const seedDeveloperUser = async () => {
  await connectDB();

  const username = "dev";
  const password = "123456";

  let user = await User.findOne({ username });

  if (user) {
    user.name = "Developer";
    user.role = "dev";
    user.password = password;
    await user.save();
    console.log("Developer user updated");
  } else {
    await User.create({
      name: "Developer",
      username,
      password,
      role: "dev",
    });
    console.log("Developer user created");
  }

  console.log(`username: ${username}`);
  console.log(`password: ${password}`);
};

seedDeveloperUser()
  .catch((error) => {
    console.error("Failed to seed developer user:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
