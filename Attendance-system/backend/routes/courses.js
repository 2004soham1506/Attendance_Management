const express    = require('express');
const Course     = require('../models/Course');
const Enrollment = require('../models/Enrollment');
const Student    = require('../models/Student');
const { authenticate, authorize, ownsCourse, requireInstructor } = require('../middleware/auth');
const { populateLectures } = require('../utils/lecturePopulator');

const router = express.Router();

// ── GET /courses/:profId ──────────────────────────────────────────────────────
// Prof/TA sees their own courses; admin can pass 'all' or a specific profId.
router.get('/courses/:profId', authenticate, async (req, res, next) => {
  try {
    const { profId } = req.params;
    let query;

    if (req.user.role === 'admin') {
      query = profId === 'all' ? {} : { instructors: profId };
    } else if (req.user.role === 'ta') {
      // TAs see courses where they are a TA
      if (req.user.user_id !== profId) return res.status(403).json({ error: 'Forbidden' });
      query = { tas: profId };
    } else {
      // Prof sees courses they teach
      if (req.user.user_id !== profId) return res.status(403).json({ error: 'Forbidden' });
      query = { instructors: profId };
    }

    const courses = await Course.find(query).lean();
    res.json(courses.map(c => ({ ...c, id: c._id })));
  } catch (err) { next(err); }
});

// ── POST /courses  (admin only) ───────────────────────────────────────────────
router.post('/courses', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const data = req.body;

    // Validate required fields
    const required = ['_id', 'name', 'department', 'slot', 'venue', 'startDate', 'endDate'];
    for (const f of required) {
      if (!data[f]) return res.status(400).json({ error: `${f} is required` });
    }

    const { lectures, schedules } = populateLectures(data);
    const course = new Course({
      ...data,
      lectures,
      schedules: data.schedules?.length ? data.schedules : schedules,
    });
    await course.save();
    res.status(201).json({ ...course.toObject(), id: course._id });
  } catch (err) { next(err); }
});

// ── PUT /courses/:courseId  (admin only - update course metadata) ─────────────
router.put('/courses/:courseId', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const allowed = ['name', 'department', 'venue', 'instructors', 'tas'];
    const update  = {};
    for (const k of allowed) {
      if (req.body[k] !== undefined) update[k] = req.body[k];
    }
    const course = await Course.findByIdAndUpdate(req.params.courseId, { $set: update }, { new: true });
    if (!course) return res.status(404).json({ error: 'Course not found' });
    res.json({ ...course.toObject(), id: course._id });
  } catch (err) { next(err); }
});

// ── GET /course/:courseId/students ────────────────────────────────────────────
router.get('/course/:courseId/students', authenticate, async (req, res, next) => {
  try {
    const enrollments = await Enrollment.find({
      course: req.params.courseId,
      status: 'Active',
    }).lean();

    const studentIds = enrollments.map(e => e.student);
    const students   = await Student.find({ _id: { $in: studentIds } })
      .select('-password').lean();

    res.json(students.map(s => ({ ...s, id: s._id })));
  } catch (err) { next(err); }
});

// ── GET /courses/:courseId/schedules ──────────────────────────────────────────
router.get('/courses/:courseId/schedules', authenticate, async (req, res, next) => {
  try {
    const course = await Course.findById(req.params.courseId).select('schedules').lean();
    if (!course) return res.status(404).json({ error: 'Course not found' });
    res.json(course.schedules || []);
  } catch (err) { next(err); }
});

// ── PUT /courses/:courseId/schedule  (instructor or admin) ────────────────────
// Full replace of the schedules array. Body: { schedules: [...] }
router.put('/courses/:courseId/schedule',
  authenticate,
  ownsCourse,
  requireInstructor,
  async (req, res, next) => {
    try {
      const { schedules } = req.body;
      if (!Array.isArray(schedules)) {
        return res.status(400).json({ error: 'schedules must be an array' });
      }

      const VALID_DAYS    = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
      const VALID_METHODS = ['BLE','QRCode','Manual'];

      for (const s of schedules) {
        if (!VALID_DAYS.includes(s.scheduledDay))  return res.status(400).json({ error: `Invalid day: ${s.scheduledDay}` });
        if (!VALID_METHODS.includes(s.method))     return res.status(400).json({ error: `Invalid method: ${s.method}` });
        if (!/^\d{2}:\d{2}$/.test(s.startTime))   return res.status(400).json({ error: 'startTime must be HH:MM' });
        if (!/^\d{2}:\d{2}$/.test(s.endTime))     return res.status(400).json({ error: 'endTime must be HH:MM' });
      }

      const course = await Course.findByIdAndUpdate(
        req.params.courseId,
        { $set: { schedules } },
        { new: true }
      );
      if (!course) return res.status(404).json({ error: 'Course not found' });
      res.json({ message: 'Schedules updated', schedules: course.schedules });
    } catch (err) { next(err); }
  }
);

