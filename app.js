import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import userRoutes from './routes/userRoutes.js';
import entityRoutes from './routes/entityRoutes.js';
import buyerRoutes from './routes/buyerRoutes.js';
import invoiceRoutes from './routes/invoiceRoutes.js';
import connectDB from './config/db.js';
import { errorHandler } from './middlewares/errorMiddleware.js';

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    console.error("Database connection failed on request:", err.message);
    res.status(500).json({ message: "Database connection failed" });
  }
});

// Routes
app.use('/api/users', userRoutes);
app.use('/api/entities', entityRoutes);
app.use('/api/buyers', buyerRoutes);
app.use('/api/invoices', invoiceRoutes);

// Error handling middleware (single, centralized)
app.use(errorHandler);

export default app;
