import mongoose from "mongoose";

export const connectDB = async () => {
  try {
    // Prevent multiple connections in serverless
    if (mongoose.connection.readyState >= 1) {
      return;
    }

    await mongoose.connect(process.env.MONGODB_URI, {
      bufferCommands: false,
    });

    console.log("✅ MongoDB Connected");
  } catch (err) {
    console.error("❌ MongoDB Error:", err.message);
    throw err;   // ❗ DO NOT use process.exit in Vercel
  }
};
