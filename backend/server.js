const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');

const app = express();

// Load env variables from .env
dotenv.config();

const CLIENT_URL = process.env.CLIENT_URL;

if (!CLIENT_URL) {
  // Development or open access
  app.use(cors());
} else {
  // Production
  app.use(
    cors({
      origin: CLIENT_URL,
      credentials: true,
    })
  );
}

// Basic health route
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// Route placeholders - actual route files to be implemented in later steps
app.use('/api/auth', require('./routes/auth'));
app.use('/api/transactions', require('./routes/transactions'));
app.use('/api/settlements', require('./routes/settlements'));
app.use('/api/bank-statements', require('./routes/bankStatements'));
app.use('/api/reconcile', require('./routes/reconcile'));
app.use('/api/audit', require('./routes/audit'));

// Connect to MongoDB
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/reconciliation_db';
const PORT = process.env.PORT || 5000;

async function start() {
  try {
    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB connected');

    // Bind to localhost
    // app.listen(PORT, '127.0.0.1', () => {
    //   console.log(`Server ready on port ${PORT}`);
    // });

    app.listen(PORT, () => {
    console.log(`Server ready on port ${PORT}`);
    });

  } catch (err) {
    console.error('Failed to start server', err);
    process.exit(1);
  }
}

// Start only if this script is run directly
if (require.main === module) {
  start();
}

module.exports = app;
