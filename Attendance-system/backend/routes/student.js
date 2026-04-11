const express    = require('express');
const Attendance = require('../models/Attendance');
const Session    = require('../models/Session');
const Enrollment = require('../models/Enrollment');
const Student    = require('../models/Student');
const Bucket     = require('../models/Bucket');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// ── Shared intersection helper (same logic as analytics) ─────────────────────
function buildLectureAttendance(sessions, records) {
  const lectureMap = new Map();
  for (const s of sessions) {
    const key = `${s.course}::${s.lectureUID}`;
    if (!lectureMap.has(key)) {
      lectureMap.set(key, { lectureUID: s.lectureUID, sessionUIDs: [], presentInAll: null });
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

// ── GET /student/:studentId/history/:courseId ─────────────────────────────────
router.get('/:studentId/history/:courseId', authenticate, async (req, res, next) => {
  try {
    const { studentId, courseId } = req.params;
    if (req.user.role === 'student' && req.user.user_id !== studentId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const sessions    = await Session.find({ course: courseId }).sort({ scheduledTime: 1 }).lean();
    const sessionUIDs = sessions.map(s => s.sessionUID);

    const records = await Attendance.find({
      sessionUID: { $in: sessionUIDs },
    }).lean(); // fetch ALL students so intersection works correctly

    const lectureMap = buildLectureAttendance(sessions, records);

    // Build per-lecture history for this student
    // Group sessions by lectureUID for per-session detail
    const sessByLecture = {};
    for (const s of sessions) {
      if (!sessByLecture[s.lectureUID]) sessByLecture[s.lectureUID] = [];
      sessByLecture[s.lectureUID].push(s);
    }

    const lectureUIDs = [...new Set(sessions.map(s => s.lectureUID))];

    const history = lectureUIDs.map(lectureUID => {
      const key      = `${courseId}::${lectureUID}`;
      const lec      = lectureMap.get(key);
      const attended = lec?.presentInAll?.has(studentId) || false;
      const lecSess  = sessByLecture[lectureUID] || [];

      // Per-session: did this student mark in this session?
      const sessionDetail = lecSess.map(s => {
        const rec = records.find(r => r.sessionUID === s.sessionUID && r.student === studentId);
        return {
          sessionUID:  s.sessionUID,
          method:      s.method,
          timestamp:   s.timestamp,
          marked:      !!rec,
          verifiedVia: rec?.verifiedVia || null,
          markedAt:    rec?.markedAt || null,
        };
      });

      return {
        lectureUID,
        scheduledTime: lecSess[0]?.scheduledTime,
        sessionCount:  lecSess.length,
        sessions:      sessionDetail,
        // true only if the student was marked in ALL sessions of this lecture
        attended,
      };
    }).sort((a, b) => new Date(a.scheduledTime) - new Date(b.scheduledTime));

    const attendedCount = history.filter(h => h.attended).length;
    const total         = history.length;

    res.json({
      studentId,
      courseId,
      attended:   attendedCount,
      total,
      percentage: total > 0 ? parseFloat(((attendedCount / total) * 100).toFixed(1)) : 0,
      history,
    });
  } catch (err) { next(err); }
});

// ── GET /student/:studentId/courses ──────────────────────────────────────────
router.get('/:studentId/courses', authenticate, async (req, res, next) => {
  try {
    const { studentId } = req.params;
    if (req.user.role === 'student' && req.user.user_id !== studentId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const enrollments = await Enrollment.find({ student: studentId, status: 'Active' }).lean();
    const courseIds   = enrollments.map(e => e.course);

    const bucket = await Bucket.findOne({ studentUID: studentId }).lean();
    const bucketMap = Object.fromEntries(
      (bucket?.courses || []).map(c => [c.courseUID, c])
    );

    res.json(courseIds.map(cid => ({
      courseId:        cid,
      lecturesAttended: bucketMap[cid]?.lectures?.length || 0,
    })));
  } catch (err) { next(err); }
});

// ── GET /student/:studentId/profile ──────────────────────────────────────────
router.get('/:studentId/profile', authenticate, async (req, res, next) => {
  try {
    const { studentId } = req.params;
    if (req.user.role === 'student' && req.user.user_id !== studentId) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const student = await Student.findById(studentId).select('-password').lean();
    if (!student) return res.status(404).json({ error: 'Student not found' });
    res.json(student);
  } catch (err) { next(err); }
});

module.exports = router;