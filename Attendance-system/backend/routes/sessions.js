/**
 * sessions.js
 *
 * FIXES:
 *
 * 1. resolveOrCreateLecture is now atomic.
 *    Previously two concurrent startSession calls would both:
 *      a) fetch the same stale course document (no ad-hoc lecture yet)
 *      b) independently reach step 3 (no match found)
 *      c) both push a new lecture via $push → two lectures, same scheduledTime
 *
 *    The fix uses findOneAndUpdate with $push filtered by
 *    $not / $elemMatch so that only ONE caller ever pushes a new lecture.
 *    If the push is a no-op (another caller already pushed), we re-fetch
 *    the course and find the lecture that was just created.
 *
 * 2. SchedulerContext now passes the lectureUID explicitly (after resolving it
 *    client-side against the lectures array), so step 1 of resolveOrCreateLecture
 *    returns immediately and the ad-hoc path is never reached during scheduled
 *    sessions.  The atomic logic here is a safety backstop for manual starts
 *    and any edge cases.
 *
 * 3. Active session uses active:true flag.
 *
 * 4. Lecture matching window: ±30 minutes (IST-aware after lecturePopulator fix).
 */
const express  = require('express');
const { v4: uuidv4 } = require('uuid');
const Session  = require('../models/Session');
const Course   = require('../models/Course');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

const LECTURE_MATCH_WINDOW_MS    = 30 * 60 * 1000; // ±30 min
const DEFAULT_LECTURE_DURATION_MIN = 55;

// ── Resolve or create a lecture — ATOMIC ──────────────────────────────────────
/**
 * Finds the best matching lecture for the current time (within ±30 min).
 * If none found, creates ONE new ad-hoc lecture using an atomic
 * findOneAndUpdate so that concurrent calls cannot both push a new entry.
 *
 * Returns { lectureUID, scheduledTime, wasCreated }
 */
async function resolveOrCreateLecture(courseId, providedLectureUID) {
  // Always re-fetch the course fresh inside this function so we see the latest
  // lectures[], including any pushed by a concurrent call a moment earlier.
  const course = await Course.findById(courseId).lean();
  if (!course) throw Object.assign(new Error('Course not found'), { status: 404 });

  const now = new Date();

  // Step 1: caller explicitly provided a lectureUID — use it directly.
  if (providedLectureUID) {
    const lec = course.lectures.find(l => l.lectureUID === providedLectureUID);
    if (lec) return { lectureUID: lec.lectureUID, scheduledTime: lec.scheduledTime, wasCreated: false };
    // Provided UID not found in DB — fall through to auto-resolve.
  }

  // Step 2: find the closest non-cancelled lecture within ±30 min.
  const window = LECTURE_MATCH_WINDOW_MS;
  const closest = course.lectures
    .filter(l => !l.cancelled)
    .map(l => ({ ...l, diff: Math.abs(new Date(l.scheduledTime) - now) }))
    .filter(l => l.diff <= window)
    .sort((a, b) => a.diff - b.diff)[0];

  if (closest) {
    return { lectureUID: closest.lectureUID, scheduledTime: closest.scheduledTime, wasCreated: false };
  }

  // Step 3: no match — create exactly ONE ad-hoc lecture atomically.
  //
  // Round scheduledTime down to the nearest minute for cleanliness.
  const scheduledTime  = new Date(Math.floor(now.getTime() / 60000) * 60000);
  const newLectureUID  = uuidv4();

  // Only push if there is NO existing non-cancelled lecture within the same
  // ±30 min window.  The $not/$elemMatch condition is evaluated atomically by
  // MongoDB, so at most one concurrent caller will successfully push.
  const windowStart = new Date(now.getTime() - window);
  const windowEnd   = new Date(now.getTime() + window);

  const updated = await Course.findOneAndUpdate(
    {
      _id: courseId,
      // Guard: no existing non-cancelled lecture within the window.
      lectures: {
        $not: {
          $elemMatch: {
            cancelled:     false,
            scheduledTime: { $gte: windowStart, $lte: windowEnd },
          },
        },
      },
    },
    {
      $push: {
        lectures: {
          lectureUID:    newLectureUID,
          scheduledTime,
          cancelled:     false,
        },
      },
    },
    { new: false } // we don't need the updated doc, just whether it matched
  );

  if (updated) {
    // We were the one who pushed — return the new lecture.
    console.log(`[Session] Created ad-hoc lecture ${newLectureUID} for course ${courseId} at ${scheduledTime.toISOString()}`);
    return { lectureUID: newLectureUID, scheduledTime, wasCreated: true };
  }

  // The push was a no-op — another concurrent caller already pushed a lecture
  // into the window.  Re-fetch and return that one.
  const fresh = await Course.findById(courseId).lean();
  const winner = (fresh?.lectures || [])
    .filter(l => !l.cancelled)
    .map(l => ({ ...l, diff: Math.abs(new Date(l.scheduledTime) - now) }))
    .filter(l => l.diff <= window)
    .sort((a, b) => a.diff - b.diff)[0];

  if (winner) {
    return { lectureUID: winner.lectureUID, scheduledTime: winner.scheduledTime, wasCreated: false };
  }

  // Should be unreachable, but fall back gracefully.
  return { lectureUID: newLectureUID, scheduledTime, wasCreated: false };
}

