/**
 * models/Employee.js
 * Stores employee information for a courier branch.
 */

const mongoose = require('mongoose');

const EmployeeSchema = new mongoose.Schema({
  // Link each employee to the admin/branch who created them
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  name: {
    type: String,
    required: [true, 'Employee name is required'],
    trim: true,
  },
  empId: {
    type: String,
    required: [true, 'Employee ID is required'],
    trim: true,
  },
  role: {
    type: String,
    required: true,
    enum: ['Delivery Executive', 'Sorter', 'Dispatcher', 'Loader', 'Supervisor', 'Driver'],
  },
  // Base daily wage in Indian Rupees
  wage: {
    type: Number,
    required: [true, 'Daily wage is required'],
    min: [0, 'Wage cannot be negative'],
  },
  mobile: {
    type: String,
    trim: true,
    default: '',
  },
  isActive: {
    type: Boolean,
    default: true,  // soft-delete: set false instead of removing
  },
}, { timestamps: true });

// Compound index: employee ID must be unique per branch (per admin)
EmployeeSchema.index({ empId: 1, createdBy: 1 }, { unique: true });

module.exports = mongoose.model('Employee', EmployeeSchema);
