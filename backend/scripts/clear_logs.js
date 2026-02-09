// Clear audit logs script
// Usage: node scripts/clear_logs.js

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const AuditLog = require('../models/AuditLog');

dotenv.config();

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/reconciliation_db';

async function clear() {
  try {
    await mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('Connected to MongoDB');
    const res = await AuditLog.deleteMany({});
    console.log('Deleted audit logs:', res.deletedCount);
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Failed to clear logs', err);
    process.exit(1);
  }
}

clear();
