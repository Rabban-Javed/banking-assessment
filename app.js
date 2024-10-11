const express = require('express');
const app = express();
const authRoutes = require('./routes/authRoutes');
const transactionRoutes = require('./routes/transactionRoutes');
// const { authenticateToken } = require('./middlewares/authMiddlewares');

app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/transactions', transactionRoutes);

module.exports = app;
