// const express    = require('express');
// const bcrypt     = require('bcryptjs');
// const multer     = require('multer');
// const csv        = require('csv-parse/sync');
// const Admin      = require('../models/Admin');
// const Professor  = require('../models/Professor');
// const Student    = require('../models/Student');
// const Course     = require('../models/Course');
// const Enrollment = require('../models/Enrollment');
// const Session    = require('../models/Session');
// const Attendance = require('../models/Attendance');
// const Classroom  = require('../models/Classroom');
// const Beacon     = require('../models/Beacon');
// const Bucket     = require('../models/Bucket');
// const { rebuildAllBuckets } = require('../services/bucketService');
// const { runBackup }         = require('../services/backupService');
// const { authenticate, authorize } = require('../middleware/auth');
// const { populateLectures }  = require('../utils/lecturePopulator');

// const router  = express.Router();
// const A       = [authenticate, authorize('admin')];
// const upload  = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// // ── GET /admin/stats ──────────────────────────────────────────────────────────
// // FIX: sessions = CURRENTLY ACTIVE sessions (not all-time total)
// router.get('/stats', ...A, async (req, res, next) => {
//   try {
//     const [students, professors, courses, activeSessions, totalSessions, enrollments, attendance] = await Promise.all([
//       Student.countDocuments(),
//       Professor.countDocuments(),
//       Course.countDocuments(),
//       Session.countDocuments({ active: true }),  // currently running
//       Session.countDocuments(),                   // all time
//       Enrollment.countDocuments({ status: 'Active' }),
//       Attendance.countDocuments(),
//     ]);
//     const avg_attendance = totalSessions > 0
//       ? parseFloat((attendance / totalSessions).toFixed(1))
//       : 0;
//     res.json({
//       students, professors, courses,
//       sessions:       activeSessions,  // what the "Active Sessions" card shows
//       totalSessions,
//       enrollments, attendance, avg_attendance,
//     });
//   } catch (err) { next(err); }
// });

// // ── GET /admin/users  (FIX: return consistent shape with role) ─────────────────
// // Previously had a bug where TA-check used $not: {$size:0} which fails if tas
// // field is missing. Use $exists + $not with size 0 correctly, or just fetch all.
// router.get('/users', ...A, async (req, res, next) => {
//   try {
//     const [admins, profs, students, taCourses] = await Promise.all([
//       Admin.find().select('-password').lean(),
//       Professor.find().select('-password').lean(),
//       Student.find().select('-password').lean(),
//       Course.find({ 'tas.0': { $exists: true } }).select('tas').lean(), // courses with ≥1 TA
//     ]);

//     const taSet = new Set(taCourses.flatMap(c => c.tas || []));

//     const all = [
//       ...admins.map(u => ({ ...u, id: u._id, name: u.name || u._id, role: 'admin' })),
//       ...profs.map(u => ({ ...u, id: u._id, role: 'prof' })),
//       ...students.map(u => ({ ...u, id: u._id, role: taSet.has(u._id) ? 'ta' : 'student' })),
//     ];
//     res.json(all);
//   } catch (err) { next(err); }
// });

// // ── GET /admin/courses  (FIX: return consistent shape with id field) ───────────
// router.get('/courses', ...A, async (req, res, next) => {
//   try {
//     const [courses, enrollAgg] = await Promise.all([
//       Course.find().lean(),
//       Enrollment.aggregate([
//         { $match: { status: 'Active' } },
//         { $group: { _id: '$course', count: { $sum: 1 } } },
//       ]),
//     ]);
//     const enrollMap = Object.fromEntries(enrollAgg.map(e => [String(e._id), e.count]));

//     // Return both _id and id so frontend works regardless of which field it reads
//     res.json(courses.map(c => ({
//       ...c,
//       id:       c._id,        // ← frontend reads c.id or c._id
//       enrolled: enrollMap[String(c._id)] || 0,
//     })));
//   } catch (err) { next(err); }
// });

// // ── Professor CRUD ────────────────────────────────────────────────────────────
// router.get('/professors', ...A, async (req, res, next) => {
//   try {
//     res.json((await Professor.find().select('-password').lean()).map(p => ({ ...p, id: p._id })));
//   } catch (err) { next(err); }
// });

// router.post('/professors', ...A, async (req, res, next) => {
//   try {
//     const { _id, name, email, password, department } = req.body;
//     if (!_id || !name || !email || !password) {
//       return res.status(400).json({ error: '_id, name, email, password required' });
//     }
//     const hashed = await bcrypt.hash(password, 10);
//     const prof   = await Professor.create({ _id, name, email, password: hashed, department });
//     const obj    = prof.toObject(); delete obj.password;
//     res.status(201).json({ ...obj, id: obj._id });
//   } catch (err) { next(err); }
// });