// ── POST /courses/:courseId/schedule  (add one schedule entry) ────────────────
router.post('/courses/:courseId/schedule',
  authenticate,
  ownsCourse,
  requireInstructor,
  async (req, res, next) => {
    try {
      const { scheduledDay, startTime, endTime, method, switch: sw } = req.body;
      const VALID_DAYS    = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
      const VALID_METHODS = ['BLE','QRCode','Manual'];

      if (!VALID_DAYS.includes(scheduledDay))  return res.status(400).json({ error: 'Invalid day' });
      if (!VALID_METHODS.includes(method))     return res.status(400).json({ error: 'Invalid method' });
      if (!/^\d{2}:\d{2}$/.test(startTime))   return res.status(400).json({ error: 'startTime must be HH:MM' });
      if (!/^\d{2}:\d{2}$/.test(endTime))     return res.status(400).json({ error: 'endTime must be HH:MM' });

      const newEntry = { scheduledDay, startTime, endTime, method, switch: sw || false };
      const course = await Course.findByIdAndUpdate(
        req.params.courseId,
        { $push: { schedules: newEntry } },
        { new: true }
      );
      if (!course) return res.status(404).json({ error: 'Course not found' });

      // Return the newly added entry (last in array)
      const added = course.schedules[course.schedules.length - 1];
      res.status(201).json({ message: 'Schedule added', schedule: added, schedules: course.schedules });
    } catch (err) { next(err); }
  }
);

// ── PATCH /courses/:courseId/schedule/:index  (toggle switch / change method) ─
router.patch('/courses/:courseId/schedule/:index',
  authenticate,
  ownsCourse,
  requireInstructor,
  async (req, res, next) => {
    try {
      const idx     = parseInt(req.params.index, 10);
      const updates = req.body; // { switch, method, startTime, endTime }

      const course = await Course.findById(req.params.courseId);
      if (!course) return res.status(404).json({ error: 'Course not found' });
      if (!course.schedules[idx]) return res.status(404).json({ error: 'Schedule index not found' });

      Object.assign(course.schedules[idx], updates);
      course.markModified('schedules');
      await course.save();

      res.json({ message: 'Schedule updated', schedule: course.schedules[idx] });
    } catch (err) { next(err); }
  }
);

// ── DELETE /courses/:courseId/schedule/:index ─────────────────────────────────
router.delete('/courses/:courseId/schedule/:index',
  authenticate,
  ownsCourse,
  requireInstructor,
  async (req, res, next) => {
    try {
      const idx    = parseInt(req.params.index, 10);
      const course = await Course.findById(req.params.courseId);
      if (!course) return res.status(404).json({ error: 'Course not found' });
      if (!course.schedules[idx]) return res.status(404).json({ error: 'Schedule index not found' });

      course.schedules.splice(idx, 1);
      course.markModified('schedules');
      await course.save();

      res.json({ message: 'Schedule deleted', schedules: course.schedules });
    } catch (err) { next(err); }
  }
);

// ── PATCH /courses/:courseId/lectures/:lectureUID/cancel ──────────────────────
router.patch('/courses/:courseId/lectures/:lectureUID/cancel',
  authenticate,
  ownsCourse,
  async (req, res, next) => {
    try {
      const result = await Course.updateOne(
        { _id: req.params.courseId, 'lectures.lectureUID': req.params.lectureUID },
        { $set: { 'lectures.$.cancelled': true } }
      );
      if (result.matchedCount === 0) return res.status(404).json({ error: 'Lecture not found' });
      res.json({ message: 'Lecture cancelled' });
    } catch (err) { next(err); }
  }
);

// ── GET /admin/courses  (admin - list all with enrollment counts) ─────────────
router.get('/admin/courses', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const courses = await Course.find().lean();
    const enrollAgg = await Enrollment.aggregate([
      { $match: { status: 'Active' } },
      { $group: { _id: '$course', count: { $sum: 1 } } },
    ]);
    const enrollMap = Object.fromEntries(enrollAgg.map(e => [String(e._id), e.count]));

    res.json(courses.map(c => ({
      ...c,
      id:       c._id,
      enrolled: enrollMap[String(c._id)] || 0,
    })));
  } catch (err) { next(err); }
});

module.exports = router;