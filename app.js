/**
 * js/app.js
 * CourierOps Frontend — Main Application Logic
 * Controls all tabs, forms, tables, and API interactions.
 */

/* ================================================================
   STATE
================================================================ */
let employees  = [];   // cached employee list
let attendance = [];   // cached attendance records (current filter)

/* ================================================================
   UTILITIES
================================================================ */
const fmt    = n  => '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2 });
const ini    = n  => (n || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
const today  = () => new Date().toISOString().slice(0, 10);
const curMo  = () => new Date().toISOString().slice(0, 7);

function toHoursMin(decHours) {
  const h = Math.floor(decHours), m = Math.round((decHours - h) * 60);
  return `${h}h ${m}m`;
}

// Compute hours worked from two HH:MM strings
function calcHoursFromTimes(ci, co) {
  if (!ci || !co) return 0;
  const toMin = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  let s = toMin(ci), e = toMin(co);
  if (e < s) e += 1440;
  return parseFloat(((e - s) / 60).toFixed(2));
}

/* ================================================================
   TOAST NOTIFICATIONS
================================================================ */
function toast(msg, type = 'info') {
  const ic = { success: 'fa-circle-check', error: 'fa-circle-xmark', info: 'fa-circle-info', warn: 'fa-triangle-exclamation' };
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<i class="fas ${ic[type] || ic.info} toast-icon"></i><span>${msg}</span>`;
  document.getElementById('toasts').appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

/* ================================================================
   MODAL
================================================================ */
function openModal(title, bodyHTML, onConfirm, confirmLabel = 'Save', confirmClass = 'btn-primary') {
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalBody').innerHTML     = bodyHTML;
  document.getElementById('modalConfirmBtn').className = `btn ${confirmClass}`;
  document.getElementById('modalConfirmBtn').textContent = confirmLabel;
  document.getElementById('modalConfirmBtn').onclick = onConfirm;
  document.getElementById('modal').classList.add('open');
}

function closeModal() {
  document.getElementById('modal').classList.remove('open');
}

/* ================================================================
   LOADING STATE
================================================================ */
function setLoading(show, msg = 'Loading…') {
  document.getElementById('globalLoader').style.display = show ? 'flex' : 'none';
  document.getElementById('loaderMsg').textContent = msg;
}

/* ================================================================
   AUTH — OTP FLOW
================================================================ */
let otpStep = 1;  // 1 = enter mobile, 2 = enter OTP

function showAuthScreen() {
  document.getElementById('authScreen').style.display = 'flex';
  document.getElementById('appShell').style.display   = 'none';
  otpStep = 1;
  renderOTPStep1();
}

function showAppShell() {
  document.getElementById('authScreen').style.display = 'none';
  document.getElementById('appShell').style.display   = 'flex';
  const user = Auth.getUser();
  if (user) {
    document.getElementById('sbAvatar').textContent = ini(user.name);
    document.getElementById('sbName').textContent   = user.name;
    document.getElementById('sbRole').textContent   = user.role + ' · ' + (user.branchName || 'Branch');
  }
}

function renderOTPStep1() {
  document.getElementById('authContent').innerHTML = `
    <div class="auth-step" id="step1">
      <div class="auth-heading">Welcome to CourierOps</div>
      <div class="auth-sub">Enter your mobile number to sign in or register</div>
      <div class="auth-form-group">
        <label>Mobile Number</label>
        <div class="auth-input-wrap">
          <span class="auth-prefix">+91</span>
          <input type="tel" id="authMobile" maxlength="10" placeholder="10-digit mobile number"
                 inputmode="numeric" onkeydown="if(event.key==='Enter')sendOTP()"/>
        </div>
      </div>
      <div class="auth-form-group" id="nameGroup" style="display:none">
        <label>Your Name <span style="color:var(--text-muted);font-size:11px">(first-time only)</span></label>
        <input type="text" id="authName" placeholder="e.g. Rajesh Kumar"/>
      </div>
      <div class="auth-form-group" id="branchGroup" style="display:none">
        <label>Branch Name <span style="color:var(--text-muted);font-size:11px">(first-time only)</span></label>
        <input type="text" id="authBranch" placeholder="e.g. Bhubaneswar Main Branch"/>
      </div>
      <div id="authErr" class="auth-err"></div>
      <button class="btn-auth" onclick="sendOTP()">
        <i class="fas fa-paper-plane"></i> Send OTP
      </button>
    </div>`;

  // Check if it looks like a new number as they type
  document.getElementById('authMobile').addEventListener('blur', async () => {
    const mobile = document.getElementById('authMobile').value.trim();
    if (mobile.length !== 10) return;
    // Show name/branch fields optimistically for new users
    // (backend will confirm, but UX is smoother this way)
    document.getElementById('nameGroup').style.display   = '';
    document.getElementById('branchGroup').style.display = '';
  });
}

async function sendOTP() {
  const mobile = document.getElementById('authMobile').value.trim();
  const name   = document.getElementById('authName')?.value.trim() || '';
  const branch = document.getElementById('authBranch')?.value.trim() || '';
  const errEl  = document.getElementById('authErr');
  errEl.textContent = '';

  if (!/^[6-9]\d{9}$/.test(mobile)) {
    errEl.textContent = 'Enter a valid 10-digit Indian mobile number.';
    return;
  }

  try {
    document.querySelector('.btn-auth').disabled = true;
    document.querySelector('.btn-auth').innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending…';
    const res = await AuthAPI.sendOTP(mobile, name || undefined, branch || undefined);
    renderOTPStep2(mobile, res.devOTP);
  } catch (err) {
    errEl.textContent = err.message;
    document.querySelector('.btn-auth').disabled = false;
    document.querySelector('.btn-auth').innerHTML = '<i class="fas fa-paper-plane"></i> Send OTP';
  }
}

function renderOTPStep2(mobile, devOTP) {
  document.getElementById('authContent').innerHTML = `
    <div class="auth-step">
      <div class="auth-heading">Enter OTP</div>
      <div class="auth-sub">We sent a 6-digit OTP to <strong>+91 ${mobile}</strong></div>
      ${devOTP ? `<div class="dev-otp-hint">🛠️ Dev mode OTP: <strong>${devOTP}</strong></div>` : ''}
      <div class="auth-form-group">
        <label>One-Time Password</label>
        <input type="text" id="authOTP" maxlength="6" placeholder="6-digit OTP"
               inputmode="numeric" style="letter-spacing:8px;font-size:22px;text-align:center;font-family:'Space Mono',monospace"
               onkeydown="if(event.key==='Enter')verifyOTP('${mobile}')"/>
      </div>
      <div id="authErr" class="auth-err"></div>
      <button class="btn-auth" onclick="verifyOTP('${mobile}')">
        <i class="fas fa-check-circle"></i> Verify & Sign In
      </button>
      <button class="btn-auth-link" onclick="renderOTPStep1()">
        ← Change number
      </button>
      <div class="auth-resend">Didn't receive? <button class="btn-auth-link" onclick="sendOTPAgain('${mobile}')">Resend OTP</button></div>
    </div>`;

  document.getElementById('authOTP').focus();
}

async function sendOTPAgain(mobile) {
  try {
    const res = await AuthAPI.sendOTP(mobile);
    toast('OTP resent!', 'success');
    if (res.devOTP) {
      document.querySelector('.dev-otp-hint').innerHTML = `🛠️ Dev mode OTP: <strong>${res.devOTP}</strong>`;
    }
  } catch (err) { toast(err.message, 'error'); }
}

async function verifyOTP(mobile) {
  const otp   = document.getElementById('authOTP').value.trim();
  const errEl = document.getElementById('authErr');
  errEl.textContent = '';

  if (otp.length !== 6) { errEl.textContent = 'Please enter the 6-digit OTP.'; return; }

  try {
    document.querySelector('.btn-auth').disabled = true;
    document.querySelector('.btn-auth').innerHTML = '<i class="fas fa-spinner fa-spin"></i> Verifying…';

    const res = await AuthAPI.verifyOTP(mobile, otp);
    Auth.setToken(res.token);
    Auth.setUser(res.user);
    showAppShell();
    initApp();
    toast(`Welcome, ${res.user.name}!`, 'success');
  } catch (err) {
    errEl.textContent = err.message;
    document.querySelector('.btn-auth').disabled = false;
    document.querySelector('.btn-auth').innerHTML = '<i class="fas fa-check-circle"></i> Verify & Sign In';
  }
}

function doLogout() {
  if (!confirm('Sign out of CourierOps?')) return;
  Auth.clear();
  showAuthScreen();
}

/* ================================================================
   NAVIGATION
================================================================ */
const META = {
  dashboard:  { title: 'Dashboard',       sub: 'Branch overview & quick stats' },
  attendance: { title: 'Log Attendance',  sub: 'Record daily in/out shifts' },
  employees:  { title: 'Employee List',   sub: 'Manage registered staff' },
  advances:   { title: 'Advance Salary',  sub: 'Track salary advances' },
  salary:     { title: 'Salary Reports',  sub: 'Monthly payroll computation' },
};

function switchTab(id, el) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('tab-' + id)?.classList.add('active');
  el?.classList.add('active');
  document.getElementById('pageTitle').textContent = META[id]?.title || id;
  document.getElementById('pageSub').textContent   = META[id]?.sub   || '';
  if (id === 'dashboard')  renderDashboard();
  if (id === 'attendance') { fillEmpDrops(); renderAttTable(); }
  if (id === 'employees')  renderEmpTable();
  if (id === 'advances')   { fillEmpDrops(); renderAdvancesTable(); }
  if (id === 'salary')     fillEmpDrops();
  closeSidebar();
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sbOverlay').classList.toggle('active');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sbOverlay').classList.remove('active');
}

/* ================================================================
   EMPLOYEES
================================================================ */
async function loadEmployees() {
  try {
    const res = await EmployeesAPI.list();
    employees = res.data;
    return employees;
  } catch (err) { toast(err.message, 'error'); return []; }
}

function renderEmpTable() {
  const tbody = document.getElementById('empBody');
  if (!employees.length) {
    tbody.innerHTML = emptyState('fa-user-slash', 'No employees registered', 'Add your first employee using the form above.');
    document.getElementById('empCount').textContent = '0 staff';
    return;
  }
  document.getElementById('empCount').textContent = `${employees.length} staff`;
  tbody.innerHTML = employees.map(e => `
    <tr>
      <td><div class="emp-name-cell"><div class="emp-avatar">${ini(e.name)}</div>${e.name}</div></td>
      <td><span class="mono sm">${e.empId}</span></td>
      <td><span class="role-tag">${e.role}</span></td>
      <td><span class="mono">${fmt(e.wage)}/day</span></td>
      <td>${e.mobile || '—'}</td>
      <td class="no-print">
        <div style="display:flex;gap:6px">
          <button class="btn-icon" onclick="editEmpModal('${e._id}')" title="Edit"><i class="fas fa-pen"></i></button>
          <button class="btn-icon danger" onclick="deleteEmp('${e._id}','${e.name}')" title="Delete"><i class="fas fa-trash-can"></i></button>
        </div>
      </td>
    </tr>`).join('');
}

async function addEmp() {
  const name  = v('eName'), empId = v('eId'), role = v('eRole'),
        wage  = v('eWage'), mob   = v('eMob');
  if (!name || !empId || !wage) { toast('Name, ID and Wage are required.', 'error'); return; }
  try {
    setBtnLoading('addEmpBtn', true);
    await EmployeesAPI.create({ name, empId, role, wage: parseFloat(wage), mobile: mob });
    ['eName','eId','eWage','eMob'].forEach(id => set(id, ''));
    await loadEmployees();
    renderEmpTable();
    fillEmpDrops();
    updateCards();
    toast(`${name} registered!`, 'success');
  } catch (err) { toast(err.message, 'error'); }
  finally { setBtnLoading('addEmpBtn', false, '<i class="fas fa-user-plus"></i> Register Employee'); }
}

function editEmpModal(id) {
  const e = employees.find(x => x._id === id);
  if (!e) return;
  openModal('Edit Employee', `
    <div class="form-grid">
      <div class="form-group"><label>Full Name</label><input id="m_name" value="${e.name}"/></div>
      <div class="form-group"><label>Employee ID</label><input id="m_empId" value="${e.empId}"/></div>
      <div class="form-group"><label>Role</label>
        <select id="m_role">
          ${['Delivery Executive','Sorter','Dispatcher','Loader','Supervisor','Driver']
            .map(r => `<option ${r===e.role?'selected':''}>${r}</option>`).join('')}
        </select>
      </div>
      <div class="form-group"><label>Daily Wage (₹)</label><input type="number" id="m_wage" value="${e.wage}"/></div>
      <div class="form-group"><label>Mobile</label><input type="tel" id="m_mobile" value="${e.mobile||''}"/></div>
    </div>`, async () => {
    try {
      await EmployeesAPI.update(id, {
        name: v('m_name'), empId: v('m_empId'), role: v('m_role'),
        wage: parseFloat(v('m_wage')), mobile: v('m_mobile'),
      });
      closeModal();
      await loadEmployees();
      renderEmpTable();
      fillEmpDrops();
      toast('Employee updated!', 'success');
    } catch (err) { toast(err.message, 'error'); }
  });
}

async function deleteEmp(id, name) {
  if (!confirm(`Delete ${name} and all their records?`)) return;
  try {
    await EmployeesAPI.remove(id);
    await loadEmployees();
    renderEmpTable();
    fillEmpDrops();
    updateCards();
    toast(`${name} removed.`, 'info');
  } catch (err) { toast(err.message, 'error'); }
}

/* ================================================================
   ATTENDANCE
================================================================ */
function toggleTime() {
  const s    = v('aStatus');
  const show = s === 'Present' || s === 'Half-Day';
  ['grpIn','grpOut','grpHrs'].forEach(id => {
    document.getElementById(id).style.display = show ? '' : 'none';
  });
  if (show) calcHrs(); else set('hrsDisplay', '—');
}

function calcHrs() {
  const ci = v('aIn'), co = v('aOut'), el = document.getElementById('hrsDisplay');
  if (!ci || !co) { el.textContent = '—'; return 0; }
  const hrs = calcHoursFromTimes(ci, co);
  el.textContent = toHoursMin(hrs);
  return hrs;
}

async function logAtt() {
  const empId  = v('aEmp'), date = v('aDate'), status = v('aStatus'),
        ci     = v('aIn'),  co   = v('aOut'), notes  = v('aNotes');
  if (!empId || !date) { toast('Select employee and date.', 'error'); return; }
  try {
    setBtnLoading('saveAttBtn', true);
    await AttendanceAPI.create({ employeeId: empId, date, status, checkIn: ci, checkOut: co, notes });
    toast('Attendance saved!', 'success');
    resetAtt();
    await refreshAtt();
    updateCards();
  } catch (err) {
    // If duplicate, offer to overwrite
    if (err.message.includes('already exists')) {
      if (confirm('A record already exists for this employee on this date. Overwrite?')) {
        await overwriteAtt(empId, date, status, ci, co, notes);
      }
    } else toast(err.message, 'error');
  }
  finally { setBtnLoading('saveAttBtn', false, '<i class="fas fa-circle-check"></i> Save Attendance'); }
}

async function overwriteAtt(empId, date, status, ci, co, notes) {
  try {
    // Find the existing record and update it
    const res = await AttendanceAPI.list({ employeeId: empId, date });
    const existing = res.data[0];
    if (!existing) return;
    await AttendanceAPI.update(existing._id, { employeeId: empId, date, status, checkIn: ci, checkOut: co, notes });
    toast('Attendance updated!', 'success');
    await refreshAtt();
    updateCards();
  } catch (err) { toast(err.message, 'error'); }
}

function resetAtt() {
  set('aEmp', ''); set('aDate', today()); set('aStatus', 'Present');
  set('aIn', '09:00'); set('aOut', '18:00'); set('aNotes', '');
  toggleTime();
}

async function refreshAtt() {
  const fe = v('filterEmp'), fm = v('filterMo');
  const params = {};
  if (fe) params.employeeId = fe;
  if (fm) params.month = fm;
  try {
    const res = await AttendanceAPI.list(params);
    attendance = res.data;
    renderAttTable();
  } catch (err) { toast(err.message, 'error'); }
}

function renderAttTable() {
  const tbody = document.getElementById('attBody');
  if (!attendance.length) {
    tbody.innerHTML = `<tr><td colspan="8">${emptyState('fa-calendar-days','No records found','Log attendance or adjust your filter.')}</td></tr>`;
    return;
  }
  const bc = s => ({ Present:'badge-present', Absent:'badge-absent', 'Half-Day':'badge-halfday', Leave:'badge-leave' })[s] || '';
  tbody.innerHTML = attendance.map(a => `
    <tr>
      <td><div class="emp-name-cell"><div class="emp-avatar">${ini(a.employee?.name)}</div>${a.employee?.name || '—'}</div></td>
      <td><span class="role-tag">${a.employee?.role || '—'}</span></td>
      <td><span class="mono sm">${a.date}</span></td>
      <td><span class="badge ${bc(a.status)}">${a.status}</span></td>
      <td><span class="mono sm">${a.checkIn  || '—'}</span></td>
      <td><span class="mono sm">${a.checkOut || '—'}</span></td>
      <td><span class="mono sm">${a.hoursWorked ? toHoursMin(a.hoursWorked) : '—'}</span></td>
      <td class="no-print">
        <div style="display:flex;gap:6px">
          <button class="btn-icon" onclick="editAttModal('${a._id}')" title="Edit"><i class="fas fa-pen"></i></button>
          <button class="btn-icon danger" onclick="deleteAtt('${a._id}')" title="Delete"><i class="fas fa-trash-can"></i></button>
        </div>
      </td>
    </tr>`).join('');
}

function editAttModal(id) {
  const a = attendance.find(x => x._id === id);
  if (!a) return;
  const empOpts = employees.map(e =>
    `<option value="${e._id}" ${e._id===a.employee?._id?'selected':''}>${e.name} (${e.empId})</option>`
  ).join('');
  openModal('Edit Attendance Record', `
    <div class="form-grid">
      <div class="form-group"><label>Employee</label><select id="m_emp">${empOpts}</select></div>
      <div class="form-group"><label>Date</label><input type="date" id="m_date" value="${a.date}"/></div>
      <div class="form-group"><label>Status</label>
        <select id="m_status" onchange="toggleModalTime()">
          ${['Present','Absent','Half-Day','Leave'].map(s => `<option ${s===a.status?'selected':''}>${s}</option>`).join('')}
        </select>
      </div>
      <div class="form-group" id="m_grpIn"><label>Check-In</label><input type="time" id="m_ci" value="${a.checkIn||'09:00'}" oninput="calcModalHrs()"/></div>
      <div class="form-group" id="m_grpOut"><label>Check-Out</label><input type="time" id="m_co" value="${a.checkOut||'18:00'}" oninput="calcModalHrs()"/></div>
      <div class="form-group"><label>Hours</label><div class="hours-display" id="m_hrs">${a.hoursWorked ? toHoursMin(a.hoursWorked) : '—'}</div></div>
      <div class="form-group" style="grid-column:1/-1"><label>Notes</label><input id="m_notes" value="${a.notes||''}"/></div>
    </div>`, async () => {
    try {
      await AttendanceAPI.update(id, {
        employeeId: v('m_emp'), date: v('m_date'), status: v('m_status'),
        checkIn: v('m_ci'), checkOut: v('m_co'), notes: v('m_notes'),
      });
      closeModal();
      await refreshAtt();
      toast('Record updated!', 'success');
    } catch (err) { toast(err.message, 'error'); }
  });
  toggleModalTime();
}

function toggleModalTime() {
  const s = v('m_status');
  const show = s === 'Present' || s === 'Half-Day';
  ['m_grpIn','m_grpOut'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = show ? '' : 'none';
  });
}

function calcModalHrs() {
  const ci = v('m_ci'), co = v('m_co');
  const el = document.getElementById('m_hrs');
  if (el && ci && co) el.textContent = toHoursMin(calcHoursFromTimes(ci, co));
}

async function deleteAtt(id) {
  if (!confirm('Delete this attendance record?')) return;
  try {
    await AttendanceAPI.remove(id);
    await refreshAtt();
    updateCards();
    toast('Record deleted.', 'info');
  } catch (err) { toast(err.message, 'error'); }
}

/* ================================================================
   ADVANCE SALARY
================================================================ */
async function addAdvance() {
  const empId  = v('advEmp'), amount = v('advAmount'),
        month  = v('advMonth'), date  = v('advDate'), note = v('advNote');
  if (!empId || !amount || !month || !date) { toast('All fields except note are required.', 'error'); return; }
  try {
    setBtnLoading('addAdvBtn', true);
    await SalaryAPI.addAdvance({ employeeId: empId, amount: parseFloat(amount), month, date, note });
    ['advAmount','advNote'].forEach(id => set(id,''));
    await renderAdvancesTable();
    toast('Advance recorded!', 'success');
  } catch (err) { toast(err.message, 'error'); }
  finally { setBtnLoading('addAdvBtn', false, '<i class="fas fa-plus"></i> Add Advance'); }
}

async function renderAdvancesTable() {
  const fe = v('filterAdvEmp'), fm = v('filterAdvMo');
  const params = {};
  if (fe) params.employeeId = fe;
  if (fm) params.month = fm;
  try {
    const res = await SalaryAPI.listAdvances(params);
    const tbody = document.getElementById('advBody');
    if (!res.data.length) {
      tbody.innerHTML = `<tr><td colspan="6">${emptyState('fa-money-bill-wave','No advance records','Add an advance using the form above.')}</td></tr>`;
      return;
    }
    tbody.innerHTML = res.data.map(a => `
      <tr>
        <td><div class="emp-name-cell"><div class="emp-avatar">${ini(a.employee?.name)}</div>${a.employee?.name||'—'}</div></td>
        <td><span class="mono sm">${a.month}</span></td>
        <td><span class="mono sm">${a.date}</span></td>
        <td><span class="mono" style="color:var(--red)">${fmt(a.amount)}</span></td>
        <td>${a.note || '—'}</td>
        <td class="no-print">
          <div style="display:flex;gap:6px">
            <button class="btn-icon" onclick="editAdvModal('${a._id}','${a.amount}','${a.note||''}','${a.date}')" title="Edit"><i class="fas fa-pen"></i></button>
            <button class="btn-icon danger" onclick="deleteAdv('${a._id}')" title="Delete"><i class="fas fa-trash-can"></i></button>
          </div>
        </td>
      </tr>`).join('');
  } catch (err) { toast(err.message, 'error'); }
}

function editAdvModal(id, amount, note, date) {
  openModal('Edit Advance Record', `
    <div class="form-grid">
      <div class="form-group"><label>Amount (₹)</label><input type="number" id="m_advAmt" value="${amount}" min="1"/></div>
      <div class="form-group"><label>Date Given</label><input type="date" id="m_advDate" value="${date}"/></div>
      <div class="form-group" style="grid-column:1/-1"><label>Note</label><input id="m_advNote" value="${note}"/></div>
    </div>`, async () => {
    try {
      await SalaryAPI.updateAdvance(id, { amount: parseFloat(v('m_advAmt')), note: v('m_advNote'), date: v('m_advDate') });
      closeModal();
      await renderAdvancesTable();
      toast('Advance updated!', 'success');
    } catch (err) { toast(err.message, 'error'); }
  });
}

async function deleteAdv(id) {
  if (!confirm('Delete this advance record?')) return;
  try {
    await SalaryAPI.removeAdvance(id);
    await renderAdvancesTable();
    toast('Advance deleted.', 'info');
  } catch (err) { toast(err.message, 'error'); }
}

/* ================================================================
   SALARY REPORT
================================================================ */
async function genReport() {
  const month = v('repMo');
  if (!month) { toast('Select a month first.', 'error'); return; }
  try {
    setBtnLoading('genRepBtn', true);
    const res = await SalaryAPI.report(month);
    renderSalaryReport(res, month);
    toast('Report generated!', 'success');
  } catch (err) { toast(err.message, 'error'); }
  finally { setBtnLoading('genRepBtn', false, '<i class="fas fa-chart-line"></i> Generate'); }
}

function renderSalaryReport(res, month) {
  const [yr, mo] = month.split('-');
  const label = new Date(yr, mo - 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' });
  document.getElementById('repLabel').textContent = label;

  if (!res.data.length) {
    document.getElementById('repContent').innerHTML = emptyState('fa-file-circle-question','No data','No employees or attendance for this month.');
    return;
  }

  const rows = res.data.map(r => `
    <tr>
      <td><div class="emp-name-cell"><div class="emp-avatar">${ini(r.employee.name)}</div>${r.employee.name}</div></td>
      <td><span class="mono sm">${r.employee.empId}</span></td>
      <td><span class="role-tag">${r.employee.role}</span></td>
      <td><span class="mono">${fmt(r.employee.wage)}</span></td>
      <td style="text-align:center"><span class="badge badge-present">${r.presentCount}</span></td>
      <td style="text-align:center"><span class="badge badge-halfday">${r.halfDayCount}</span></td>
      <td style="text-align:center"><span class="badge badge-absent">${r.absentCount}</span></td>
      <td><span class="mono">${fmt(r.baseSalary)}</span></td>
      <td><span class="mono" style="color:var(--red)">${r.advanceTaken > 0 ? '- ' + fmt(r.advanceTaken) : '—'}</span></td>
      <td><span class="mono" style="color:var(--green);font-weight:700">${fmt(r.finalPayable)}</span></td>
    </tr>`).join('');

  document.getElementById('repContent').innerHTML = `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Employee</th><th>ID</th><th>Role</th><th>Daily Wage</th>
            <th>Present</th><th>Half-Day</th><th>Absent</th>
            <th>Base Salary</th><th>Advance</th><th>Final Payable</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
          <tr class="salary-total-row">
            <td colspan="7"><strong>GRAND TOTAL — ${label}</strong></td>
            <td><span class="mono"><strong>${fmt(res.grandTotal)}</strong></span></td>
            <td><span class="mono" style="color:var(--red)"><strong>- ${fmt(res.grandAdvance)}</strong></span></td>
            <td><span class="mono" style="color:var(--green)"><strong>${fmt(res.grandPayable)}</strong></span></td>
          </tr>
        </tbody>
      </table>
    </div>
    <div style="margin-top:14px;font-size:12px;color:var(--text-muted)">
      <i class="fas fa-circle-info"></i>
      &nbsp;Present = full wage · Half-Day = 0.5× wage · Absent/Leave = ₹0 · Final Payable = Base Salary − Advance Taken
    </div>`;
}

/* ================================================================
   DASHBOARD
================================================================ */
async function renderDashboard() {
  try {
    setLoading(true, 'Loading dashboard…');
    const [todayRes] = await Promise.all([AttendanceAPI.today()]);
    const todayLogs  = todayRes.data;

    // Cards
    document.getElementById('cTotalEmp').textContent = employees.length;
    const pToday = todayLogs.filter(a => a.status === 'Present').length;
    document.getElementById('cPresent').textContent = pToday;
    const pctEl = document.getElementById('cPresentPct');
    if (employees.length) {
      const p = Math.round((pToday / employees.length) * 100);
      pctEl.textContent = `${p}% attendance rate`;
      pctEl.className   = `stat-change ${p >= 75 ? 'up' : 'down'}`;
    } else { pctEl.textContent = '—'; pctEl.className = 'stat-change'; }

    // Salary card — fetch current month report
    try {
      const repRes = await SalaryAPI.report(curMo());
      document.getElementById('cSalary').textContent    = fmt(repRes.grandPayable);
      document.getElementById('cAdvance').textContent   = fmt(repRes.grandAdvance);
    } catch { document.getElementById('cSalary').textContent = '—'; }

    // Month label
    const [yr, mo] = curMo().split('-');
    document.getElementById('cSalaryMo').textContent =
      new Date(yr, mo - 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' });

    // Today's log list
    const bc = s => ({Present:'badge-present',Absent:'badge-absent','Half-Day':'badge-halfday',Leave:'badge-leave'})[s]||'';
    const listEl = document.getElementById('todayList');
    document.getElementById('todayBadge').textContent =
      new Date().toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' });

    listEl.innerHTML = todayLogs.length
      ? `<div style="display:flex;flex-direction:column;gap:10px">${todayLogs.map(l => `
          <div class="today-row">
            <div class="emp-name-cell" style="gap:10px">
              <div class="emp-avatar">${ini(l.employee?.name)}</div>
              <div>
                <div style="font-weight:600;font-size:13px">${l.employee?.name||'?'}</div>
                <div style="font-size:11px;color:var(--text-muted)">${l.employee?.role||''}</div>
              </div>
            </div>
            <div style="text-align:right">
              <span class="badge ${bc(l.status)}">${l.status}</span>
              ${l.checkIn ? `<div class="mono sm" style="color:var(--text-muted);margin-top:4px">${l.checkIn} → ${l.checkOut}</div>` : ''}
            </div>
          </div>`).join('')}</div>`
      : emptyState('fa-calendar-xmark','No logs today','Go to "Log Attendance" to record shifts.');

    // Role breakdown bars
    renderRoleBars(todayLogs);
  } catch (err) { toast(err.message, 'error'); }
  finally { setLoading(false); }
}

function renderRoleBars(todayLogs) {
  const barsEl = document.getElementById('attBars');
  if (!employees.length) {
    barsEl.innerHTML = emptyState('fa-users-slash','No employees','Register employees first.');
    return;
  }
  const roles  = [...new Set(employees.map(e => e.role))];
  const colors = ['var(--accent)','var(--green)','var(--amber)','var(--purple)','var(--accent2)','var(--red)'];
  barsEl.innerHTML = roles.map((r, i) => {
    const total   = employees.filter(e => e.role === r).length;
    const present = todayLogs.filter(l => l.employee?.role === r && l.status === 'Present').length;
    const pct     = total ? Math.round((present / total) * 100) : 0;
    return `
      <div class="att-bar-row">
        <div class="att-bar-label">${r.split(' ')[0]}</div>
        <div class="att-bar-track"><div class="att-bar-fill" style="width:${pct}%;background:${colors[i%colors.length]}"></div></div>
        <div class="att-bar-pct">${pct}%</div>
      </div>
      <div style="font-size:11px;color:var(--text-muted);margin-left:92px;margin-top:-6px">${present}/${total} present</div>`;
  }).join('');
}

async function updateCards() {
  try {
    const repRes = await SalaryAPI.report(curMo());
    document.getElementById('cSalary').textContent  = fmt(repRes.grandPayable);
    document.getElementById('cAdvance').textContent = fmt(repRes.grandAdvance);
  } catch { /* silent */ }
  const todayRes = await AttendanceAPI.today();
  const pToday = todayRes.data.filter(a => a.status === 'Present').length;
  document.getElementById('cPresent').textContent = pToday;
  document.getElementById('cTotalEmp').textContent = employees.length;
}

/* ================================================================
   DROPDOWNS
================================================================ */
function fillEmpDrops() {
  const opts = employees.map(e => `<option value="${e._id}">${e.name} (${e.empId})</option>`).join('');
  const all  = `<option value="">All Employees</option>`;
  ['aEmp','advEmp'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = `<option value="">— Select Employee —</option>${opts}`;
  });
  ['filterEmp','filterAdvEmp'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = all + opts;
  });
}

/* ================================================================
   HELPERS
================================================================ */
const v     = id => document.getElementById(id)?.value || '';
const set   = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
const emptyState = (icon, h, p) =>
  `<div class="empty-state"><i class="fas ${icon}"></i><h3>${h}</h3><p>${p}</p></div>`;

function setBtnLoading(id, loading, label) {
  const btn = document.getElementById(id);
  if (!btn) return;
  btn.disabled = loading;
  if (loading) btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Please wait…';
  else if (label) btn.innerHTML = label;
}

/* ================================================================
   INSTALL PROMPT (PWA)
================================================================ */
let deferredPrompt;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredPrompt = e;
  document.getElementById('installBanner')?.classList.add('visible');
});

function installApp() {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  deferredPrompt.userChoice.then(() => {
    deferredPrompt = null;
    document.getElementById('installBanner')?.classList.remove('visible');
  });
}

/* ================================================================
   APP INIT
================================================================ */
async function initApp() {
  // Set topbar date
  document.getElementById('curDate').textContent =
    new Date().toLocaleDateString('en-IN', { weekday:'short', day:'numeric', month:'short', year:'numeric' });

  // Default form values
  set('aDate',    today());
  set('filterMo', curMo());
  set('filterAdvMo', curMo());
  set('advMonth', curMo());
  set('advDate',  today());
  set('repMo',    curMo());

  toggleTime();
  calcHrs();

  setLoading(true, 'Loading employees…');
  await loadEmployees();
  setLoading(false);

  fillEmpDrops();
  renderEmpTable();
  renderDashboard();
}

/* ================================================================
   BOOT
================================================================ */
window.addEventListener('DOMContentLoaded', () => {
  // Service Worker registration (PWA)
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/service-worker.js')
      .then(() => console.log('✅ Service Worker registered'))
      .catch(err => console.warn('SW registration failed:', err));
  }

  // Auto-logout on 401
  window.addEventListener('co:logout', showAuthScreen);

  // Modal close on backdrop click
  document.getElementById('modal')?.addEventListener('click', e => {
    if (e.target === document.getElementById('modal')) closeModal();
  });

  // Check existing session
  if (Auth.isLoggedIn()) {
    showAppShell();
    initApp();
  } else {
    showAuthScreen();
  }
});
