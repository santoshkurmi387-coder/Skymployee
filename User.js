/**
 * models/User.js
 * User account model for admins and managers.
 * Stores mobile number, hashed password, role, and OTP data.
 */

const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters'],
  },
  mobile: {
    type: String,
    required: [true, 'Mobile number is required'],
    unique: true,
    match: [/^[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number'],
  },
  role: {
    type: String,
    enum: ['Admin', 'Manager'],
    default: 'Manager',
  },
  isVerified: {
    type: Boolean,
    default: false,  // becomes true after OTP verification
  },
  // OTP fields (temporary, cleared after use)
  otp: {
    code:      { type: String },
    expiresAt: { type: Date },
    attempts:  { type: Number, default: 0 },
  },
  branchName: {
    type: String,
    default: 'Main Branch',
    trim: true,
  },
}, { timestamps: true });

// Before saving, hash the OTP code if it was modified
UserSchema.pre('save', async function (next) {
  if (this.isModified('otp.code') && this.otp.code) {
    this.otp.code = await bcrypt.hash(this.otp.code, 10);
  }
  next();
});

// Instance method: check if a given OTP matches the stored hash
UserSchema.methods.verifyOTP = async function (inputCode) {
  if (!this.otp.code || !this.otp.expiresAt) return false;
  if (new Date() > this.otp.expiresAt) return false;      // expired
  if (this.otp.attempts >= 5) return false;               // too many attempts
  return bcrypt.compare(inputCode, this.otp.code);
};

// Clear OTP fields after successful verification
UserSchema.methods.clearOTP = function () {
  this.otp = { code: undefined, expiresAt: undefined, attempts: 0 };
};

module.exports = mongoose.model('User', UserSchema);