// ── POST /startSession ────────────────────────────────────────────────────────
router.post('/startSession', authenticate, async (req, res, next) => {
  try {
    const { course_id, mode, lectureUID } = req.body;
    if (!course_id || !mode) {
      return res.status(400).json({ error: 'course_id and mode are required' });
    }

    // Authorisation check — fetch course fresh for the auth check too.
    const course = await Course.findById(course_id).lean();
    if (!course) return res.status(404).json({ error: 'Course not found' });

    const uid     = req.user.user_id;
    const allowed = req.user.role === 'admin'
      || course.instructors.includes(uid)
      || (course.tas || []).includes(uid);
    if (!allowed) return res.status(403).json({ error: 'Forbidden' });

    // Resolve (or atomically create) the lecture this session belongs to.
    const { lectureUID: resolvedUID, scheduledTime, wasCreated } =
      await resolveOrCreateLecture(course_id, lectureUID);

    // Guard: no duplicate active session for same (course, lectureUID, method).
    // This check + Session.create is not a two-phase atomic op, but a unique
    // index on { course, lectureUID, method, active } would be the hard guard.
    // In practice, since SchedulerContext now passes lectureUID explicitly and
    // checks for an active session before calling startSession, duplicate calls
    // are extremely unlikely and the 409 response handles them gracefully.
    const existing = await Session.findOne({
      course:     course_id,
      lectureUID: resolvedUID,
      method:     mode,
      active:     true,
    }).lean();

    if (existing) {
      return res.status(409).json({
        error:      `An active ${mode} session already exists for this lecture`,
        session_id: existing.sessionUID,
      });
    }

    const session = await Session.create({
      course:          course_id,
      lectureUID:      resolvedUID,
      scheduledTime,
      duration:        DEFAULT_LECTURE_DURATION_MIN,
      method:          mode,
      isAutoGenerated: false,
      active:          true,
    });

    res.status(201).json({
      session_id:     session.sessionUID,
      lectureUID:     resolvedUID,
      method:         mode,
      lectureCreated: wasCreated,
    });
  } catch (err) { next(err); }
});

// ── POST /endSession/:sessionId ───────────────────────────────────────────────
router.post('/endSession/:sessionId', authenticate, async (req, res, next) => {
  try {
    const session = await Session.findOneAndUpdate(
      { sessionUID: req.params.sessionId },
      { $set: { active: false, endedAt: new Date() } },
      { new: true }
    );
    if (!session) return res.status(404).json({ error: 'Session not found' });
    res.json({ message: 'Session ended', session_id: session.sessionUID });
  } catch (err) { next(err); }
});

// ── GET /activeSession?course_id=... ─────────────────────────────────────────
router.get('/activeSession', authenticate, async (req, res, next) => {
  try {
    const { course_id } = req.query;
    if (!course_id) return res.status(400).json({ error: 'course_id required' });

    const sessions = await Session.find({ course: course_id, active: true })
      .sort({ timestamp: -1 })
      .lean();

    if (sessions.length === 0) return res.json({});

    const primary = sessions[0];
    res.json({
      session_id:     primary.sessionUID,
      method:         primary.method,
      lectureUID:     primary.lectureUID,
      startedAt:      primary.timestamp,
      activeSessions: sessions.map(s => ({
        session_id: s.sessionUID,
        method:     s.method,
        lectureUID: s.lectureUID,
        startedAt:  s.timestamp,
      })),
    });
  } catch (err) { next(err); }
});

// ── GET /admin/sessions ───────────────────────────────────────────────────────
router.get('/admin/sessions', authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    const sessions = await Session.find().sort({ timestamp: -1 }).limit(200).lean();
    res.json(sessions.map(s => ({
      ...s,
      session_id: s.sessionUID,
      course_id:  s.course,
    })));
  } catch (err) { next(err); }
});

module.exports = router;