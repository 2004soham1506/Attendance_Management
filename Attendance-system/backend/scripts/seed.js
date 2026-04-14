/**
 * seed.js — Realistic seed data for DIAMS.
 *
 * Fixes:
 *  - TAs are STUDENTS (stored by student _id in course.tas), not professors
 *  - Sessions are seeded as active: false (past sessions are done)
 *  - Uses populateLectures() so each course gets real slot-based lectures
 *  - Attendance obeys the intersection rule
 *  - Realistic attendance rates: each student has a base attendance probability
 *    drawn from N(0.78, 0.12), clamped to [0.40, 0.98]
 */
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const Student    = require('../models/Student');
const Professor  = require('../models/Professor');
const Admin      = require('../models/Admin');
const Course     = require('../models/Course');
const Session    = require('../models/Session');
const Attendance = require('../models/Attendance');
const Enrollment = require('../models/Enrollment');
const Classroom  = require('../models/Classroom');
const Beacon     = require('../models/Beacon');
const Bucket     = require('../models/Bucket');

const { populateLectures } = require('../utils/lecturePopulator');
const { rebuildAllBuckets } = require('../services/bucketService');

// const MONGO_URI    = process.env.MONGO_URI || 'mongodb://localhost:27017/attendance';
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://admin:H1nvgEoQ2gul5YDG@cluster0.ksheidh.mongodb.net/attendance=Cluster0';
const NUM_STUDENTS = 80;
const HASH_ROUNDS  = 8;

console.log('MONGO_URI:', MONGO_URI);

const rand    = (lo, hi) => lo + Math.random() * (hi - lo);
const randInt = (lo, hi) => Math.floor(rand(lo, hi + 1));
const pick    = (arr)    => arr[Math.floor(Math.random() * arr.length)];

function randNormal(mean, std) {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return mean + std * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }

