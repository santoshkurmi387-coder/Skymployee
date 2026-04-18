/**
 * server.js — CourierOps Backend Entry Point
 * ============================================
 * Express + MongoDB REST API
 * Handles: Auth (OTP), Employees, Attendance, Salary
 */

require('dotenv').config();          // Load .env variables
const express    = require('express');
const mongoose   = require('mongoose');
const cors       = require('cors');
const rateLimit  = require('express-rate-limit');

const app = express();

// ── Middleware ───────────────────────────────────────────────────
app.use(express.json());             // Parse JSON request bodies

// CORS: allow requests only from your frontend URL
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true,
}));

// Rate limiting: prevent brute-force attacks on API
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 100,                   // max 100 requests per window per IP
  message: { success: false, message: 'Too many requests, please try again later.' },
});
app.use('/api/', limiter);

// Stricter limit for OTP endpoints specifically
const otpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,  // 10 minutes
  max: 5,
  message: { success: false, message: 'Too many OTP requests. Please wait 10 minutes.' },
});

// ── Routes ───────────────────────────────────────────────────────
app.use('/api/auth',       require('./routes/auth'));
app.use('/api/employees',  require('./routes/employees'));
app.use('/api/attendance', require('./routes/attendance'));
app.use('/api/salary',     require('./routes/salary'));

// Health check endpoint — useful for deployment monitoring
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'CourierOps API is running!', timestamp: new Date() });
});

// 404 handler for unknown routes
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found.' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.stack);
  res.status(500).json({ success: false, message: 'Internal server error.', error: err.message });
});

// ── Connect to MongoDB and start server ──────────────────────────
const PORT = process.env.PORT || 5000;

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log('✅ MongoDB connected');
    app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
  })
  .catch(err => {
    console.error('❌ MongoDB connection failed:', err.message);
    process.exit(1);
  });
