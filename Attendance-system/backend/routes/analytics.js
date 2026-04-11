/**
 * Analytics — lecture is the unit of measurement.
 *
 * A lecture can have MULTIPLE sessions (e.g. BLE check-in at start + QR at end).
 * A student is counted as PRESENT for a lecture only if they appear in
 * ALL sessions of that lecture.
 *
 * Core helper: buildLectureAttendance(sessions, records)
 *   For each lectureUID, intersects the attendee sets across all its sessions.
 */
const express   = require('express');
const Attendance = require('../models/Attendance');
const Session    = require('../models/Session');
const Course     = require('../models/Course');
const Enrollment = require('../models/Enrollment');
const Student    = require('../models/Student');
const Professor  = require('../models/Professor');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// ── Core intersection logic ───────────────────────────────────────────────────
/**
 * For each unique (courseId, lectureUID) pair among the given sessions,
 * computes the SET of students who attended ALL sessions of that lecture.
 *
 * Returns Map< `${courseId}::${lectureUID}` , LectureEntry >
 *   where LectureEntry = { courseId, lectureUID, sessionUIDs[], presentInAll: Set<studentId> }
 */
function buildLectureAttendance(sessions, records) {
  // 1. Group sessions by lecture key
  const lectureMap = new Map();
  for (const s of sessions) {
    const key = `${s.course}::${s.lectureUID}`;
    if (!lectureMap.has(key)) {
      lectureMap.set(key, {
        courseId:    String(s.course),
        lectureUID:  s.lectureUID,
        sessionUIDs: [],
        presentInAll: null, // computed below
      });
    }
    lectureMap.get(key).sessionUIDs.push(s.sessionUID);
  }

  // 2. Index attendance: sessionUID → Set<studentId>
  const sessStudents = new Map();
  for (const r of records) {
    if (!sessStudents.has(r.sessionUID)) sessStudents.set(r.sessionUID, new Set());
    sessStudents.get(r.sessionUID).add(r.student);
  }

  // 3. For each lecture, intersect across all its sessions
  for (const lec of lectureMap.values()) {
    if (lec.sessionUIDs.length === 0) {
      lec.presentInAll = new Set();
      continue;
    }
    // Start from the smallest set (optimisation) — copy so we can mutate
    const sorted = [...lec.sessionUIDs].sort(
      (a, b) => (sessStudents.get(a)?.size || 0) - (sessStudents.get(b)?.size || 0)
    );
    let intersection = new Set(sessStudents.get(sorted[0]) || []);
    for (let i = 1; i < sorted.length; i++) {
      const others = sessStudents.get(sorted[i]) || new Set();
      for (const sid of intersection) {
        if (!others.has(sid)) intersection.delete(sid);
      }
      if (intersection.size === 0) break; // short-circuit
    }
    lec.presentInAll = intersection;
  }

  return lectureMap;
}

// ── Auth helper ───────────────────────────────────────────────────────────────
function canAccessCourse(course, userId, role) {
  if (role === 'admin') return true;
  if (course.instructors.includes(userId)) return true;
  return Array.isArray(course.tas) && course.tas.includes(userId);
}

// ── GET /analytics/course/:courseId ──────────────────────────────────────────
router.get('/course/:courseId', authenticate, async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const course = await Course.findById(courseId).lean();
    if (!course) return res.status(404).json({ error: 'Course not found' });
    if (!canAccessCourse(course, req.user.user_id, req.user.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const [sessions, enrolledCount] = await Promise.all([
      Session.find({ course: courseId }).lean(),
      Enrollment.countDocuments({ course: courseId, status: 'Active' }),
    ]);

    const records    = await Attendance.find({ sessionUID: { $in: sessions.map(s => s.sessionUID) } }).lean();
    const lectureMap = buildLectureAttendance(sessions, records);

    // Index sessions by UID for per-session breakdown
    const sessById = Object.fromEntries(sessions.map(s => [s.sessionUID, s]));

    const lectureStats = course.lectures.map(l => {
      const key = `${courseId}::${l.lectureUID}`;
      const lec = lectureMap.get(key);
      const sessionUIDs = lec?.sessionUIDs || [];
      const attended    = lec?.presentInAll?.size || 0;

      return {
        lectureUID:    l.lectureUID,
        scheduledTime: l.scheduledTime,
        cancelled:     l.cancelled,
        sessionCount:  sessionUIDs.length,
        // Per-session detail (how many raw marks in each session)
        sessions: sessionUIDs.map(suid => ({
          sessionUID:  suid,
          method:      sessById[suid]?.method,
          timestamp:   sessById[suid]?.timestamp,
          markedCount: records.filter(r => r.sessionUID === suid).length,
        })),
        attended,       // students present in ALL sessions
        enrolled:       enrolledCount,
        attendancePct:  enrolledCount > 0
          ? parseFloat(((attended / enrolledCount) * 100).toFixed(1))
          : 0,
      };
    });

    const lecturesHeld  = lectureStats.filter(l => l.sessionCount > 0);
    const totalAttended = lectureStats.reduce((s, l) => s + l.attended, 0);
    const totalPossible = lecturesHeld.length * enrolledCount;

    res.json({
      courseId,
      courseName:    course.name,
      totalLectures: course.lectures.length,
      lecturesHeld:  lecturesHeld.length,
      enrolled:      enrolledCount,
      overallAttendancePct: totalPossible > 0
        ? parseFloat(((totalAttended / totalPossible) * 100).toFixed(1))
        : 0,
      lectureStats,
    });
  } catch (err) { next(err); }
});

