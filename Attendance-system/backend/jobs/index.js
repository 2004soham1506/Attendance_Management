const cron = require('node-cron');
const { rebuildAllBuckets }          = require('../services/bucketService');
const { autoCreateFallbackSessions } = require('../services/autoSessionService');
const { runBackup }                  = require('../services/backupService');

function startAllJobs() {
  // ── Auto-session fallback: every minute ────────────────────────────────────
  // Creates a 5-min BLE session for lectures with no active schedule
  cron.schedule('* * * * *', async () => {
    try { await autoCreateFallbackSessions(); }
    catch (e) { console.error('[Cron:AutoSession]', e.message); }
  });

  // ── Bucket cache incremental rebuild: every 15 minutes ────────────────────
  // This is a safety net; individual marks update the bucket in real-time
  cron.schedule('*/15 * * * *', async () => {
    try { await rebuildAllBuckets(); }
    catch (e) { console.error('[Cron:Bucket]', e.message); }
  });

  // ── Nightly backup at 02:00 ────────────────────────────────────────────────
  cron.schedule('0 2 * * *', async () => {
    try { await runBackup(); }
    catch (e) { console.error('[Cron:Backup]', e.message); }
  });

  console.log('[Cron] All jobs started');
}

module.exports = { startAllJobs };