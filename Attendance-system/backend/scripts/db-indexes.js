/**
 * db-indexes.js
 *
 * Run once after deployment to ensure all performance-critical indexes exist.
 * Safe to re-run — MongoDB ignores already-existing indexes.
 *
 *   node scripts/db-indexes.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');

async function createIndexes() {
  // await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/attendance');
  await mongoose.connect(process.env.MONGO_URI || 'mongodb+srv://admin:H1nvgEoQ2gul5YDG@cluster0.ksheidh.mongodb.net/attendance=Cluster0');
  const db = mongoose.connection.db;

  console.log('Creating indexes...\n');

  const tasks = [
    // ── Attendance ────────────────────────────────────────────────────────────
    // Core read: "all attendance for a session" (polled every 3s during class)
    { col: 'attendances', idx: { sessionUID: 1 },            opts: { name: 'att_session' } },
    // Core write uniqueness
    { col: 'attendances', idx: { sessionUID: 1, student: 1 }, opts: { name: 'att_session_student', unique: true } },
    // Student history lookups
    { col: 'attendances', idx: { student: 1 },               opts: { name: 'att_student' } },
    // Analytics aggregations: student+session combined
    { col: 'attendances', idx: { student: 1, sessionUID: 1 }, opts: { name: 'att_student_session' } },

    // ── Session ───────────────────────────────────────────────────────────────
    // Active session check (called every 30s by SchedulerContext per course)
    { col: 'sessions', idx: { course: 1, timestamp: -1 },    opts: { name: 'sess_course_ts' } },
    // Used in active-session expiry $expr query
    { col: 'sessions', idx: { course: 1 },                   opts: { name: 'sess_course' } },
    // Lecture lookup
    { col: 'sessions', idx: { course: 1, lectureUID: 1 },    opts: { name: 'sess_course_lecture' } },
    // Session by UID (primary lookup)
    { col: 'sessions', idx: { sessionUID: 1 },               opts: { name: 'sess_uid', unique: true } },

    // ── Enrollment ────────────────────────────────────────────────────────────
    { col: 'enrollments', idx: { student: 1, course: 1 },    opts: { name: 'enr_student_course', unique: true } },
    { col: 'enrollments', idx: { course: 1, status: 1 },     opts: { name: 'enr_course_status' } },
    { col: 'enrollments', idx: { student: 1, status: 1 },    opts: { name: 'enr_student_status' } },

    // ── Course ────────────────────────────────────────────────────────────────
    { col: 'courses', idx: { instructors: 1 },               opts: { name: 'course_instructors' } },
    { col: 'courses', idx: { tas: 1 },                       opts: { name: 'course_tas' } },
    // Lecture scheduled time (used by autoSessionService every minute)
    { col: 'courses', idx: { 'lectures.scheduledTime': 1 },  opts: { name: 'course_lec_time' } },

    // ── Student ───────────────────────────────────────────────────────────────
    { col: 'students', idx: { email: 1 },                    opts: { name: 'student_email', unique: true } },

    // ── Professor ─────────────────────────────────────────────────────────────
    { col: 'professors', idx: { email: 1 },                  opts: { name: 'prof_email', unique: true } },

    // ── Bucket ────────────────────────────────────────────────────────────────
    { col: 'buckets', idx: { studentUID: 1 },                opts: { name: 'bucket_student', unique: true } },
    { col: 'buckets', idx: { lastUpdated: -1 },              opts: { name: 'bucket_updated' } },

    // ── Beacon ────────────────────────────────────────────────────────────────
    { col: 'beacons', idx: { bleID: 1 },                     opts: { name: 'beacon_bleid', unique: true } },
    { col: 'beacons', idx: { classroom: 1 },                 opts: { name: 'beacon_classroom' } },
  ];

  for (const { col, idx, opts } of tasks) {
    try {
      await db.collection(col).createIndex(idx, { background: true, ...opts });
      console.log(`  ✓ ${col} [${Object.keys(idx).join(', ')}]`);
    } catch (e) {
      if (e.code === 85 || e.code === 86) {
        console.log(`  ~ ${col} [${Object.keys(idx).join(', ')}] — already exists (skipped)`);
      } else {
        console.error(`  ✗ ${col}: ${e.message}`);
      }
    }
  }

  console.log('\nDone.');
  await mongoose.disconnect();
}

createIndexes().catch(e => { console.error(e); process.exit(1); });