import app from './app.js';
import dotenv from 'dotenv';
import connectDB from './config/db.js';

dotenv.config();

const PORT = process.env.PORT || 5000;

// Connect DB (if not serverless)
if (process.env.VERCEL !== "true") {
  connectDB();
}

// Listen on HTTP server
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

// mongoose.connect(MONGO_URI)  // ✅ removed options
//     .then(() => {
//         console.log('MongoDB connected');
//         app.listen(PORT, () => {
//             console.log(`Server running on port ${PORT}`);
//         });
//     })
//     .catch((err) => {
//         console.error('MongoDB connection error:', err);
//     });