// router.delete('/professors/:id', ...A, async (req, res, next) => {
//   try {
//     await Professor.findByIdAndDelete(req.params.id);
//     res.json({ message: 'Professor deleted' });
//   } catch (err) { next(err); }
// });

// // ── Student CRUD ──────────────────────────────────────────────────────────────
// router.get('/students', ...A, async (req, res, next) => {
//   try {
//     res.json((await Student.find().select('-password').lean()).map(s => ({ ...s, id: s._id })));
//   } catch (err) { next(err); }
// });

// router.post('/students', ...A, async (req, res, next) => {
//   try {
//     const { _id, name, email, password, imageURL } = req.body;
//     if (!_id || !name || !email || !password) {
//       return res.status(400).json({ error: '_id, name, email, password required' });
//     }
//     const hashed  = await bcrypt.hash(password, 10);
//     const student = await Student.create({
//       _id, name, email, password: hashed,
//       imageURL: imageURL ||
//         `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`,
//     });
//     const obj = student.toObject(); delete obj.password;
//     res.status(201).json({ ...obj, id: obj._id });
//   } catch (err) { next(err); }
// });

// router.delete('/students/:id', ...A, async (req, res, next) => {
//   try {
//     await Student.findByIdAndDelete(req.params.id);
//     res.json({ message: 'Student deleted' });
//   } catch (err) { next(err); }
// });

// // ── TA management ─────────────────────────────────────────────────────────────
// router.post('/courses/:courseId/tas', ...A, async (req, res, next) => {
//   try {
//     const { student_id } = req.body;
//     if (!student_id) return res.status(400).json({ error: 'student_id required' });
//     const student = await Student.findById(student_id).lean();
//     if (!student) return res.status(404).json({ error: 'Student not found' });
//     const course = await Course.findByIdAndUpdate(
//       req.params.courseId,
//       { $addToSet: { tas: student_id } },
//       { new: true }
//     );
//     if (!course) return res.status(404).json({ error: 'Course not found' });
//     res.json({ message: 'TA added', tas: course.tas });
//   } catch (err) { next(err); }
// });

// router.delete('/courses/:courseId/tas/:studentId', ...A, async (req, res, next) => {
//   try {
//     const course = await Course.findByIdAndUpdate(
//       req.params.courseId,
//       { $pull: { tas: req.params.studentId } },
//       { new: true }
//     );
//     if (!course) return res.status(404).json({ error: 'Course not found' });
//     res.json({ message: 'TA removed', tas: course.tas });
//   } catch (err) { next(err); }
// });

// // ── Enrollment management ─────────────────────────────────────────────────────
// router.post('/enroll', ...A, async (req, res, next) => {
//   try {
//     const { student, course } = req.body;
//     if (!student || !course) return res.status(400).json({ error: 'student and course required' });
//     const enrollment = await Enrollment.findOneAndUpdate(
//       { student, course },
//       { $set: { status: 'Active', enrollmentDate: new Date() } },
//       { upsert: true, new: true }
//     );
//     res.status(201).json(enrollment);
//   } catch (err) { next(err); }
// });

// router.post('/enroll/bulk', ...A, async (req, res, next) => {
//   try {
//     const { course, student_ids } = req.body;
//     if (!course || !Array.isArray(student_ids)) {
//       return res.status(400).json({ error: 'course and student_ids[] required' });
//     }
//     const ops = student_ids.map(sid => ({
//       updateOne: {
//         filter: { student: sid, course },
//         update: { $set: { status: 'Active', enrollmentDate: new Date() } },
//         upsert: true,
//       },
//     }));
//     const result = await Enrollment.bulkWrite(ops);
//     res.json({ enrolled: result.upsertedCount + result.modifiedCount });
//   } catch (err) { next(err); }
// });

// router.post('/unenroll', ...A, async (req, res, next) => {
//   try {
//     const { student, course } = req.body;
//     await Enrollment.findOneAndUpdate({ student, course }, { $set: { status: 'Dropped' } });
//     res.json({ message: 'Unenrolled' });
//   } catch (err) { next(err); }
// });

// router.get('/enrollments/:courseId', ...A, async (req, res, next) => {
//   try {
//     const enrollments = await Enrollment.find({ course: req.params.courseId, status: 'Active' }).lean();
//     const students    = await Student.find({ _id: { $in: enrollments.map(e => e.student) } })
//       .select('-password').lean();
//     res.json(students.map(s => ({ ...s, id: s._id })));
//   } catch (err) { next(err); }
// });

// // ── GET /admin/student/:id/analytics (bucket-backed) ─────────────────────────
// router.get('/student/:studentId/analytics', ...A, async (req, res, next) => {
//   try {
//     const { studentId } = req.params;
//     const bucket = await Bucket.findOne({ studentUID: studentId }).lean();
//     const enrollments = await Enrollment.find({ student: studentId, status: 'Active' }).lean();
//     if (enrollments.length === 0) return res.json({ studentId, courses: [], cached: false });

