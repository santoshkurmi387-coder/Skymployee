/**
 * routes/auth.js
 * Authentication endpoints:
 *   POST /api/auth/send-otp    — register or login, send OTP
 *   POST /api/auth/verify-otp  — verify OTP, return JWT
 *   GET  /api/auth/me          — get current user info (protected)
 */

const router    = require('express').Router();
const jwt       = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User      = require('../models/User');
const authMW    = require('../middleware/auth');
const { generateOTP, sendOTP } = require('../utils/sms');

// Helper: sign a JWT for a user
const signToken = (userId) =>
  jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRE || '7d' });

// ── POST /api/auth/send-otp ──────────────────────────────────────
// Accepts: { mobile, name, branchName }
// If user exists → re-send OTP (login flow)
// If new user    → create account and send OTP (signup flow)
router.post('/send-otp', [
  body('mobile').matches(/^[6-9]\d{9}$/).withMessage('Enter a valid 10-digit mobile number'),
  body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
], async (req, res) => {
  // Validate inputs
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const { mobile, name, branchName } = req.body;

  try {
    let user = await User.findOne({ mobile });

    if (!user) {
      // New user — require name for signup
      if (!name) {
        return res.status(400).json({ success: false, message: 'Name is required for first-time registration.' });
      }
      user = new User({ mobile, name: name.trim(), branchName: branchName || 'Main Branch', role: 'Admin' });
    }

    // Generate OTP
    const otp = generateOTP();

    // Store hashed OTP with 10-minute expiry
    user.otp = {
      code:      otp,          // will be hashed by pre-save hook
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      attempts:  0,
    };

    await user.save();

    // Send SMS (or print to console in dev mode)
    await sendOTP(mobile, otp);

    res.json({
      success: true,
      message: `OTP sent to +91${mobile}`,
      isNewUser: !user.isVerified,
      // In dev mode only, return OTP in response for easy testing
      ...(process.env.NODE_ENV === 'development' && { devOTP: otp }),
    });
  } catch (err) {
    console.error('send-otp error:', err);
    res.status(500).json({ success: false, message: 'Failed to send OTP. Please try again.' });
  }
});

// ── POST /api/auth/verify-otp ────────────────────────────────────
// Accepts: { mobile, otp }
// Returns: { token, user }
router.post('/verify-otp', [
  body('mobile').matches(/^[6-9]\d{9}$/).withMessage('Invalid mobile number'),
  body('otp').isLength({ min: 6, max: 6 }).withMessage('OTP must be 6 digits'),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  const { mobile, otp } = req.body;

  try {
    const user = await User.findOne({ mobile });
    if (!user) {
      return res.status(404).json({ success: false, message: 'No account found for this number.' });
    }

    // Increment attempt counter before verifying
    user.otp.attempts = (user.otp.attempts || 0) + 1;

    const valid = await user.verifyOTP(otp);
    if (!valid) {
      await user.save();
      return res.status(400).json({
        success: false,
        message: new Date() > user.otp.expiresAt
          ? 'OTP expired. Please request a new one.'
          : `Invalid OTP. ${5 - user.otp.attempts} attempts remaining.`,
      });
    }

    // OTP valid — mark user as verified and clear OTP
    user.isVerified = true;
    user.clearOTP();
    await user.save();

    const token = signToken(user._id);

    res.json({
      success: true,
      message: 'Logged in successfully!',
      token,
      user: {
        id:         user._id,
        name:       user.name,
        mobile:     user.mobile,
        role:       user.role,
        branchName: user.branchName,
      },
    });
  } catch (err) {
    console.error('verify-otp error:', err);
    res.status(500).json({ success: false, message: 'Verification failed. Please try again.' });
  }
});

// ── GET /api/auth/me ─────────────────────────────────────────────
// Returns the currently logged-in user's profile
router.get('/me', authMW, async (req, res) => {
  res.json({ success: true, user: req.user });
});

// ── PATCH /api/auth/profile ──────────────────────────────────────
// Update branch name or display name
router.patch('/profile', authMW, [
  body('name').optional().trim().notEmpty(),
  body('branchName').optional().trim().notEmpty(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

  const { name, branchName } = req.body;
  if (name) req.user.name = name;
  if (branchName) req.user.branchName = branchName;
  await req.user.save();
  res.json({ success: true, user: req.user });
});

module.exports = router;
