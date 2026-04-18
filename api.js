/**
 * js/api.js
 * Centralised API client.
 * All HTTP calls to the backend go through here.
 * Handles: auth headers, error normalisation, token storage.
 */

// ── Config ────────────────────────────────────────────────────────
// In production, replace with your deployed backend URL.
// In development this hits localhost:5000.
const API_BASE = window.location.hostname === 'localhost'
  ? 'http://localhost:5000/api'
  : '/api';   // same-origin if backend is served together

// ── Token management ──────────────────────────────────────────────
const Auth = {
  getToken:   ()    => sessionStorage.getItem('co_token'),
  setToken:   (t)   => sessionStorage.setItem('co_token', t),
  clearToken: ()    => sessionStorage.removeItem('co_token'),
  getUser:    ()    => { try { return JSON.parse(sessionStorage.getItem('co_user')); } catch { return null; } },
  setUser:    (u)   => sessionStorage.setItem('co_user', JSON.stringify(u)),
  clearUser:  ()    => sessionStorage.removeItem('co_user'),
  clear:      ()    => { Auth.clearToken(); Auth.clearUser(); },
  isLoggedIn: ()    => !!Auth.getToken(),
};

// ── Core fetch wrapper ────────────────────────────────────────────
async function request(method, path, body = null) {
  const headers = { 'Content-Type': 'application/json' };
  const token   = Auth.getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const opts = { method, headers };
  if (body && method !== 'GET') opts.body = JSON.stringify(body);

  const res = await fetch(`${API_BASE}${path}`, opts);
  const data = await res.json();

  // Auto-logout on 401 (expired/invalid token)
  if (res.status === 401) {
    Auth.clear();
    window.dispatchEvent(new Event('co:logout'));
    throw new Error(data.message || 'Session expired. Please log in again.');
  }

  if (!data.success) throw new Error(data.message || data.errors?.[0]?.msg || 'Request failed');

  return data;
}

const get    = (path)        => request('GET',    path);
const post   = (path, body)  => request('POST',   path, body);
const put    = (path, body)  => request('PUT',    path, body);
const del    = (path)        => request('DELETE', path);

// ── Auth API ──────────────────────────────────────────────────────
const AuthAPI = {
  sendOTP:   (mobile, name, branchName) => post('/auth/send-otp', { mobile, name, branchName }),
  verifyOTP: (mobile, otp)              => post('/auth/verify-otp', { mobile, otp }),
  getMe:     ()                         => get('/auth/me'),
};

// ── Employees API ─────────────────────────────────────────────────
const EmployeesAPI = {
  list:   ()               => get('/employees'),
  create: (data)           => post('/employees', data),
  update: (id, data)       => put(`/employees/${id}`, data),
  remove: (id)             => del(`/employees/${id}`),
};

// ── Attendance API ────────────────────────────────────────────────
const AttendanceAPI = {
  list:   (params = {})    => get(`/attendance?${new URLSearchParams(params)}`),
  today:  ()               => get('/attendance/today'),
  create: (data)           => post('/attendance', data),
  update: (id, data)       => put(`/attendance/${id}`, data),
  remove: (id)             => del(`/attendance/${id}`),
};

// ── Salary API ────────────────────────────────────────────────────
const SalaryAPI = {
  report:        (month)        => get(`/salary/report?month=${month}`),
  listAdvances:  (params = {})  => get(`/salary/advances?${new URLSearchParams(params)}`),
  addAdvance:    (data)         => post('/salary/advances', data),
  updateAdvance: (id, data)     => put(`/salary/advances/${id}`, data),
  removeAdvance: (id)           => del(`/salary/advances/${id}`),
};