//     const courseIds = enrollments.map(e => e.course);
//     const courses   = await Course.find({ _id: { $in: courseIds } }).lean();

//     if (bucket?.courses?.length > 0) {
//       const bucketMap = Object.fromEntries(bucket.courses.map(c => [c.courseUID, c]));
//       const courseStats = courses.map(c => {
//         const bc       = bucketMap[String(c._id)];
//         const attended = bc?.lectures?.length || 0;
//         const total    = c.lectures?.length || 0;
//         return {
//           courseId:      c._id,
//           courseName:    c.name,
//           slot:          c.slot,
//           totalLectures: total,
//           sessionsHeld:  attended,
//           attended,
//           attendancePct: total > 0 ? parseFloat(((attended / total) * 100).toFixed(1)) : 0,
//           fromCache:     true,
//         };
//       });
//       const student = await Student.findById(studentId).select('-password').lean();
//       return res.json({ studentId, student, courses: courseStats, cached: true });
//     }

//     // Live fallback
//     const sessions    = await Session.find({ course: { $in: courseIds } }).lean();
//     const sessionUIDs = sessions.map(s => s.sessionUID);
//     const records     = await Attendance.find({ sessionUID: { $in: sessionUIDs }, student: studentId }).lean();
//     const markedSet   = new Set(records.map(r => r.sessionUID));
//     const sessByCourse = {};
//     for (const s of sessions) {
//       if (!sessByCourse[String(s.course)]) sessByCourse[String(s.course)] = [];
//       sessByCourse[String(s.course)].push(s);
//     }
//     const courseStats = courses.map(c => {
//       const cs       = sessByCourse[String(c._id)] || [];
//       const attended = cs.filter(s => markedSet.has(s.sessionUID)).length;
//       return {
//         courseId: c._id, courseName: c.name, slot: c.slot,
//         totalLectures: c.lectures?.length || 0,
//         sessionsHeld: cs.length,
//         attended,
//         attendancePct: cs.length > 0 ? parseFloat(((attended / cs.length) * 100).toFixed(1)) : 0,
//         fromCache: false,
//       };
//     });
//     const student = await Student.findById(studentId).select('-password').lean();
//     res.json({ studentId, student, courses: courseStats, cached: false });
//   } catch (err) { next(err); }
// });

// // ── Classroom / Beacon management ─────────────────────────────────────────────
// router.get('/classrooms', authenticate, async (req, res, next) => {
//   try { res.json(await Classroom.find().lean()); } catch (err) { next(err); }
// });
// router.post('/classrooms', ...A, async (req, res, next) => {
//   try { res.status(201).json(await Classroom.create(req.body)); } catch (err) { next(err); }
// });
// router.get('/beacons', ...A, async (req, res, next) => {
//   try { res.json(await Beacon.find().lean()); } catch (err) { next(err); }
// });
// router.post('/beacons', ...A, async (req, res, next) => {
//   try { res.status(201).json(await Beacon.create(req.body)); } catch (err) { next(err); }
// });

// // ── CSV bulk operations ───────────────────────────────────────────────────────
// router.post('/csv/bulk-create', ...A, upload.single('file'), async (req, res, next) => {
//   try {
//     if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
//     const type = req.body.type;
//     const rows = csv.parse(req.file.buffer.toString(), { columns: true, skip_empty_lines: true });
//     let created = 0, skipped = 0;
//     const errors = [];
//     for (const row of rows) {
//       try {
//         if (type === 'students') {
//           const hashed = await bcrypt.hash(row.password || 'changeme', 10);
//           await Student.findOneAndUpdate({ _id: row._id },
//             { ...row, password: hashed, imageURL: row.imageURL || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(row.name)}` },
//             { upsert: true });
//           created++;
//         } else if (type === 'professors') {
//           const hashed = await bcrypt.hash(row.password || 'changeme', 10);
//           await Professor.findOneAndUpdate({ _id: row._id }, { ...row, password: hashed }, { upsert: true });
//           created++;
//         } else if (type === 'courses') {
//           const instructors = row.instructors ? row.instructors.split(',').map(s=>s.trim()).filter(Boolean) : [];
//           const tas         = row.tas         ? row.tas.split(',').map(s=>s.trim()).filter(Boolean)         : [];
//           const data        = { ...row, instructors, tas };
//           const { lectures, schedules } = populateLectures(data);
//           await Course.findOneAndUpdate({ _id: row._id }, { ...data, lectures, schedules }, { upsert: true });
//           created++;
//         } else if (type === 'enrollments') {
//           await Enrollment.findOneAndUpdate(
//             { student: row.student, course: row.course },
//             { $set: { status: 'Active' } },
//             { upsert: true }
//           );
//           created++;
//         }
//       } catch (e) {
//         skipped++;
//         errors.push(`${row._id || JSON.stringify(row)}: ${e.message}`);
//       }
//     }
//     res.json({ created, skipped, errors: errors.slice(0, 10) });
//   } catch (err) { next(err); }
// });

