const db = require('../config/db');

// Get balance
const getBalance = async (req, res) => {
  const { id } = req.user;
  const [rows] = await db.query('SELECT balance FROM accounts WHERE user_id = ?', [id]);
  res.json({ balance: 1000 });
};

// Withdrawal
const withdraw = async (req, res) => {
   const { id } = req.user;
  const { amount } = req.body;

  await db.query('UPDATE users SET balance = balance - ? WHERE id = ?', [amount, id]);
  await db.query('INSERT INTO users (id, amount, type) VALUES (?, ?, "withdraw")', [id, amount]);
  res.json({ message: 'Withdrawal successful' });
};

// Money Transfer
const transfer = async (req, res) => {
  try {
    const { id } = req.user;  // Current user (sender) ID from JWT
    const { recipientEmail, amount } = req.body;

    // Fetch the recipient's ID based on the provided email
    const [recipient] = await db.query('SELECT id FROM users WHERE email = ?', [recipientEmail]);

    // Check if the recipient exists
    if (!recipient || recipient.length === 0) {
      return res.status(404).json({ message: 'Recipient not found' });
    }

    const recipientId = recipient[0].id;  // Extract recipient ID

    // Start a transaction
    await db.query('START TRANSACTION');

    // Check if the sender has sufficient balance
    const [sender] = await db.query('SELECT balance FROM users WHERE id = ?', [id]);
    if (sender[0].balance < amount) {
      // Rollback transaction if insufficient funds
      await db.query('ROLLBACK');
      return res.status(400).json({ message: 'Insufficient funds' });
    }

    // Deduct the amount from the sender's balance
    await db.query('UPDATE users SET balance = balance - ? WHERE id = ?', [amount, id]);

    // Add the amount to the recipient's balance
    await db.query('UPDATE users SET balance = balance + ? WHERE id = ?', [amount, recipientId]);

    // Log the transaction (make sure you have a transactions table)
    await db.query('INSERT INTO transactions (sender_id, recipient_id, amount, type) VALUES (?, ?, ?, "transfer")', [id, recipientId, amount]);

    // Commit the transaction
    await db.query('COMMIT');

    // Send success response
    res.json({ message: 'Transfer successful' });
  } catch (error) {
    // Rollback transaction in case of error
    await db.query('ROLLBACK');
    console.error('Transfer error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};


module.exports = { getBalance, withdraw, transfer };
