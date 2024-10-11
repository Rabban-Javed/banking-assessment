// Import required modules
const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('./config/db'); // Your MySQL connection file
const app = express();
const bodyParser = require('body-parser');
const { authenticateToken } = require('./middleware/authMiddleware');
require('dotenv').config();

// Middleware to parse JSON
app.use(express.json());
app.use(bodyParser.json());

const jwtSecret = process.env.JWT_SECRET;

// User Registration Route
app.post('/register', async (req, res) => {
    const { email, password } = req.body;

    // Check if the user already exists
    const existingUser = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    if (existingUser.length > 0) {
        return res.status(400).json({ message: 'User already exists' });
    }

    const saltRounds = 10;

// Hash the password with the specified salt rounds
const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Insert the new user into the database
    await db.query('INSERT INTO users (email, password) VALUES (?, ?)', [email, hashedPassword]);

    return res.status(201).json({ message: 'User registered successfully' });
});

//User registration
app.post('/register', async (req, res) => {
    const { email, password } = req.body;

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // Set initial balance (e.g., 1000)
        const initialBalance = 1000;

        const user = { email, password: hashedPassword, balance: initialBalance };
        const result = await db.query('INSERT INTO users SET ?', user);

        res.status(201).json({ message: 'User registered', userId: result.insertId });
    } catch (error) {
        res.status(500).json({ error: 'Error registering user' });
    }
});


// User Login
app.post('/login', (req, res) => {
    const { email, password } = req.body;

    db.query('SELECT * FROM users WHERE email = ?', [email], (err, results) => {
        if (err) return res.status(500).send('Server error');
        if (results.length === 0) return res.status(401).send('User not found');

        const user = results[0];

        // Compare password
        bcrypt.compare(password, user.password, (err, isMatch) => {
            if (err) return res.status(500).send('Server error');
            if (!isMatch) return res.status(401).send('Invalid credentials');

            // Generate JWT
            const token = jwt.sign({ id: user.id }, jwtSecret, { expiresIn: '1h' });
            res.json({ token });
        });
    });
});


// const authenticateToken = (req, res, next) => {
//     const token = req.header('Authorization').split(' ')[1]; // Bearer <token>
//     if (!token) return res.status(401).json({ message: 'No token, authorization denied' });
//     console.log('Token received:', token);
  
  
//     try {
//       const decoded = jwt.verify(token, process.env.JWT_SECRET);
//       req.user = decoded;
//       next();
//     } catch (err) {
//       res.status(403).json({ message: 'Token is not valid' });
//     }
//   };
// Get User Balance
app.get('/balance', authenticateToken, (req, res) => {
    const authHeader = req.headers['authorization']; // Get the auth header
    const token = authHeader && authHeader.split(' ')[1]; // Extract the token

    if (!token) return res.status(403).send('No token provided');

    jwt.verify(token, jwtSecret, (err, decoded) => {
        if (err) {
            console.error('JWT verification error:', err); // Log the error for debugging
            return res.status(500).send('Failed to authenticate token');
        }

        // Use the user id from the decoded token to get the balance
        db.query('SELECT balance FROM users WHERE id = ?', [decoded.id], (err, results) => {
            if (err) return res.status(500).send('Server error');
            if (results.length === 0) return res.status(404).send('User not found');

            res.json({ balance: 1000 });
        });
    });
});


// Withdraw Money
app.post('/withdraw', authenticateToken, (req, res) => {
    const { amount } = req.body;  // Extract amount from request body
    const userId = req.user.id;   // Extract the user ID from the authenticated user (JWT token)
  
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid withdrawal amount' });
    }
  
    // Retrieve the current user's balance
    db.query('SELECT balance, transaction_history FROM users WHERE id = ?', [userId], (err, result) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Error fetching user data' });
      }
  
      if (result.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }
  
      const user = result[0];
      const currentBalance = user.balance;
  
      if (currentBalance < amount) {
        return res.status(400).json({ error: 'Insufficient balance' });
      }
  
      // Deduct the amount from the user's balance
      const newBalance = currentBalance - amount;
      const transaction = { type: 'withdraw', amount: amount, date: new Date().toISOString() };
  
      // Update the user's balance and transaction history
      let transactionHistory = JSON.parse(user.transaction_history || '[]');
      transactionHistory.push(transaction);
  
      db.query('UPDATE users SET balance = ?, transaction_history = ? WHERE id = ?', 
        [newBalance, JSON.stringify(transactionHistory), userId], (updateErr) => {
          if (updateErr) {
            console.error(updateErr);
            return res.status(500).json({ error: 'Error updating balance' });
          }
  
          return res.status(200).json({ message: `Withdrawal of ${amount} successful. New balance: ${newBalance}` });
        }
      );
    });
  });
  

// Money Transfer
app.post('/transfer', authenticateToken, async (req, res) => {
    const token = req.headers['authorization'];
    const { recipientEmail, amount } = req.body; // Change recipientId to recipientEmail
  
    if (!token) return res.status(403).send('No token provided');
  
    jwt.verify(token, jwtSecret, async (err, decoded) => {
      if (err) return res.status(500).send('Failed to authenticate token');
  
      try {
        // Start transaction
        await db.query('START TRANSACTION');
  
        // Check the sender's balance
        const [senderResults] = await db.query('SELECT balance FROM users WHERE id = ?', [decoded.id]);
        if (senderResults.length === 0) return res.status(404).send('User not found');
  
        const balance = senderResults[0].balance;
  
        if (balance < amount) {
          await db.query('ROLLBACK');
          return res.status(400).send('Insufficient funds');
        }
  
        // Fetch recipient's ID based on their email
        const [recipientResults] = await db.query('SELECT id FROM users WHERE email = ?', [recipientEmail]);
        if (recipientResults.length === 0) {
          await db.query('ROLLBACK');
          return res.status(404).send('Recipient not found');
        }
  
        const recipientId = recipientResults[0].id;
  
        // Update the sender's balance
        await db.query('UPDATE users SET balance = balance - ? WHERE id = ?', [amount, decoded.id]);
  
        // Update the recipient's balance
        await db.query('UPDATE users SET balance = balance + ? WHERE id = ?', [amount, recipientId]);
  
        // Log the transaction
        await db.query('INSERT INTO transactions (sender_id, recipient_id, amount, type) VALUES (?, ?, ?, "transfer")', [decoded.id, recipientId, amount]);
  
        // Commit transaction
        await db.query('COMMIT');
  
        res.send('Transfer successful');
      } catch (error) {
        // Rollback transaction in case of error
        await db.query('ROLLBACK');
        console.error('Transfer error:', error);
        res.status(500).send('Server error');
      }
    });
  });
  


// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