// router.post('/csv/bulk-delete', ...A, upload.single('file'), async (req, res, next) => {
//   try {
//     if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
//     const type = req.body.type;
//     const rows = csv.parse(req.file.buffer.toString(), { columns: true, skip_empty_lines: true });
//     let deleted = 0;
//     const errors = [];
//     const ModelMap = { students: Student, professors: Professor, courses: Course };
//     for (const row of rows) {
//       try {
//         if (type === 'enrollments') {
//           await Enrollment.findOneAndUpdate({ student: row.student, course: row.course }, { $set: { status: 'Dropped' } });
//           deleted++;
//         } else if (ModelMap[type]) {
//           await ModelMap[type].findByIdAndDelete(row._id);
//           deleted++;
//         }
//       } catch (e) { errors.push(`${row._id}: ${e.message}`); }
//     }
//     res.json({ deleted, errors: errors.slice(0, 10) });
//   } catch (err) { next(err); }
// });

// // ── Manual maintenance ────────────────────────────────────────────────────────
// router.post('/rebuild-buckets', ...A, async (req, res, next) => {
//   try {
//     res.json({ message: 'Bucket rebuild started' });
//     rebuildAllBuckets().catch(console.error);
//   } catch (err) { next(err); }
// });
// router.post('/backup', ...A, async (req, res, next) => {
//   try {
//     res.json({ message: 'Backup started' });
//     runBackup().catch(console.error);
//   } catch (err) { next(err); }
// });

// router.get('/courses/:courseId/analytics', ...A, async (req, res, next) => {
//   try {
//     const { courseId } = req.params;
//     const course = await Course.findById(courseId).lean();
//     if (!course) return res.status(404).json({ error: 'Course not found' });

//     const [sessions, enrollments] = await Promise.all([
//       Session.find({ course: courseId }).lean(),
//       Enrollment.find({ course: courseId, status: 'Active' }).lean(),
//     ]);

//     const studentIds  = enrollments.map(e => e.student);
//     const sessionUIDs = sessions.map(s => s.sessionUID);

//     const records = await Attendance.find({
//       sessionUID: { $in: sessionUIDs },
//       student:    { $in: studentIds },
//     }).lean();

//     // Lecture-intersection logic (same as analytics routes)
//     const lectureMap  = new Map();
//     for (const s of sessions) {
//       const key = `${s.course}::${s.lectureUID}`;
//       if (!lectureMap.has(key)) {
//         lectureMap.set(key, { lectureUID: s.lectureUID, sessionUIDs: [], presentInAll: null });
//       }
//       lectureMap.get(key).sessionUIDs.push(s.sessionUID);
//     }
//     const sessStudents = new Map();
//     for (const r of records) {
//       if (!sessStudents.has(r.sessionUID)) sessStudents.set(r.sessionUID, new Set());
//       sessStudents.get(r.sessionUID).add(String(r.student));
//     }
//     for (const lec of lectureMap.values()) {
//       if (!lec.sessionUIDs.length) { lec.presentInAll = new Set(); continue; }
//       const sorted = [...lec.sessionUIDs].sort(
//         (a, b) => (sessStudents.get(a)?.size || 0) - (sessStudents.get(b)?.size || 0)
//       );
//       let inter = new Set(sessStudents.get(sorted[0]) || []);
//       for (let i = 1; i < sorted.length && inter.size > 0; i++) {
//         const o = sessStudents.get(sorted[i]) || new Set();
//         for (const sid of inter) { if (!o.has(sid)) inter.delete(sid); }
//       }
//       lec.presentInAll = inter;
//     }

//     const totalLectures = lectureMap.size;
//     const studentCount  = {};
//     for (const lec of lectureMap.values()) {
//       for (const sid of lec.presentInAll) {
//         studentCount[sid] = (studentCount[sid] || 0) + 1;
//       }
//     }

//     const students = await Student.find({ _id: { $in: studentIds } })
//       .select('-password').lean();

//     const taSet = new Set((course.tas || []).map(String));

//     const studentStats = students.map(s => {
//       const sid      = String(s._id);
//       const attended = studentCount[sid] || 0;
//       return {
//         student_id:    s._id,
//         name:          s.name,
//         email:         s.email,
//         imageURL:      s.imageURL,
//         attended,
//         totalLectures,
//         attendancePct: totalLectures > 0
//           ? parseFloat(((attended / totalLectures) * 100).toFixed(1))
//           : 0,
//         isTA: taSet.has(sid),
//       };
//     }).sort((a, b) => b.attendancePct - a.attendancePct);

//     res.json({
//       courseId,
//       courseName:   course.name,
//       slot:         course.slot,
//       venue:        course.venue,
//       department:   course.department,
//       instructors:  course.instructors,
//       tas:          course.tas,
//       totalLectures,
//       enrolled:     studentIds.length,
//       studentStats,
//     });
//   } catch (err) { next(err); }
// });

