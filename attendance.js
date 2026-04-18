/**
 * routes/attendance.js
 * CRUD for daily attendance records.
 *
 *   GET    /api/attendance              — list records (filterable by employee, month)
 *   POST   /api/attendance              — create a record
 *   PUT    /api/attendance/:id          — update (edit) a record
 *   DELETE /api/attendance/:id          — delete a record
 *   GET    /api/attendance/today        — all records for today
 */

const router     = require('express').Router();
const { body, query, validationResult } = require('express-validator');
const Attendance = require('../models/Attendance');
const Employee   = require('../models/Employee');
const authMW     = require('../middleware/auth');

router.use(authMW);

// Helper: compute hours worked from HH:MM strings
const hoursFromTimes = (checkIn, checkOut) => {
  if (!checkIn || !checkOut) return 0;
  const toMin = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  let start = toMin(checkIn), end = toMin(checkOut);
  if (end < start) end += 1440;  // overnight shift
  return parseFloat(((end - start) / 60).toFixed(2));
};

const attValidation = [
  body('employeeId').notEmpty().withMessage('Employee ID is required'),
  body('date').matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('Date must be YYYY-MM-DD'),
  body('status').isIn(['Present','Absent','Half-Day','Leave']).withMessage('Invalid status'),
  body('checkIn').optional().matches(/^\d{2}:\d{2}$/).withMessage('checkIn must be HH:MM'),
  body('checkOut').optional().matches(/^\d{2}:\d{2}$/).withMessage('checkOut must be HH:MM'),
];

// ── GET /api/attendance/today ────────────────────────────────────
router.get('/today', async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const records = await Attendance
      .find({ createdBy: req.user._id, date: today })
      .populate('employee', 'name empId role wage');

    res.json({ success: true, data: records });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/attendance ──────────────────────────────────────────
// Query params: ?employeeId=xxx&month=YYYY-MM&page=1&limit=50
router.get('/', async (req, res) => {
  try {
    const filter = { createdBy: req.user._id };

    if (req.query.employeeId) filter.employee = req.query.employeeId;
    if (req.query.month)      filter.date = { $regex: `^${req.query.month}` };
    if (req.query.date)       filter.date = req.query.date;

    const page  = parseInt(req.query.page)  || 1;
    const limit = parseInt(req.query.limit) || 200;

    const records = await Attendance
      .find(filter)
      .populate('employee', 'name empId role wage')
      .sort({ date: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await Attendance.countDocuments(filter);

    res.json({ success: true, count: records.length, total, data: records });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/attendance ─────────────────────────────────────────
router.post('/', attValidation, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

  const { employeeId, date, status, checkIn, checkOut, notes } = req.body;

  try {
    // Verify employee belongs to this admin
    const emp = await Employee.findOne({ _id: employeeId, createdBy: req.user._id, isActive: true });
    if (!emp) return res.status(404).json({ success: false, message: 'Employee not found.' });

    // Check for duplicate
    const dup = await Attendance.findOne({ employee: employeeId, date, createdBy: req.user._id });
    if (dup) {
      return res.status(409).json({
        success: false,
        message: 'Record already exists for this employee on this date.',
        existingId: dup._id,
      });
    }

    const needsTime = status === 'Present' || status === 'Half-Day';
    const hours = needsTime ? hoursFromTimes(checkIn, checkOut) : 0;

    const record = await Attendance.create({
      employee:    employeeId,
      createdBy:   req.user._id,
      date, status, notes: notes || '',
      checkIn:     needsTime ? (checkIn  || '') : '',
      checkOut:    needsTime ? (checkOut || '') : '',
      hoursWorked: hours,
    });

    const populated = await record.populate('employee', 'name empId role wage');
    res.status(201).json({ success: true, data: populated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── PUT /api/attendance/:id ──────────────────────────────────────
router.put('/:id', attValidation, async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

  const { employeeId, date, status, checkIn, checkOut, notes } = req.body;

  try {
    const record = await Attendance.findOne({ _id: req.params.id, createdBy: req.user._id });
    if (!record) return res.status(404).json({ success: false, message: 'Record not found.' });

    // If date or employee changed, check for duplicate conflict
    if (date !== record.date || employeeId !== String(record.employee)) {
      const conflict = await Attendance.findOne({
        employee: employeeId, date, createdBy: req.user._id,
        _id: { $ne: record._id },
      });
      if (conflict) return res.status(409).json({ success: false, message: 'A record already exists for that employee on that date.' });
    }

    const needsTime = status === 'Present' || status === 'Half-Day';
    record.employee    = employeeId;
    record.date        = date;
    record.status      = status;
    record.checkIn     = needsTime ? (checkIn  || '') : '';
    record.checkOut    = needsTime ? (checkOut || '') : '';
    record.hoursWorked = needsTime ? hoursFromTimes(checkIn, checkOut) : 0;
    record.notes       = notes || '';

    await record.save();
    const populated = await record.populate('employee', 'name empId role wage');
    res.json({ success: true, data: populated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── DELETE /api/attendance/:id ───────────────────────────────────
router.delete('/:id', async (req, res) => {
  try {
    const record = await Attendance.findOneAndDelete({ _id: req.params.id, createdBy: req.user._id });
    if (!record) return res.status(404).json({ success: false, message: 'Record not found.' });
    res.json({ success: true, message: 'Record deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
