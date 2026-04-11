const express    = require('express');
const bcrypt     = require('bcryptjs');
const Admin      = require('../models/Admin');
const Professor  = require('../models/Professor');
const Student    = require('../models/Student');
const Course     = require('../models/Course');
const Enrollment = require('../models/Enrollment');
const Session    = require('../models/Session');
const Attendance = require('../models/Attendance');
const Classroom  = require('../models/Classroom');
const Beacon     = require('../models/Beacon');
const { rebuildAllBuckets } = require('../services/bucketService');
const { runBackup }         = require('../services/backupService');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
const A = [authenticate, authorize('admin')];

// ── GET /admin/stats ──────────────────────────────────────────────────────────
router.get('/stats', ...A, async (req, res, next) => {
  try {
    const [students, professors, courses, sessions, enrollments, attendance] = await Promise.all([
      Student.countDocuments(),
      Professor.countDocuments(),
      Course.countDocuments(),
      Session.countDocuments(),
      Enrollment.countDocuments({ status: 'Active' }),
      Attendance.countDocuments(),
    ]);
    const avgAttendance = sessions > 0
      ? parseFloat((attendance / sessions).toFixed(1))
      : 0;
    res.json({ students, professors, courses, sessions, enrollments, attendance, avg_attendance: avgAttendance });
  } catch (err) { next(err); }
});

// ── Professor CRUD ────────────────────────────────────────────────────────────
router.get('/professors', ...A, async (req, res, next) => {
  try {
    const profs = await Professor.find().select('-password').lean();
    res.json(profs.map(p => ({ ...p, id: p._id })));
  } catch (err) { next(err); }
});

router.post('/professors', ...A, async (req, res, next) => {
  try {
    const { _id, name, email, password, department } = req.body;
    if (!_id || !name || !email || !password) {
      return res.status(400).json({ error: '_id, name, email, password required' });
    }
    const hashed = await bcrypt.hash(password, 10);
    const prof   = await Professor.create({ _id, name, email, password: hashed, department });
    const obj    = prof.toObject();
    delete obj.password;
    res.status(201).json({ ...obj, id: obj._id });
  } catch (err) { next(err); }
});

router.delete('/professors/:id', ...A, async (req, res, next) => {
  try {
    await Professor.findByIdAndDelete(req.params.id);
    res.json({ message: 'Professor deleted' });
  } catch (err) { next(err); }
});

// ── Student CRUD ──────────────────────────────────────────────────────────────
router.get('/students', ...A, async (req, res, next) => {
  try {
    const students = await Student.find().select('-password').lean();
    res.json(students.map(s => ({ ...s, id: s._id })));
  } catch (err) { next(err); }
});