// // ── POST /admin/csv/bulk-create ───────────────────────────────────────────────
// // FormData: file (CSV), type (students|professors|courses|enrollments)
// router.post('/csv/bulk-create', ...A, upload.single('file'), async (req, res, next) => {
//   try {
//     if (!req.file) return res.status(400).json({ error: 'CSV file required' });
//     const type = req.body.type;
//     const VALID = ['students','professors','courses','enrollments'];
//     if (!VALID.includes(type)) {
//       return res.status(400).json({ error: `type must be one of: ${VALID.join(', ')}` });
//     }

//     const rows = csv.parse(req.file.buffer.toString('utf8'), {
//       columns: true, skip_empty_lines: true, trim: true,
//     });

//     let created = 0, skipped = 0;
//     const errors = [];

//     for (const row of rows) {
//       try {
//         if (type === 'students') {
//           if (!row._id || !row.name || !row.email || !row.password) {
//             errors.push(`Row missing required fields: ${JSON.stringify(row)}`); skipped++; continue;
//           }
//           const hashed = await bcrypt.hash(row.password, 10);
//           await Student.create({
//             _id:      row._id,
//             name:     row.name,
//             email:    row.email,
//             password: hashed,
//             imageURL: row.imageURL ||
//               `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(row.name)}`,
//           });
//           created++;

//         } else if (type === 'professors') {
//           if (!row._id || !row.name || !row.email || !row.password) {
//             errors.push(`Row missing required fields: ${JSON.stringify(row)}`); skipped++; continue;
//           }
//           const hashed = await bcrypt.hash(row.password, 10);
//           await Professor.create({
//             _id:        row._id,
//             name:       row.name,
//             email:      row.email,
//             password:   hashed,
//             department: row.department || null,
//           });
//           created++;

//         } else if (type === 'courses') {
//           if (!row._id || !row.name || !row.department || !row.slot || !row.venue || !row.startDate || !row.endDate) {
//             errors.push(`Row missing required fields: ${JSON.stringify(row)}`); skipped++; continue;
//           }
//           const { populateLectures: pl } = require('../utils/lecturePopulator');
//           const instructors = row.instructors ? row.instructors.split(',').map(s => s.trim()).filter(Boolean) : [];
//           const tas         = row.tas         ? row.tas.split(',').map(s => s.trim()).filter(Boolean)         : [];
//           const data = {
//             _id: row._id, name: row.name, department: row.department,
//             slot: row.slot, venue: row.venue,
//             startDate: new Date(row.startDate), endDate: new Date(row.endDate),
//             instructors, tas,
//           };
//           const { lectures, schedules } = pl(data);
//           await Course.create({ ...data, lectures, schedules });
//           created++;

//         } else if (type === 'enrollments') {
//           if (!row.student || !row.course) {
//             errors.push(`Row missing student or course: ${JSON.stringify(row)}`); skipped++; continue;
//           }
//           await Enrollment.findOneAndUpdate(
//             { student: row.student, course: row.course },
//             { $set: { status: 'Active', enrollmentDate: new Date() } },
//             { upsert: true }
//           );
//           created++;
//         }
//       } catch (e) {
//         if (e.code === 11000) { skipped++; }
//         else { errors.push(e.message); skipped++; }
//       }
//     }

//     res.json({ created, skipped, errors: errors.slice(0, 20) });
//   } catch (err) { next(err); }
// });

// // ── POST /admin/csv/bulk-delete ───────────────────────────────────────────────
// // FormData: file (CSV with _id column), type (students|professors|courses|enrollments)
// router.post('/csv/bulk-delete', ...A, upload.single('file'), async (req, res, next) => {
//   try {
//     if (!req.file) return res.status(400).json({ error: 'CSV file required' });
//     const type = req.body.type;
//     const VALID = ['students','professors','courses','enrollments'];
//     if (!VALID.includes(type)) {
//       return res.status(400).json({ error: `type must be one of: ${VALID.join(', ')}` });
//     }

//     const rows = csv.parse(req.file.buffer.toString('utf8'), {
//       columns: true, skip_empty_lines: true, trim: true,
//     });

//     let deleted = 0;
//     const errors = [];

//     for (const row of rows) {
//       try {
//         if (type === 'enrollments') {
//           if (!row.student || !row.course) {
//             errors.push(`Missing student/course: ${JSON.stringify(row)}`); continue;
//           }
//           const r = await Enrollment.deleteOne({ student: row.student, course: row.course });
//           if (r.deletedCount) deleted++;
//         } else {
//           const id = row._id;
//           if (!id) { errors.push(`Missing _id in row: ${JSON.stringify(row)}`); continue; }
//           let r;
//           if (type === 'students')   r = await Student.deleteOne({ _id: id });
//           if (type === 'professors') r = await Professor.deleteOne({ _id: id });
//           if (type === 'courses')    r = await Course.deleteOne({ _id: id });
//           if (r?.deletedCount) deleted++;
//         }
//       } catch (e) { errors.push(e.message); }
//     }

