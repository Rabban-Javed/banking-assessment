const express = require('express');
const { getBalance, withdraw, transfer } = require('../controllers/transactionController');
const { authenticateToken } = require('../middleware/authMiddleware');
const router = express.Router();

router.get('/balance',  authenticateToken, getBalance);
router.post('/withdraw', authenticateToken, withdraw);
router.post('/transfer',  authenticateToken, transfer);

module.exports = router;
