/**
 * models/AdvanceSalary.js
 * Tracks advance salary taken by an employee in a given month.
 * Multiple advance entries can exist per employee per month.
 */

const mongoose = require('mongoose');

const AdvanceSalarySchema = new mongoose.Schema({
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
  // YYYY-MM format — which month this advance belongs to
  month: {
    type: String,
    required: true,
    match: [/^\d{4}-\d{2}$/, 'Month must be YYYY-MM format'],
  },
  amount: {
    type: Number,
    required: [true, 'Advance amount is required'],
    min: [1, 'Amount must be at least ₹1'],
  },
  note: {
    type: String,
    default: '',
    maxlength: 200,
  },
  date: {
    type: String,   // YYYY-MM-DD — the day the advance was given
    required: true,
  },
}, { timestamps: true });

module.exports = mongoose.model('AdvanceSalary', AdvanceSalarySchema);