//     res.json({ deleted, errors: errors.slice(0, 20) });
//   } catch (err) { next(err); }
// });

// module.exports = router;

const express    = require('express');
const bcrypt     = require('bcryptjs');
const multer     = require('multer');
const csv        = require('csv-parse/sync');
const Admin      = require('../models/Admin');
const Professor  = require('../models/Professor');
const Student    = require('../models/Student');
const Course     = require('../models/Course');
const Enrollment = require('../models/Enrollment');
const Session    = require('../models/Session');
const Attendance = require('../models/Attendance');
const Classroom  = require('../models/Classroom');
const Beacon     = require('../models/Beacon');
const Bucket     = require('../models/Bucket');
const { rebuildAllBuckets } = require('../services/bucketService');
const { runBackup }         = require('../services/backupService');
const { authenticate, authorize } = require('../middleware/auth');
const { populateLectures }  = require('../utils/lecturePopulator');

const router  = express.Router();
const A       = [authenticate, authorize('admin')];
const upload  = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// ── GET /admin/stats ──────────────────────────────────────────────────────────
router.get('/stats', ...A, async (req, res, next) => {
  try {
    const [students, professors, courses, activeSessions, totalSessions, enrollments, attendance] = await Promise.all([
      Student.countDocuments(),
      Professor.countDocuments(),
      Course.countDocuments(),
      Session.countDocuments({ active: true }),
      Session.countDocuments(),
      Enrollment.countDocuments({ status: 'Active' }),
      Attendance.countDocuments(),
    ]);
    const avg_attendance = totalSessions > 0
      ? parseFloat((attendance / totalSessions).toFixed(1))
      : 0;
    res.json({
      students, professors, courses,
      sessions:       activeSessions,
      totalSessions,
      enrollments, attendance, avg_attendance,
    });
  } catch (err) { next(err); }
});

// ── GET /admin/users ──────────────────────────────────────────────────────────
router.get('/users', ...A, async (req, res, next) => {
  try {
    const [admins, profs, students, taCourses] = await Promise.all([
      Admin.find().select('-password').lean(),
      Professor.find().select('-password').lean(),
      Student.find().select('-password').lean(),
      Course.find({ 'tas.0': { $exists: true } }).select('tas').lean(),
    ]);

    const taSet = new Set(taCourses.flatMap(c => c.tas || []));

    const all = [
      ...admins.map(u => ({ ...u, id: u._id, name: u.name || u._id, role: 'admin' })),
      ...profs.map(u => ({ ...u, id: u._id, role: 'prof' })),
      ...students.map(u => ({ ...u, id: u._id, role: taSet.has(u._id) ? 'ta' : 'student' })),
    ];
    res.json(all);
  } catch (err) { next(err); }
});

// ── GET /admin/courses ────────────────────────────────────────────────────────
router.get('/courses', ...A, async (req, res, next) => {
  try {
    const [courses, enrollAgg] = await Promise.all([
      Course.find().lean(),
      Enrollment.aggregate([
        { $match: { status: 'Active' } },
        { $group: { _id: '$course', count: { $sum: 1 } } },
      ]),
    ]);
    const enrollMap = Object.fromEntries(enrollAgg.map(e => [String(e._id), e.count]));

    res.json(courses.map(c => ({
      ...c,
      id:       c._id,
      enrolled: enrollMap[String(c._id)] || 0,
    })));
  } catch (err) { next(err); }
});

// ── Professor CRUD ────────────────────────────────────────────────────────────
router.get('/professors', ...A, async (req, res, next) => {
  try {
    res.json((await Professor.find().select('-password').lean()).map(p => ({ ...p, id: p._id })));
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
    const obj    = prof.toObject(); delete obj.password;
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
    res.json((await Student.find().select('-password').lean()).map(s => ({ ...s, id: s._id })));
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
      imageURL: imageURL ||
        `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`,
    });
    const obj = student.toObject(); delete obj.password;
    res.status(201).json({ ...obj, id: obj._id });
  } catch (err) { next(err); }
});

router.delete('/students/:id', ...A, async (req, res, next) => {
  try {
    await Student.findByIdAndDelete(req.params.id);
    res.json({ message: 'Student deleted' });
  } catch (err) { next(err); }
});

// ── TA management ─────────────────────────────────────────────────────────────
router.post('/courses/:courseId/tas', ...A, async (req, res, next) => {
  try {
    const { student_id } = req.body;
    if (!student_id) return res.status(400).json({ error: 'student_id required' });
    const student = await Student.findById(student_id).lean();
    if (!student) return res.status(404).json({ error: 'Student not found' });
    const course = await Course.findByIdAndUpdate(
      req.params.courseId,
      { $addToSet: { tas: student_id } },
      { new: true }
    );
    if (!course) return res.status(404).json({ error: 'Course not found' });
    res.json({ message: 'TA added', tas: course.tas });
  } catch (err) { next(err); }
});