// ── GET /analytics/course/:courseId/students ──────────────────────────────────
router.get('/course/:courseId/students', authenticate, async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const course = await Course.findById(courseId).lean();
    if (!course) return res.status(404).json({ error: 'Course not found' });
    if (!canAccessCourse(course, req.user.user_id, req.user.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const [sessions, enrollments] = await Promise.all([
      Session.find({ course: courseId }).lean(),
      Enrollment.find({ course: courseId, status: 'Active' }).lean(),
    ]);

    const studentIds  = enrollments.map(e => e.student);
    const sessionUIDs = sessions.map(s => s.sessionUID);

    const records = await Attendance.find({
      sessionUID: { $in: sessionUIDs },
      student:    { $in: studentIds },
    }).lean();

    const lectureMap    = buildLectureAttendance(sessions, records);
    const totalLectures = lectureMap.size; // lectures that have ≥1 session

    // Per-student: count lectures where they appear in presentInAll
    const studentCount = {};
    for (const lec of lectureMap.values()) {
      for (const sid of lec.presentInAll) {
        studentCount[sid] = (studentCount[sid] || 0) + 1;
      }
    }

    const students = await Student.find({ _id: { $in: studentIds } })
      .select('-password').lean();

    const studentStats = students.map(s => {
      const attended = studentCount[s._id] || 0;
      return {
        student_id:    s._id,
        name:          s.name,
        email:         s.email,
        imageURL:      s.imageURL,
        attended,
        totalLectures,
        attendancePct: totalLectures > 0
          ? parseFloat(((attended / totalLectures) * 100).toFixed(1))
          : 0,
      };
    }).sort((a, b) => b.attended - a.attended);

    res.json({ courseId, totalLectures, enrolled: studentIds.length, studentStats });
  } catch (err) { next(err); }
});

