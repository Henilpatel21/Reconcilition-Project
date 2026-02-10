const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");

dotenv.config();

const app = express();
const CLIENT_URL = process.env.CLIENT_URL;

app.use(
  cors({
    origin: CLIENT_URL,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

//  REQUIRED for preflight requests
app.options("*", cors());

// REQUIRED for POST body
app.use(express.json());

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date() });
});

// Routes
app.use("/api/auth", require("./routes/auth"));
app.use("/api/transactions", require("./routes/transactions"));
app.use("/api/settlements", require("./routes/settlements"));
app.use("/api/bank-statements", require("./routes/bankStatements"));
app.use("/api/reconcile", require("./routes/reconcile"));
app.use("/api/audit", require("./routes/audit"));

// DB + Server
const MONGO_URI =
  process.env.MONGO_URI || "mongodb://localhost:27017/reconciliation_db";
const PORT = process.env.PORT || 5000;

async function start() {
  try {
    await mongoose.connect(MONGO_URI);
    console.log("MongoDB connected");

    app.listen(PORT, () => {
      console.log(`Server ready on port ${PORT}`);
    });
  } catch (err) {
    console.error("Failed to start server", err);
    process.exit(1);
  }
}

if (require.main === module) {
  start();
}

module.exports = app;
