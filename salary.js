/**
 * routes/salary.js
 * Salary computation + advance salary management.
 *
 *   GET    /api/salary/report?month=YYYY-MM  — full monthly salary report
 *   GET    /api/salary/advances              — list advances for a month
 *   POST   /api/salary/advances              — add an advance entry
 *   PUT    /api/salary/advances/:id          — edit an advance entry
 *   DELETE /api/salary/advances/:id          — delete an advance entry
 */

const router         = require('express').Router();
const { body, validationResult } = require('express-validator');
const Attendance     = require('../models/Attendance');
const Employee       = require('../models/Employee');
const AdvanceSalary  = require('../models/AdvanceSalary');
const authMW         = require('../middleware/auth');

router.use(authMW);

// ── GET /api/salary/report?month=YYYY-MM ────────────────────────
// Computes the full salary breakdown for every employee in the given month.
// Formula:
//   Base Salary   = (Present days × wage) + (Half-Day days × wage × 0.5)
//   Advance Taken = sum of all advance entries for that employee + month
//   Final Payable = Base Salary − Advance Taken
router.get('/report', async (req, res) => {
  const { month } = req.query;
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return res.status(400).json({ success: false, message: 'month query param required (YYYY-MM).' });
  }

  try {
    const employees = await Employee.find({ createdBy: req.user._id, isActive: true });
    if (!employees.length) {
      return res.json({ success: true, data: [], grandTotal: 0, grandAdvance: 0, grandPayable: 0 });
    }

    // Fetch all attendance records for this month + admin
    const attendance = await Attendance.find({
      createdBy: req.user._id,
      date: { $regex: `^${month}` },
    });

    // Fetch all advance records for this month + admin
    const advances = await AdvanceSalary.find({
      createdBy: req.user._id,
      month,
    });

    let grandTotal   = 0;
    let grandAdvance = 0;
    let grandPayable = 0;

    const data = employees.map(emp => {
      const empAtt   = attendance.filter(a => String(a.employee) === String(emp._id));
      const empAdv   = advances.filter(a => String(a.employee) === String(emp._id));

      const presentCount  = empAtt.filter(a => a.status === 'Present').length;
      const halfDayCount  = empAtt.filter(a => a.status === 'Half-Day').length;
      const absentCount   = empAtt.filter(a => a.status === 'Absent').length;
      const leaveCount    = empAtt.filter(a => a.status === 'Leave').length;
      const totalHours    = empAtt.reduce((s, a) => s + (a.hoursWorked || 0), 0);

      // Salary formula (no overtime)
      const baseSalary    = (presentCount * emp.wage) + (halfDayCount * emp.wage * 0.5);
      const advanceTaken  = empAdv.reduce((s, a) => s + a.amount, 0);
      const finalPayable  = Math.max(0, baseSalary - advanceTaken);

      grandTotal   += baseSalary;
      grandAdvance += advanceTaken;
      grandPayable += finalPayable;

      return {
        employee: {
          _id:   emp._id,
          name:  emp.name,
          empId: emp.empId,
          role:  emp.role,
          wage:  emp.wage,
        },
        presentCount, halfDayCount, absentCount, leaveCount,
        totalHours: parseFloat(totalHours.toFixed(1)),
        baseSalary,
        advances: empAdv,
        advanceTaken,
        finalPayable,
      };
    });

    res.json({
      success: true,
      month,
      data,
      grandTotal:   parseFloat(grandTotal.toFixed(2)),
      grandAdvance: parseFloat(grandAdvance.toFixed(2)),
      grandPayable: parseFloat(grandPayable.toFixed(2)),
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/salary/advances?month=YYYY-MM&employeeId=xxx ────────
router.get('/advances', async (req, res) => {
  try {
    const filter = { createdBy: req.user._id };
    if (req.query.month)      filter.month    = req.query.month;
    if (req.query.employeeId) filter.employee = req.query.employeeId;

    const advances = await AdvanceSalary
      .find(filter)
      .populate('employee', 'name empId role')
      .sort({ date: -1 });

    res.json({ success: true, data: advances });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/salary/advances ────────────────────────────────────
router.post('/advances', [
  body('employeeId').notEmpty().withMessage('Employee is required'),
  body('amount').isFloat({ min: 1 }).withMessage('Amount must be at least ₹1'),
  body('month').matches(/^\d{4}-\d{2}$/).withMessage('Month must be YYYY-MM'),
  body('date').matches(/^\d{4}-\d{2}-\d{2}$/).withMessage('Date must be YYYY-MM-DD'),
  body('note').optional().trim(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

  const { employeeId, amount, month, date, note } = req.body;

  try {
    const emp = await Employee.findOne({ _id: employeeId, createdBy: req.user._id, isActive: true });
    if (!emp) return res.status(404).json({ success: false, message: 'Employee not found.' });

    const advance = await AdvanceSalary.create({
      employee:  employeeId,
      createdBy: req.user._id,
      amount:    parseFloat(amount),
      month, date,
      note: note || '',
    });

    const populated = await advance.populate('employee', 'name empId role');
    res.status(201).json({ success: true, data: populated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── PUT /api/salary/advances/:id ─────────────────────────────────
router.put('/advances/:id', [
  body('amount').isFloat({ min: 1 }).withMessage('Amount must be at least ₹1'),
  body('note').optional().trim(),
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

  try {
    const advance = await AdvanceSalary.findOne({ _id: req.params.id, createdBy: req.user._id });
    if (!advance) return res.status(404).json({ success: false, message: 'Advance record not found.' });

    advance.amount = parseFloat(req.body.amount);
    if (req.body.note !== undefined) advance.note = req.body.note;
    if (req.body.date) advance.date = req.body.date;

    await advance.save();
    const populated = await advance.populate('employee', 'name empId role');
    res.json({ success: true, data: populated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── DELETE /api/salary/advances/:id ─────────────────────────────
router.delete('/advances/:id', async (req, res) => {
  try {
    const adv = await AdvanceSalary.findOneAndDelete({ _id: req.params.id, createdBy: req.user._id });
    if (!adv) return res.status(404).json({ success: false, message: 'Record not found.' });
    res.json({ success: true, message: 'Advance record deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