router.delete('/courses/:courseId/tas/:studentId', ...A, async (req, res, next) => {
  try {
    const course = await Course.findByIdAndUpdate(
      req.params.courseId,
      { $pull: { tas: req.params.studentId } },
      { new: true }
    );
    if (!course) return res.status(404).json({ error: 'Course not found' });
    res.json({ message: 'TA removed', tas: course.tas });
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

router.get('/enrollments/:courseId', ...A, async (req, res, next) => {
  try {
    const enrollments = await Enrollment.find({ course: req.params.courseId, status: 'Active' }).lean();
    const students    = await Student.find({ _id: { $in: enrollments.map(e => e.student) } })
      .select('-password').lean();
    res.json(students.map(s => ({ ...s, id: s._id })));
  } catch (err) { next(err); }
});

// ── GET /admin/student/:id/analytics (bucket-backed) ─────────────────────────
//
// FIX: In the bucket path, sessionsHeld was incorrectly set to `attended`
// (the count of lectures the student attended). It must reflect the actual
// number of distinct lectures that had at least one session — i.e. lectures
// that were "held". We now fetch sessions for all enrolled courses and compute
// sessionsHeld (distinct lectureUIDs with ≥1 session) per course, then use
// that as the denominator for attendancePct.
//
router.get('/student/:studentId/analytics', ...A, async (req, res, next) => {
  try {
    const { studentId } = req.params;
    const bucket = await Bucket.findOne({ studentUID: studentId }).lean();
    const enrollments = await Enrollment.find({ student: studentId, status: 'Active' }).lean();
    if (enrollments.length === 0) return res.json({ studentId, courses: [], cached: false });

    const courseIds = enrollments.map(e => e.course);
    const courses   = await Course.find({ _id: { $in: courseIds } }).lean();

    if (bucket?.courses?.length > 0) {
      // FIX: We need actual sessionsHeld per course.
      // Fetch all sessions for enrolled courses and count distinct lectureUIDs per course.
      const sessions = await Session.find({ course: { $in: courseIds } }).lean();
      const sessionsHeldMap = {};
      for (const s of sessions) {
        const cid = String(s.course);
        if (!sessionsHeldMap[cid]) sessionsHeldMap[cid] = new Set();
        sessionsHeldMap[cid].add(s.lectureUID);
      }

      const bucketMap = Object.fromEntries(bucket.courses.map(c => [c.courseUID, c]));
      const courseStats = courses.map(c => {
        const cid      = String(c._id);
        const bc       = bucketMap[cid];
        const attended = bc?.lectures?.length || 0;
        const total    = c.lectures?.length || 0;
        // sessionsHeld = number of distinct lectures that had at least one session
        const sessionsHeld = sessionsHeldMap[cid]?.size || 0;
        return {
          courseId:      c._id,
          courseName:    c.name,
          slot:          c.slot,
          totalLectures: total,
          sessionsHeld,
          attended,
          // FIX: use sessionsHeld as denominator — that's how many were actually held
          attendancePct: sessionsHeld > 0 ? parseFloat(((attended / sessionsHeld) * 100).toFixed(1)) : 0,
          fromCache:     true,
        };
      });
      const student = await Student.findById(studentId).select('-password').lean();
      return res.json({ studentId, student, courses: courseStats, cached: true });
    }

    // Live fallback (unchanged — already correct)
    const sessions    = await Session.find({ course: { $in: courseIds } }).lean();
    const sessionUIDs = sessions.map(s => s.sessionUID);
    const records     = await Attendance.find({ sessionUID: { $in: sessionUIDs }, student: studentId }).lean();
    const markedSet   = new Set(records.map(r => r.sessionUID));
    const sessByCourse = {};
    for (const s of sessions) {
      if (!sessByCourse[String(s.course)]) sessByCourse[String(s.course)] = [];
      sessByCourse[String(s.course)].push(s);
    }
    const courseStats = courses.map(c => {
      const cs           = sessByCourse[String(c._id)] || [];
      // Count distinct lectureUIDs that had at least one session = lectures held
      const distinctLectures = new Set(cs.map(s => s.lectureUID));
      const sessionsHeld     = distinctLectures.size;
      // Count lectures where the student was marked in at least one session
      const attendedLectures = new Set(
        cs.filter(s => markedSet.has(s.sessionUID)).map(s => s.lectureUID)
      );
      const attended = attendedLectures.size;
      return {
        courseId:      c._id,
        courseName:    c.name,
        slot:          c.slot,
        totalLectures: c.lectures?.length || 0,
        sessionsHeld,
        attended,
        attendancePct: sessionsHeld > 0 ? parseFloat(((attended / sessionsHeld) * 100).toFixed(1)) : 0,
        fromCache:     false,
      };
    });
    const student = await Student.findById(studentId).select('-password').lean();
    res.json({ studentId, student, courses: courseStats, cached: false });
  } catch (err) { next(err); }
});

// ── Classroom / Beacon management ─────────────────────────────────────────────
router.get('/classrooms', authenticate, async (req, res, next) => {
  try { res.json(await Classroom.find().lean()); } catch (err) { next(err); }
});
router.post('/classrooms', ...A, async (req, res, next) => {
  try { res.status(201).json(await Classroom.create(req.body)); } catch (err) { next(err); }
});
router.get('/beacons', ...A, async (req, res, next) => {
  try { res.json(await Beacon.find().lean()); } catch (err) { next(err); }
});
router.post('/beacons', ...A, async (req, res, next) => {
  try { res.status(201).json(await Beacon.create(req.body)); } catch (err) { next(err); }
});

// ── CSV bulk operations ───────────────────────────────────────────────────────
router.post('/csv/bulk-create', ...A, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const type = req.body.type;
    const rows = csv.parse(req.file.buffer.toString(), { columns: true, skip_empty_lines: true });
    let created = 0, skipped = 0;
    const errors = [];
    for (const row of rows) {
      try {
        if (type === 'students') {
          const hashed = await bcrypt.hash(row.password || 'changeme', 10);
          await Student.findOneAndUpdate({ _id: row._id },
            { ...row, password: hashed, imageURL: row.imageURL || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(row.name)}` },
            { upsert: true });
          created++;
        } else if (type === 'professors') {
          const hashed = await bcrypt.hash(row.password || 'changeme', 10);
          await Professor.findOneAndUpdate({ _id: row._id }, { ...row, password: hashed }, { upsert: true });
          created++;
        } else if (type === 'courses') {
          const instructors = row.instructors ? row.instructors.split(',').map(s=>s.trim()).filter(Boolean) : [];
          const tas         = row.tas         ? row.tas.split(',').map(s=>s.trim()).filter(Boolean)         : [];
          const data        = { ...row, instructors, tas };
          const { lectures, schedules } = populateLectures(data);
          await Course.findOneAndUpdate({ _id: row._id }, { ...data, lectures, schedules }, { upsert: true });
          created++;
        } else if (type === 'enrollments') {
          await Enrollment.findOneAndUpdate(
            { student: row.student, course: row.course },
            { $set: { status: 'Active' } },
            { upsert: true }
          );
          created++;
        }
      } catch (e) {
        skipped++;
        errors.push(`${row._id || JSON.stringify(row)}: ${e.message}`);
      }
    }
    res.json({ created, skipped, errors: errors.slice(0, 10) });
  } catch (err) { next(err); }
});

router.post('/csv/bulk-delete', ...A, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const type = req.body.type;
    const rows = csv.parse(req.file.buffer.toString(), { columns: true, skip_empty_lines: true });
    let deleted = 0;
    const errors = [];
    const ModelMap = { students: Student, professors: Professor, courses: Course };
    for (const row of rows) {
      try {
        if (type === 'enrollments') {
          await Enrollment.findOneAndUpdate({ student: row.student, course: row.course }, { $set: { status: 'Dropped' } });
          deleted++;
        } else if (ModelMap[type]) {
          await ModelMap[type].findByIdAndDelete(row._id);
          deleted++;
        }
      } catch (e) { errors.push(`${row._id}: ${e.message}`); }
    }
    res.json({ deleted, errors: errors.slice(0, 10) });
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

router.get('/courses/:courseId/analytics', ...A, async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const course = await Course.findById(courseId).lean();
    if (!course) return res.status(404).json({ error: 'Course not found' });

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

    const lectureMap  = new Map();
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
      sessStudents.get(r.sessionUID).add(String(r.student));
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

    const totalLectures = lectureMap.size;
    const studentCount  = {};
    for (const lec of lectureMap.values()) {
      for (const sid of lec.presentInAll) {
        studentCount[sid] = (studentCount[sid] || 0) + 1;
      }
    }

    const students = await Student.find({ _id: { $in: studentIds } })
      .select('-password').lean();

    const taSet = new Set((course.tas || []).map(String));

    const studentStats = students.map(s => {
      const sid      = String(s._id);
      const attended = studentCount[sid] || 0;
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
        isTA: taSet.has(sid),
      };
    }).sort((a, b) => b.attendancePct - a.attendancePct);

    res.json({
      courseId,
      courseName:   course.name,
      slot:         course.slot,
      venue:        course.venue,
      department:   course.department,
      instructors:  course.instructors,
      tas:          course.tas,
      totalLectures,
      enrolled:     studentIds.length,
      studentStats,
    });
  } catch (err) { next(err); }
});

module.exports = router;