async function seed() {
  await mongoose.connect(MONGO_URI, { maxPoolSize: 5 });
  console.log('Connected to MongoDB');

  // ── Wipe everything ────────────────────────────────────────────────────────
  await Promise.all([
    Student.deleteMany({}),
    Professor.deleteMany({}),
    Admin.deleteMany({}),
    Course.deleteMany({}),
    Session.deleteMany({}),
    Attendance.deleteMany({}),
    Enrollment.deleteMany({}),
    Classroom.deleteMany({}),
    Beacon.deleteMany({}),
    Bucket.deleteMany({}),
  ]);
  console.log('Cleared existing data');

  // ── Admin ──────────────────────────────────────────────────────────────────
  await Admin.create({
    _id:      'admin',
    email:    'admin@iith.ac.in',
    password: await bcrypt.hash('adminpass', HASH_ROUNDS),
  });

  // ── Professors ─────────────────────────────────────────────────────────────
  const profData = [
    { _id: 'prof_arora',   name: 'Prof. Arora',   email: 'arora@iith.ac.in',   department: 'CSE' },
    { _id: 'prof_mehta',   name: 'Prof. Mehta',   email: 'mehta@iith.ac.in',   department: 'CSE' },
    { _id: 'prof_suresh',  name: 'Prof. Suresh',  email: 'suresh@iith.ac.in',  department: 'EE'  },
    { _id: 'prof_kapoor',  name: 'Prof. Kapoor',  email: 'kapoor@iith.ac.in',  department: 'MA'  },
  ];
  const profs = [];
  for (const pd of profData) {
    profs.push(await Professor.create({
      ...pd,
      password: await bcrypt.hash('prof123', HASH_ROUNDS),
    }));
  }
  console.log(`Created ${profs.length} professors`);

  // ── Students ───────────────────────────────────────────────────────────────
  const FIRST_NAMES = [
    'Aditya','Bhavna','Chetan','Deepika','Eshan','Fatima','Gaurav','Hira',
    'Ishaan','Jyoti','Karthik','Lakshmi','Manish','Nandini','Om','Priya',
    'Rahul','Sneha','Tarun','Usha','Vikram','Waqar','Xenia','Yash','Zara',
    'Arjun','Bindu','Chirag','Divya','Eshwar','Faisal','Gayatri','Harsh',
    'Isha','Jayesh','Kavya','Lokesh','Meghna','Nikhil','Omi','Pooja',
  ];
  const LAST_NAMES = [
    'Sharma','Verma','Patel','Singh','Kumar','Gupta','Reddy','Nair',
    'Joshi','Iyer','Pillai','Mehta','Kapoor','Bose','Das','Roy',
  ];

  const students = [];
  const pwHash   = await bcrypt.hash('stud123', HASH_ROUNDS);

  for (let i = 1; i <= NUM_STUDENTS; i++) {
    const fn = pick(FIRST_NAMES);
    const ln = pick(LAST_NAMES);
    const name = `${fn} ${ln}`;
    const id   = `CS22B${String(i).padStart(4,'0')}`;
    students.push(await Student.create({
      _id:      id,
      name,
      email:    `${id.toLowerCase()}@iith.ac.in`,
      password: pwHash,
      imageURL: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`,
    }));
  }
  console.log(`Created ${students.length} students`);

  // ── Classrooms ─────────────────────────────────────────────────────────────
  const classroomData = [
    { _id: 'LH-1',  capacity: 120 },
    { _id: 'LH-2',  capacity: 90  },
    { _id: 'LH-7',  capacity: 100 },
    { _id: 'LH-12', capacity: 80  },
  ];
  for (const cd of classroomData) await Classroom.create(cd);

  // ── Beacons (3 per classroom) ──────────────────────────────────────────────
  for (const cd of classroomData) {
    for (let b = 1; b <= 3; b++) {
      await Beacon.create({
        bleID:     `${cd._id}-BLE-${b}`,
        classroom: cd._id,
      });
    }
  }

  // ── Pick TA students (2 per course, different students) ────────────────────
  // TAs are students identified by their student _id (e.g. 'CS22B0001')
  // We pick a few students from the pool to be TAs for specific courses.
  // These students remain enrolled as normal students too.
  const taStudents = students.slice(0, 8); // first 8 students can be TAs

  // ── Courses ────────────────────────────────────────────────────────────────
  // tas field stores STUDENT _ids (not professor ids)
  const courseDefinitions = [
    {
      _id: 'CS3101', name: 'Data Structures & Algorithms',
      department: 'CSE', slot: 'A', venue: 'LH-1',
      instructors: ['prof_arora'],
      tas: [taStudents[0]._id, taStudents[1]._id],
    },
    {
      _id: 'CS3201', name: 'Database Management Systems',
      department: 'CSE', slot: 'B', venue: 'LH-2',
      instructors: ['prof_mehta'],
      tas: [taStudents[2]._id],
    },
    {
      _id: 'EE3101', name: 'Signals & Systems',
      department: 'EE', slot: 'E', venue: 'LH-7',
      instructors: ['prof_suresh'],
      tas: [taStudents[3]._id, taStudents[4]._id],
    },
    {
      _id: 'MA2101', name: 'Linear Algebra',
      department: 'MA', slot: 'C', venue: 'LH-12',
      instructors: ['prof_kapoor'],
      tas: [taStudents[5]._id],
    },
  ];

  const START_DATE = new Date('2026-1-01');
  const END_DATE   = new Date('2026-4-30');
  const now        = new Date();

  const courses = [];
  for (const cd of courseDefinitions) {
    const { lectures, schedules } = populateLectures({
      ...cd,
      startDate: START_DATE,
      endDate:   END_DATE,
    });

    const markedLectures = lectures.map(l => ({
      ...l,
      cancelled: false,
    }));

    const course = await Course.create({
      ...cd,
      startDate: START_DATE,
      endDate:   END_DATE,
      lectures:  markedLectures,
      schedules,
    });
    courses.push(course);
  }
  console.log(`Created ${courses.length} courses`);

  // ── Enrollments ────────────────────────────────────────────────────────────
  // Each student enrolls in 2-4 randomly selected courses
  const enrollmentOps = [];
  for (const student of students) {
    const courseCount = randInt(2, 4);
    const shuffled    = [...courses].sort(() => Math.random() - 0.5);
    const enrolled    = shuffled.slice(0, courseCount);
    for (const course of enrolled) {
      enrollmentOps.push({
        updateOne: {
          filter: { student: student._id, course: course._id },
          update: { $set: { status: 'Active', enrollmentDate: new Date(START_DATE) } },
          upsert: true,
        },
      });
    }
  }
  // Also enroll TA students in their TA courses (they must be enrolled)
  for (const cd of courseDefinitions) {
    for (const taId of cd.tas) {
      enrollmentOps.push({
        updateOne: {
          filter: { student: taId, course: cd._id },
          update: { $set: { status: 'Active', enrollmentDate: new Date(START_DATE) } },
          upsert: true,
        },
      });
    }
  }
  await Enrollment.bulkWrite(enrollmentOps);
  const totalEnrollments = await Enrollment.countDocuments({ status: 'Active' });
  console.log(`Created ${totalEnrollments} enrollments`);

  // ── Sessions & Attendance ──────────────────────────────────────────────────
  // Sessions for PAST lectures are active: false (they are done).
  // We never seed an active: true session — the scheduler/prof starts those.
  let sessionCount    = 0;
  let attendanceCount = 0;

  for (const course of courses) {
    const enrollments = await Enrollment.find({ course: course._id, status: 'Active' }).lean();
    const enrolledIds = enrollments.map(e => String(e.student));

    const studentProb = {};
    for (const sid of enrolledIds) {
      studentProb[sid] = clamp(randNormal(0.78, 0.12), 0.40, 0.98);
    }

    const pastLectures = course.lectures.filter(l =>
      !l.cancelled && new Date(l.scheduledTime) < now
    );

    for (const lecture of pastLectures) {
      const twoSessions = Math.random() < 0.40;
      const methods = twoSessions
        ? ['BLE', 'QRCode']
        : [pick(['BLE', 'QRCode', 'Manual'])];

      const sessionDocs = [];
      for (const method of methods) {
        const sessionUID = uuidv4();
        const offset = method === 'QRCode' && twoSessions ? 45 : 0;
        const ts     = new Date(lecture.scheduledTime.getTime() + offset * 60000);

        await Session.create({
          sessionUID,
          course:          course._id,
          lectureUID:      lecture.lectureUID,
          scheduledTime:   lecture.scheduledTime,
          duration:        50,
          method,
          isAutoGenerated: false,
          timestamp:       ts,
          active:          false,   // ← FIX: past sessions are NOT active
          endedAt:         ts,
        });
        sessionDocs.push({ sessionUID, method });
        sessionCount++;
      }

      // Build attendance marks
      const attendanceOps = [];
      for (const sid of enrolledIds) {
        const p = studentProb[sid];

        if (sessionDocs.length === 1) {
          if (Math.random() < p) {
            const ts = new Date(
              lecture.scheduledTime.getTime() + randInt(0, 15) * 60000
            );
            attendanceOps.push({
              insertOne: {
                document: {
                  sessionUID:  sessionDocs[0].sessionUID,
                  student:     sid,
                  verifiedVia: sessionDocs[0].method === 'Manual' ? 'Manual'
                                : sessionDocs[0].method,
                  markedAt:    ts,
                  timestamp:   ts,
                },
              },
            });
            attendanceCount++;
          }
        } else {
          // Two sessions — only count if present in BOTH (intersection rule)
          const attendFirst  = Math.random() < p;
          const attendSecond = Math.random() < p;

          if (attendFirst) {
            const ts = new Date(
              lecture.scheduledTime.getTime() + randInt(0, 10) * 60000
            );
            attendanceOps.push({
              insertOne: {
                document: {
                  sessionUID:  sessionDocs[0].sessionUID,
                  student:     sid,
                  verifiedVia: 'BLE',
                  markedAt:    ts,
                  timestamp:   ts,
                },
              },
            });
            attendanceCount++;
          }

          if (attendSecond) {
            const ts = new Date(
              lecture.scheduledTime.getTime() + 45 * 60000 + randInt(0, 10) * 60000
            );
            attendanceOps.push({
              insertOne: {
                document: {
                  sessionUID:  sessionDocs[1].sessionUID,
                  student:     sid,
                  verifiedVia: 'QRCode',
                  markedAt:    ts,
                  timestamp:   ts,
                },
              },
            });
            attendanceCount++;
          }
        }
      }

      if (attendanceOps.length > 0) {
        try {
          await Attendance.bulkWrite(attendanceOps, { ordered: false });
        } catch (e) {
          // ignore duplicate key errors
          if (e.code !== 11000) throw e;
        }
      }
    }
  }

  console.log(`Created ${sessionCount} sessions`);
  console.log(`Created ~${attendanceCount} attendance records`);

  // ── Rebuild bucket cache ───────────────────────────────────────────────────
  console.log('Rebuilding bucket cache...');
  await rebuildAllBuckets();

  console.log('\n=== Seed complete ===');
  console.log('Admin:      admin@iith.ac.in / adminpass');
  console.log('Professors: arora@iith.ac.in, mehta@iith.ac.in, suresh@iith.ac.in, kapoor@iith.ac.in / prof123');
  console.log('Students:   cs22b0001@iith.ac.in ... / stud123');
  console.log(`TA students: ${courseDefinitions.map(c => c.tas.join(', ')).flat().filter((v,i,a) => a.indexOf(v) === i).join(', ')}`);

  await mongoose.disconnect();
}

seed().catch(e => { console.error(e); process.exit(1); });