const fs   = require('fs');
const path = require('path');

const MODELS = [
  require('../models/Admin'),
  require('../models/Professor'),
  require('../models/Student'),
  require('../models/Course'),
  require('../models/Enrollment'),
  require('../models/Session'),
  require('../models/Attendance'),
  require('../models/Beacon'),
  require('../models/Bucket'),
];

const BACKUP_DIR = process.env.BACKUP_DIR || path.join(__dirname, '../backups');

async function runBackup() {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const dir   = path.join(BACKUP_DIR, stamp);
  fs.mkdirSync(dir, { recursive: true });

  for (const Model of MODELS) {
    try {
      const docs = await Model.find({}).lean();
      const file = path.join(dir, `${Model.modelName}.json`);
      fs.writeFileSync(file, JSON.stringify(docs, null, 2));
      console.log(`[Backup] ${Model.modelName}: ${docs.length} docs → ${file}`);
    } catch (e) {
      console.error(`[Backup] Failed ${Model.modelName}: ${e.message}`);
    }
  }

  // Prune: keep only the last 7 backups
  pruneOldBackups(7);

  console.log(`[Backup] Complete: ${stamp}`);
}

function pruneOldBackups(keep) {
  try {
    const dirs = fs.readdirSync(BACKUP_DIR)
      .map(d => ({ name: d, mtime: fs.statSync(path.join(BACKUP_DIR, d)).mtime }))
      .sort((a, b) => b.mtime - a.mtime);

    for (const d of dirs.slice(keep)) {
      fs.rmSync(path.join(BACKUP_DIR, d.name), { recursive: true, force: true });
      console.log(`[Backup] Pruned old backup: ${d.name}`);
    }
  } catch {}
}

module.exports = { runBackup };