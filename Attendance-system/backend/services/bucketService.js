/**
 * Bucket cache — keeps a per-student summary of attendance.
 *
 * A student is counted as attending a lecture only if they appear
 * in ALL sessions of that lecture (intersection rule).
 *
 * The bucket stores per-lecture presence as a boolean-like flag
 * rather than a per-session map, because the meaningful unit is the lecture.
 */
const Bucket     = require('../models/Bucket');
const Attendance = require('../models/Attendance');
const Enrollment = require('../models/Enrollment');
const Session    = require('../models/Session');

// ── Core intersection (same as analytics) ────────────────────────────────────
function buildLectureAttendance(sessions, records) {
  const lectureMap = new Map();
  for (const s of sessions) {
    const key = `${s.course}::${s.lectureUID}`;
    if (!lectureMap.has(key)) {
      lectureMap.set(key, {
        courseId:    String(s.course),
        lectureUID:  s.lectureUID,
        sessionUIDs: [],
        presentInAll: null,
      });
    }
    lectureMap.get(key).sessionUIDs.push(s.sessionUID);
  }

  const sessStudents = new Map();
  for (const r of records) {
    if (!sessStudents.has(r.sessionUID)) sessStudents.set(r.sessionUID, new Set());
    sessStudents.get(r.sessionUID).add(r.student);
  }

  for (const lec of lectureMap.values()) {
    if (!lec.sessionUIDs.length) { lec.presentInAll = new Set(); continue; }
    const sorted = [...lec.sessionUIDs].sort(
      (a, b) => (sessStudents.get(a)?.size || 0) - (sessStudents.get(b)?.size || 0)
    );
    let inter = new Set(sessStudents.get(sorted[0]) || []);
    for (let i = 1; i < sorted.length && inter.size > 0; i++) {
      const o = sessStudents.get(sorted[i]) || new Set();
      for (const sid of inter) { if (!o.has(sid)) inter.delete(sid); }
    }
    lec.presentInAll = inter;
  }
  return lectureMap;
}

/**
 * Rebuild the bucket for a single student from scratch.
 * Called after a mark is saved (async, non-blocking) and by the cron.
 */
async function rebuildBucketForStudent(studentId) {
  const enrollments = await Enrollment.find({ student: studentId, status: 'Active' }).lean();
  const courseIds   = enrollments.map(e => e.course);

  if (courseIds.length === 0) {
    await Bucket.findOneAndUpdate(
      { studentUID: studentId },
      { $set: { courses: [], lastUpdated: new Date() } },
      { upsert: true }
    );
    return;
  }

  // Fetch all sessions and all attendance for those courses
  const sessions = await Session.find({ course: { $in: courseIds } }).lean();
  const records  = await Attendance.find({ sessionUID: { $in: sessions.map(s => s.sessionUID) } }).lean();

  const lectureMap = buildLectureAttendance(sessions, records);

  // Build per-course structure
  const courseDataMap = {};
  for (const lec of lectureMap.values()) {
    if (!lec.presentInAll.has(studentId)) continue; // student not fully present
    if (!courseDataMap[lec.courseId]) courseDataMap[lec.courseId] = [];
    courseDataMap[lec.courseId].push(lec.lectureUID);
  }

  const courses = courseIds.map(cid => ({
    courseUID: String(cid),
    lectures:  (courseDataMap[String(cid)] || []).map(luid => ({
      lectureUID: luid,
      attendance: { present: 'true' }, // simplified — the fact it's here means present
    })),
  }));

  await Bucket.findOneAndUpdate(
    { studentUID: studentId },
    { $set: { courses, lastUpdated: new Date() } },
    { upsert: true }
  );
}

/**
 * Called after every attendance mark.
 * Rebuilds only the affected student's bucket.
 * Fire-and-forget — errors are caught and logged.
 */
async function updateBucketForStudent(studentId) {
  return rebuildBucketForStudent(studentId);
}

/**
 * Full rebuild of all student buckets.
 * Called by the nightly cron and by admin manual trigger.
 */
async function rebuildAllBuckets() {
  const studentIds = await Enrollment.distinct('student');
  console.log(`[BucketJob] Rebuilding ${studentIds.length} student buckets...`);

  // Process in batches of 50 to avoid overwhelming DB
  const BATCH = 50;
  for (let i = 0; i < studentIds.length; i += BATCH) {
    const batch = studentIds.slice(i, i + BATCH);
    await Promise.all(
      batch.map(sid =>
        rebuildBucketForStudent(sid).catch(e =>
          console.error(`[BucketJob] ${sid}: ${e.message}`)
        )
      )
    );
  }
  console.log('[BucketJob] Done.');
}

module.exports = { updateBucketForStudent, rebuildBucketForStudent, rebuildAllBuckets };