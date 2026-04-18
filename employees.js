/**
 * routes/employees.js
 * Full CRUD for employees (all routes are protected by JWT auth).
 *
 *   GET    /api/employees          — list all employees for this branch
 *   POST   /api/employees          — create new employee
 *   PUT    /api/employees/:id      — update employee (admin edit)
 *   DELETE /api/employees/:id      — soft-delete employee
 */

const router   = require('express').Router();
const { body, validationResult } = require('express-validator');
const Employee = require('../models/Employee');
const authMW   = require('../middleware/auth');

// All routes below require a valid JWT
router.use(authMW);

// Validation rules for creating/updating an employee
const empValidation = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('empId').trim().notEmpty().withMessage('Employee ID is required'),
  body('role').isIn(['Delivery Executive','Sorter','Dispatcher','Loader','Supervisor','Driver'])
    .withMessage('Invalid role'),
  body('wage').isFloat({ min: 0 }).withMessage('Wage must be a positive number'),
  body('mobile').optional().matches(/^[6-9]\d{9}$/).withMessage('Invalid mobile number'),
];

// ── GET /api/employees ───────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    // Only return active employees for THIS admin's branch
    const employees = await Employee
      .find({ createdBy: req.user._id, isActive: true })
      .sort({ createdAt: -1 });

    res.json({ success: true, count: employees.length, data: employees });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/employees ──────────────────────────────────────────
router.post('/', empValidation, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

  const { name, empId, role, wage, mobile } = req.body;

  try {
    // Check for duplicate empId within this branch
    const exists = await Employee.findOne({ empId, createdBy: req.user._id, isActive: true });
    if (exists) {
      return res.status(409).json({ success: false, message: 'Employee ID already exists in this branch.' });
    }

    const emp = await Employee.create({
      createdBy: req.user._id,
      name, empId, role,
      wage: parseFloat(wage),
      mobile: mobile || '',
    });

    res.status(201).json({ success: true, data: emp });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── PUT /api/employees/:id ───────────────────────────────────────
router.put('/:id', empValidation, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

  try {
    const emp = await Employee.findOne({ _id: req.params.id, createdBy: req.user._id });
    if (!emp) return res.status(404).json({ success: false, message: 'Employee not found.' });

    const { name, empId, role, wage, mobile } = req.body;

    // If empId is changing, check no conflict
    if (empId !== emp.empId) {
      const conflict = await Employee.findOne({ empId, createdBy: req.user._id, isActive: true });
      if (conflict) return res.status(409).json({ success: false, message: 'New Employee ID already exists.' });
    }

    emp.name   = name;
    emp.empId  = empId;
    emp.role   = role;
    emp.wage   = parseFloat(wage);
    emp.mobile = mobile || '';

    await emp.save();
    res.json({ success: true, data: emp });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── DELETE /api/employees/:id ────────────────────────────────────
// Soft-delete: sets isActive = false instead of removing from DB
router.delete('/:id', async (req, res) => {
  try {
    const emp = await Employee.findOne({ _id: req.params.id, createdBy: req.user._id });
    if (!emp) return res.status(404).json({ success: false, message: 'Employee not found.' });

    emp.isActive = false;
    await emp.save();

    res.json({ success: true, message: `${emp.name} removed from active employees.` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
