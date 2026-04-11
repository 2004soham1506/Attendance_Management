const express    = require('express');
const Attendance = require('../models/Attendance');
const Session    = require('../models/Session');
const Enrollment = require('../models/Enrollment');
const Student    = require('../models/Student');
const { updateBucketForStudent } = require('../services/bucketService');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// ── Helper: validate session is active ───────────────────────────────────────
async function requireActiveSession(sessionId) {
  const session = await Session.findOne({ sessionUID: sessionId }).lean();
  if (!session) throw Object.assign(new Error('Session not found'), { status: 404 });
  const expiresAt = new Date(session.timestamp.getTime() + session.duration * 60000);
  if (Date.now() > expiresAt) throw Object.assign(new Error('Session has ended'), { status: 410 });
  return session;
}

// ── POST /markAttendance  (student or BLE device) ────────────────────────────
// Body: { session_id, student_id, method }
router.post('/markAttendance', authenticate, async (req, res, next) => {
  try {
    const { session_id, student_id, method } = req.body;
    if (!session_id || !student_id || !method) {
      return res.status(400).json({ error: 'session_id, student_id, method required' });
    }

    // Students can only mark their own attendance
    if (req.user.role === 'student' && req.user.user_id !== student_id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const session = await requireActiveSession(session_id);

    // Verify student is enrolled
    const enrolled = await Enrollment.findOne({ student: student_id, course: session.course, status: 'Active' }).lean();
    if (!enrolled) return res.status(403).json({ error: 'Student not enrolled in this course' });

    const rec = await Attendance.findOneAndUpdate(
      { sessionUID: session_id, student: student_id },
      { $setOnInsert: { sessionUID: session_id, student: student_id, verifiedVia: method, markedAt: new Date() } },
      { upsert: true, new: true }
    );

    // Update bucket cache async
    updateBucketForStudent(student_id, session.course, session.lectureUID, method).catch(console.error);

    res.status(201).json({ message: 'Attendance marked', record: rec });
  } catch (err) { next(err); }
});

// ── POST /manualAttendance  (prof/admin for single student) ──────────────────
router.post('/manualAttendance', authenticate, authorize('prof','admin'), async (req, res, next) => {
  try {
    const { session_id, student_id } = req.body;
    if (!session_id || !student_id) return res.status(400).json({ error: 'session_id and student_id required' });

    // session existence but NOT necessarily active (manual = override)
    const session = await Session.findOne({ sessionUID: session_id }).lean();
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const rec = await Attendance.findOneAndUpdate(
      { sessionUID: session_id, student: student_id },
      { $set: { verifiedVia: 'Manual', markedAt: new Date() } },
      { upsert: true, new: true }
    );

    updateBucketForStudent(student_id, session.course, session.lectureUID, 'Manual').catch(console.error);
    res.json({ message: 'Manual attendance recorded', record: rec });
  } catch (err) { next(err); }
});

// ── POST /manualAttendance/bulk ───────────────────────────────────────────────
// Body: { session_id, student_ids: [] }
router.post('/manualAttendance/bulk', authenticate, authorize('prof','admin'), async (req, res, next) => {
  try {
    const { session_id, student_ids } = req.body;
    if (!session_id || !Array.isArray(student_ids)) {
      return res.status(400).json({ error: 'session_id and student_ids[] required' });
    }

    const session = await Session.findOne({ sessionUID: session_id }).lean();
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const ops = student_ids.map(sid => ({
      updateOne: {
        filter: { sessionUID: session_id, student: sid },
        update: { $set: { verifiedVia: 'Manual', markedAt: new Date() } },
        upsert: true,
      }
    }));
    const result = await Attendance.bulkWrite(ops);

    // Async bucket updates
    for (const sid of student_ids) {
      updateBucketForStudent(sid, session.course, session.lectureUID, 'Manual').catch(console.error);
    }

    res.json({ message: 'Bulk attendance recorded', upserted: result.upsertedCount, modified: result.modifiedCount });
  } catch (err) { next(err); }
});

// ── GET /attendance/:sessionId ────────────────────────────────────────────────
router.get('/attendance/:sessionId', authenticate, async (req, res, next) => {
  try {
    const records = await Attendance.find({ sessionUID: req.params.sessionId }).lean();

    const studentIds = [...new Set(records.map(r => r.student))];
    const students   = await Student.find({ _id: { $in: studentIds } }).select('-password').lean();
    const sMap       = Object.fromEntries(students.map(s => [s._id, s]));

    res.json(records.map(r => ({
      ...r,
      studentName: sMap[r.student]?.name,
      studentEmail: sMap[r.student]?.email,
    })));
  } catch (err) { next(err); }
});

module.exports = router;