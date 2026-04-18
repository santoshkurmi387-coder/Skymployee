/**
 * frontend/server.js
 * Serves the static PWA files.
 * In production, proxies /api requests to the backend.
 *
 * IMPORTANT: In production deployment (e.g. Vercel),
 * you DON'T need this file — Vercel serves static files natively.
 * This is mainly for self-hosted deployments.
 */

const express = require('express');
const path    = require('path');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app  = express();
const PORT = process.env.PORT || 3000;
const API  = process.env.BACKEND_URL || 'http://localhost:5000';

// Proxy all /api requests to the backend
app.use('/api', createProxyMiddleware({
  target: API,
  changeOrigin: true,
  logLevel: 'warn',
}));

// Serve static files from /public
app.use(express.static(path.join(__dirname, 'public')));

// SPA fallback — always serve index.html for unknown routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🌐 Frontend running at http://localhost:${PORT}`);
  console.log(`🔗 Proxying /api → ${API}`);
});
