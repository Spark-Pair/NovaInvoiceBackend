import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import userRoutes from './routes/userRoutes.js';
import entityRoutes from './routes/entityRoutes.js';
import buyerRoutes from './routes/buyerRoutes.js';
import invoiceRoutes from './routes/invoiceRoutes.js';

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/users', userRoutes);
app.use('/api/entities', entityRoutes);
app.use('/api/buyers', buyerRoutes);
app.use('/api/invoices', invoiceRoutes);

// Error handling middleware (optional)
app.use((err, req, res, next) => {
    const status = err.status || 500;
    res.status(status).json({ message: err.message || 'Something went wrong' });
});

export default app;
