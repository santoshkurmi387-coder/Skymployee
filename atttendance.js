/**
 * models/Attendance.js
 * Stores one record per employee per date.
 */

const mongoose = require('mongoose');

const AttendanceSchema = new mongoose.Schema({
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  // Store date as a plain string (YYYY-MM-DD) for easy filtering
  date: {
    type: String,
    required: [true, 'Date is required'],
    match: [/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'],
  },
  status: {
    type: String,
    required: true,
    enum: ['Present', 'Absent', 'Half-Day', 'Leave'],
  },
  checkIn:  { type: String, default: '' },   // HH:MM
  checkOut: { type: String, default: '' },   // HH:MM
  // Total hours worked — computed from checkIn/checkOut
  hoursWorked: { type: Number, default: 0 },
  notes: { type: String, default: '', maxlength: 300 },
}, { timestamps: true });

// One record per employee per date — prevent duplicates
AttendanceSchema.index({ employee: 1, date: 1, createdBy: 1 }, { unique: true });

module.exports = mongoose.model('Attendance', AttendanceSchema);