// ── GET /analytics/prof/:profId ───────────────────────────────────────────────
router.get('/prof/:profId', authenticate, async (req, res, next) => {
  try {
    const { profId } = req.params;
    if (req.user.role !== 'admin' && req.user.user_id !== profId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const courses = await Course.find({
      $or: [{ instructors: profId }, { tas: profId }],
    }).lean();

    if (courses.length === 0) return res.json([]);

    const courseIds = courses.map(c => c._id);
    const [sessions, enrollAgg] = await Promise.all([
      Session.find({ course: { $in: courseIds } }).lean(),
      Enrollment.aggregate([
        { $match: { course: { $in: courseIds }, status: 'Active' } },
        { $group: { _id: '$course', count: { $sum: 1 } } },
      ]),
    ]);

    const enrollMap   = Object.fromEntries(enrollAgg.map(e => [String(e._id), e.count]));
    const records     = await Attendance.find({ sessionUID: { $in: sessions.map(s => s.sessionUID) } }).lean();
    const lectureMap  = buildLectureAttendance(sessions, records);

    // Group lecture entries by course
    const lecsByCourse = {};
    for (const lec of lectureMap.values()) {
      if (!lecsByCourse[lec.courseId]) lecsByCourse[lec.courseId] = [];
      lecsByCourse[lec.courseId].push(lec);
    }

    const result = courses.map(c => {
      const cid         = String(c._id);
      const lecs        = lecsByCourse[cid] || [];
      const enrolled    = enrollMap[cid] || 0;
      const totalAtt    = lecs.reduce((s, l) => s + l.presentInAll.size, 0);
      const possible    = lecs.length * enrolled;

      return {
        course_id:    c._id,
        course_name:  c.name,
        slot:         c.slot,
        lectures:     c.lectures.length,          // total scheduled
        sessions:     sessions.filter(s => String(s.course) === cid).length,
        lecturesHeld: lecs.length,                // lectures with ≥1 session
        enrolled,
        attendance:   totalAtt,
        avg:          lecs.length > 0
          ? parseFloat((totalAtt / lecs.length).toFixed(1))
          : 0,
        avg_pct:      possible > 0
          ? parseFloat(((totalAtt / possible) * 100).toFixed(1))
          : 0,
      };
    });

    res.json(result);
  } catch (err) { next(err); }
});

// ── GET /analytics/at-risk/:profId ────────────────────────────────────────────
router.get('/at-risk/:profId', authenticate, async (req, res, next) => {
  try {
    const { profId }  = req.params;
    if (req.user.role !== 'admin' && req.user.user_id !== profId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const THRESHOLD = parseFloat(process.env.AT_RISK_THRESHOLD || '75');

    const courses = await Course.find({
      $or: [{ instructors: profId }, { tas: profId }],
    }).lean();

    if (courses.length === 0) return res.json([]);

    const courseIds = courses.map(c => c._id);
    const courseMap = Object.fromEntries(courses.map(c => [String(c._id), c]));

    const [sessions, enrollments] = await Promise.all([
      Session.find({ course: { $in: courseIds } }).lean(),
      Enrollment.find({ course: { $in: courseIds }, status: 'Active' }).lean(),
    ]);

    const studentIds  = [...new Set(enrollments.map(e => e.student))];
    const records     = await Attendance.find({
      sessionUID: { $in: sessions.map(s => s.sessionUID) },
      student:    { $in: studentIds },
    }).lean();

    const lectureMap = buildLectureAttendance(sessions, records);

    // Group lectures by course
    const lecsByCourse = {};
    for (const lec of lectureMap.values()) {
      if (!lecsByCourse[lec.courseId]) lecsByCourse[lec.courseId] = [];
      lecsByCourse[lec.courseId].push(lec);
    }

    // Build matrix: student → course → count of fully-attended lectures
    const matrix = {};

    // Seed all enrolled students with 0 (so we catch 0%-attendance students too)
    for (const e of enrollments) {
      if (!matrix[e.student]) matrix[e.student] = {};
      if (!matrix[e.student][String(e.course)]) matrix[e.student][String(e.course)] = 0;
    }

    for (const lec of lectureMap.values()) {
      for (const sid of lec.presentInAll) {
        if (!matrix[sid]) matrix[sid] = {};
        matrix[sid][lec.courseId] = (matrix[sid][lec.courseId] || 0) + 1;
      }
    }

    const students = await Student.find({ _id: { $in: studentIds } }).select('-password').lean();
    const sMap     = Object.fromEntries(students.map(s => [s._id, s]));

    const atRisk = [];
    for (const [studentId, courseCounts] of Object.entries(matrix)) {
      for (const [courseId, attended] of Object.entries(courseCounts)) {
        const total = (lecsByCourse[courseId] || []).length;
        if (!total) continue;
        const pct = parseFloat(((attended / total) * 100).toFixed(1));
        if (pct < THRESHOLD) {
          atRisk.push({
            student_id:   studentId,
            student_name: sMap[studentId]?.name || studentId,
            email:        sMap[studentId]?.email,
            course_id:    courseId,
            course_name:  courseMap[courseId]?.name,
            attended,
            total,
            pct,
          });
        }
      }
    }

    res.json(atRisk.sort((a, b) => a.pct - b.pct));
  } catch (err) { next(err); }
});

// ── GET /analytics/admin ──────────────────────────────────────────────────────
router.get('/admin', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const [professors, courses, sessions, studentCount, enrollmentCount] = await Promise.all([
      Professor.find().select('-password').lean(),
      Course.find().lean(),
      Session.find().lean(),
      Student.countDocuments(),
      Enrollment.countDocuments({ status: 'Active' }),
    ]);

    const records    = await Attendance.find({ sessionUID: { $in: sessions.map(s => s.sessionUID) } }).lean();
    const lectureMap = buildLectureAttendance(sessions, records);

    const enrollAgg  = await Enrollment.aggregate([
      { $match: { status: 'Active' } },
      { $group: { _id: '$course', count: { $sum: 1 } } },
    ]);
    const enrollMap  = Object.fromEntries(enrollAgg.map(e => [String(e._id), e.count]));

    const lecsByCourse = {};
    for (const lec of lectureMap.values()) {
      if (!lecsByCourse[lec.courseId]) lecsByCourse[lec.courseId] = [];
      lecsByCourse[lec.courseId].push(lec);
    }

    const profs = professors.map(p => ({
      prof_id:   p._id,
      prof_name: p.name,
      courses: courses
        .filter(c => c.instructors.includes(p._id))
        .map(c => {
          const cid      = String(c._id);
          const lecs     = lecsByCourse[cid] || [];
          const enrolled = enrollMap[cid] || 0;
          const totalAtt = lecs.reduce((s, l) => s + l.presentInAll.size, 0);
          const possible = lecs.length * enrolled;
          return {
            course_id:    c._id,
            name:         c.name,
            sessions:     sessions.filter(s => String(s.course) === cid).length,
            lectures:     c.lectures.length,
            lecturesHeld: lecs.length,
            enrolled,
            avg_pct: possible > 0
              ? parseFloat(((totalAtt / possible) * 100).toFixed(1))
              : 0,
          };
        }),
    }));

    res.json({
      totals: {
        sessions:    sessions.length,
        attendance:  records.length,
        avg:         sessions.length > 0
          ? parseFloat((records.length / sessions.length).toFixed(1))
          : 0,
        students:    studentCount,
        courses:     courses.length,
        profs:       professors.length,
        enrollments: enrollmentCount,
      },
      profs,
    });
  } catch (err) { next(err); }
});

module.exports = router;