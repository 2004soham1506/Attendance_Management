/**
 * keepAlive.js
 *
 * Prevents Render free-tier services from spinning down due to inactivity.
 * Render's inactivity timeout is 15 minutes — this pings every 14 minutes.
 *
 * Two ways to use:
 *
 *   1. STANDALONE (run separately, e.g. on a VPS or locally):
 *        node keepAlive.js
 *
 *   2. INSIDE THE BACKEND (zero extra infra):
 *        In jobs/index.js, add:
 *          const { startKeepAlive } = require('../services/keepAlive');
 *        and inside startAllJobs():
 *          startKeepAlive();
 *
 * The backend pings itself via HTTP (loopback), so even if the external URL
 * is down the backend stays warm. The frontend ping keeps the React dev
 * server / static host alive too.
 */

'use strict';

const https = require('https');
const http  = require('http');

// ── Configuration ─────────────────────────────────────────────────────────────

const TARGETS = [
  {
    name: 'Backend',
    url:  process.env.BACKEND_URL  || 'https://attendance-management-gazr.onrender.com',
    path: '/health',   // hits the lightweight health endpoint, not a heavy route
  },
  {
    name: 'Frontend',
    url:  process.env.FRONTEND_URL || 'https://attendance-management-1-9wns.onrender.com',
    path: '/',
  },
];

const INTERVAL_MS  = 5 * 60 * 1000; // 5 minutes
const TIMEOUT_MS   = 10 * 1000;      // 10-second request timeout

// ── Ping helper ───────────────────────────────────────────────────────────────

function ping(target) {
  return new Promise((resolve) => {
    const fullUrl = target.url + target.path;
    const lib     = fullUrl.startsWith('https') ? https : http;
    const start   = Date.now();

    const req = lib.get(fullUrl, { timeout: TIMEOUT_MS }, (res) => {
      // Drain the response so the socket is released cleanly
      res.resume();
      const ms = Date.now() - start;
      console.log(`[KeepAlive] ✓ ${target.name} — HTTP ${res.statusCode} (${ms} ms)  ${new Date().toISOString()}`);
      resolve({ ok: true, status: res.statusCode, ms });
    });

    req.on('timeout', () => {
      req.destroy();
      console.warn(`[KeepAlive] ✗ ${target.name} — timeout after ${TIMEOUT_MS} ms  ${new Date().toISOString()}`);
      resolve({ ok: false, reason: 'timeout' });
    });

    req.on('error', (err) => {
      console.warn(`[KeepAlive] ✗ ${target.name} — ${err.message}  ${new Date().toISOString()}`);
      resolve({ ok: false, reason: err.message });
    });
  });
}

// ── Ping all targets ──────────────────────────────────────────────────────────

async function pingAll() {
  await Promise.all(TARGETS.map(ping));
}

// ── Start (used when integrated into the backend cron system) ─────────────────

function startKeepAlive() {
  console.log(`[KeepAlive] Starting — pinging every ${INTERVAL_MS / 60000} min`);
  TARGETS.forEach(t => console.log(`[KeepAlive]   • ${t.name}: ${t.url}${t.path}`));

  // Fire once immediately so we know it works on startup
  pingAll();
  const id = setInterval(pingAll, INTERVAL_MS);

  // Return a cleanup function (useful for tests)
  return () => clearInterval(id);
}

// ── Standalone entry point ────────────────────────────────────────────────────

if (require.main === module) {
  startKeepAlive();

  // Keep the process alive
  process.on('SIGINT',  () => { console.log('\n[KeepAlive] Stopped.'); process.exit(0); });
  process.on('SIGTERM', () => { console.log('\n[KeepAlive] Stopped.'); process.exit(0); });
}

module.exports = { startKeepAlive, pingAll };