router.post('/students', ...A, async (req, res, next) => {
  try {
    const { _id, name, email, password, imageURL } = req.body;
    if (!_id || !name || !email || !password) {
      return res.status(400).json({ error: '_id, name, email, password required' });
    }
    const hashed  = await bcrypt.hash(password, 10);
    const student = await Student.create({
      _id, name, email, password: hashed,
      imageURL: imageURL || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`,
    });
    const obj = student.toObject();
    delete obj.password;
    res.status(201).json({ ...obj, id: obj._id });
  } catch (err) { next(err); }
});

router.delete('/students/:id', ...A, async (req, res, next) => {
  try {
    await Student.findByIdAndDelete(req.params.id);
    res.json({ message: 'Student deleted' });
  } catch (err) { next(err); }
});

// ── All users list (admin panel combined view) ────────────────────────────────
router.get('/users', ...A, async (req, res, next) => {
  try {
    const [admins, profs, students] = await Promise.all([
      Admin.find().select('-password').lean(),
      Professor.find().select('-password').lean(),
      Student.find().select('-password').lean(),
    ]);
    const all = [
      ...admins.map(u => ({ ...u, id: u._id, role: 'admin', name: u._id })),
      ...profs.map(u => ({ ...u, id: u._id, role: 'prof' })),
      ...students.map(u => ({ ...u, id: u._id, role: 'student' })),
    ];
    res.json(all);
  } catch (err) { next(err); }
});

// ── Enrollment management ─────────────────────────────────────────────────────
router.post('/enroll', ...A, async (req, res, next) => {
  try {
    const { student, course } = req.body;
    if (!student || !course) return res.status(400).json({ error: 'student and course required' });
    const enrollment = await Enrollment.findOneAndUpdate(
      { student, course },
      { $set: { status: 'Active', enrollmentDate: new Date() } },
      { upsert: true, new: true }
    );
    res.status(201).json(enrollment);
  } catch (err) { next(err); }
});

// Bulk enroll: { course, student_ids: [] }
router.post('/enroll/bulk', ...A, async (req, res, next) => {
  try {
    const { course, student_ids } = req.body;
    if (!course || !Array.isArray(student_ids)) {
      return res.status(400).json({ error: 'course and student_ids[] required' });
    }
    const ops = student_ids.map(sid => ({
      updateOne: {
        filter: { student: sid, course },
        update: { $set: { status: 'Active', enrollmentDate: new Date() } },
        upsert: true,
      },
    }));
    const result = await Enrollment.bulkWrite(ops);
    res.json({ enrolled: result.upsertedCount + result.modifiedCount });
  } catch (err) { next(err); }
});

router.post('/unenroll', ...A, async (req, res, next) => {
  try {
    const { student, course } = req.body;
    await Enrollment.findOneAndUpdate({ student, course }, { $set: { status: 'Dropped' } });
    res.json({ message: 'Unenrolled' });
  } catch (err) { next(err); }
});

// ── GET /admin/enrollments/:courseId ──────────────────────────────────────────
router.get('/enrollments/:courseId', ...A, async (req, res, next) => {
  try {
    const enrollments = await Enrollment.find({ course: req.params.courseId, status: 'Active' }).lean();
    const studentIds  = enrollments.map(e => e.student);
    const students    = await Student.find({ _id: { $in: studentIds } }).select('-password').lean();
    res.json(students.map(s => ({ ...s, id: s._id })));
  } catch (err) { next(err); }
});

// ── GET /admin/student/:studentId/analytics ───────────────────────────────────
// Per-student analytics across all their courses (same view as prof sees per-student).
router.get('/student/:studentId/analytics', ...A, async (req, res, next) => {
  try {
    const { studentId } = req.params;

    const enrollments = await Enrollment.find({ student: studentId, status: 'Active' }).lean();
    if (enrollments.length === 0) return res.json({ studentId, courses: [] });

    const courseIds = enrollments.map(e => e.course);
    const courses   = await Course.find({ _id: { $in: courseIds } }).lean();

    const sessions = await Session.find({ course: { $in: courseIds } }).lean();
    const sessionUIDs = sessions.map(s => s.sessionUID);

    const records = await Attendance.find({
      sessionUID: { $in: sessionUIDs },
      student:    studentId,
    }).lean();

    const markedSet = new Set(records.map(r => r.sessionUID));

    // Group sessions by course
    const sessByCourse = {};
    for (const s of sessions) {
      if (!sessByCourse[String(s.course)]) sessByCourse[String(s.course)] = [];
      sessByCourse[String(s.course)].push(s);
    }

    const courseStats = courses.map(c => {
      const cs       = sessByCourse[String(c._id)] || [];
      const attended = cs.filter(s => markedSet.has(s.sessionUID)).length;
      return {
        courseId:      c._id,
        courseName:    c.name,
        slot:          c.slot,
        totalLectures: c.lectures.length,
        sessionsHeld:  cs.length,
        attended,
        attendancePct: cs.length > 0
          ? parseFloat(((attended / cs.length) * 100).toFixed(1))
          : 0,
      };
    });

    const student = await Student.findById(studentId).select('-password').lean();
    res.json({ studentId, student, courses: courseStats });
  } catch (err) { next(err); }
});

// ── Classroom management ──────────────────────────────────────────────────────
router.get('/classrooms', authenticate, async (req, res, next) => {
  try { res.json(await Classroom.find().lean()); }
  catch (err) { next(err); }
});

router.post('/classrooms', ...A, async (req, res, next) => {
  try {
    const room = await Classroom.create(req.body);
    res.status(201).json(room);
  } catch (err) { next(err); }
});

// ── Beacon management ─────────────────────────────────────────────────────────
router.get('/beacons', ...A, async (req, res, next) => {
  try { res.json(await Beacon.find().lean()); }
  catch (err) { next(err); }
});

router.post('/beacons', ...A, async (req, res, next) => {
  try {
    const beacon = await Beacon.create(req.body);
    res.status(201).json(beacon);
  } catch (err) { next(err); }
});

// ── Manual maintenance ────────────────────────────────────────────────────────
router.post('/rebuild-buckets', ...A, async (req, res, next) => {
  try {
    res.json({ message: 'Bucket rebuild started' });
    rebuildAllBuckets().catch(console.error);
  } catch (err) { next(err); }
});

router.post('/backup', ...A, async (req, res, next) => {
  try {
    res.json({ message: 'Backup started' });
    runBackup().catch(console.error);
  } catch (err) { next(err); }
});

module.exports = router;