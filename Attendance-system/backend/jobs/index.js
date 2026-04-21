/**
 * jobs/index.js
 *
 * B4 FIX — backup cron:
 *   Old: '0 2 * * *'  → fires at 02:00 UTC = 07:30 IST (Docker runs UTC)
 *   New: '30 20 * * *' → fires at 20:30 UTC = 02:00 IST ✓
 *
 * keepAlive added — pings both Render services every 14 min so the
 * free-tier 15-min inactivity shutdown never triggers.
 */
const cron                           = require('node-cron');
const { rebuildAllBuckets }          = require('../services/bucketService');
const { autoCreateFallbackSessions } = require('../services/autoSessionService');
const { autoEndExpiredSessions }     = require('../services/autoEndSessionService');
const { runBackup }                  = require('../services/backupService');
const { startKeepAlive }             = require('../services/keepAlive');

function startAllJobs() {
  // ── Auto-session fallback: every minute ────────────────────────────────────
  cron.schedule('* * * * *', async () => {
    try { await autoCreateFallbackSessions(); }
    catch (e) { console.error('[Cron:AutoSession]', e.message); }
  });

  // ── Auto-end expired sessions: every minute ────────────────────────────────
  cron.schedule('* * * * *', async () => {
    try { await autoEndExpiredSessions(); }
    catch (e) { console.error('[Cron:AutoEnd]', e.message); }
  });

  // ── Bucket cache incremental rebuild: every 15 minutes ────────────────────
  cron.schedule('*/15 * * * *', async () => {
    try { await rebuildAllBuckets(); }
    catch (e) { console.error('[Cron:Bucket]', e.message); }
  });

  // ── Nightly backup at 02:00 IST (= 20:30 UTC) ─────────────────────────────
  // node-cron uses the server's local TZ. Docker containers run UTC, so we
  // express the target time in UTC: 20:30 UTC = 02:00 IST.
  cron.schedule('30 20 * * *', async () => {
    try { await runBackup(); }
    catch (e) { console.error('[Cron:Backup]', e.message); }
  });

  // ── Keep Render free-tier services alive (ping every 14 min) ──────────────
  startKeepAlive();

  console.log('[Cron] All jobs started');
}

module.exports = { startAllJobs };