/**
 * autoEndSessionService.js
 *
 * Called by the cron job every minute.
 * Three responsibilities:
 *
 *  1. End sessions whose lecture has been cancelled (safety net).
 *     The cancel route already ends active sessions synchronously, so this
 *     catches edge cases (e.g. cancel fired mid-tick, or a session started
 *     manually after cancellation by mistake).
 *
 *  2. End sessions whose schedule endTime has passed (existing behaviour).
 *
 *  3. End sessions whose duration has elapsed — for manually-started sessions
 *     that have no matching schedule entry (so condition 2 never fires for them).
 *     Formula: session.timestamp + session.duration * 60 000 ms < now
 *
 * Order: 1 → 2 → 3.  Each step skips sessions already closed by the previous one.
 */
const Session = require('../models/Session');
const Course  = require('../models/Course');

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const DAY_NAMES     = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

function nowIST() {
  const d = new Date(Date.now() + IST_OFFSET_MS);
  return {
    dayName:  DAY_NAMES[d.getUTCDay()],
    totalMin: d.getUTCHours() * 60 + d.getUTCMinutes(),
  };
}

async function autoEndExpiredSessions() {
  const activeSessions = await Session.find({ active: true }).lean();
  if (activeSessions.length === 0) return;

  // Group sessions by course for batched Course lookups
  const byCourse = {};
  for (const s of activeSessions) {
    const cid = String(s.course);
    if (!byCourse[cid]) byCourse[cid] = [];
    byCourse[cid].push(s);
  }

  const closedUIDs = new Set(); // accumulates across all three conditions

  // ── Condition 1: end sessions for cancelled lectures ──────────────────────
  for (const [courseId, sessions] of Object.entries(byCourse)) {
    const course = await Course.findById(courseId).select('schedules lectures').lean();
    if (!course) continue;

    const lectureMap = Object.fromEntries(
      (course.lectures || []).map(l => [l.lectureUID, l.cancelled])
    );

    for (const session of sessions) {
      if (lectureMap[session.lectureUID] === true) {
        closedUIDs.add(session.sessionUID);
      }
    }
  }

  if (closedUIDs.size > 0) {
    await Session.updateMany(
      { sessionUID: { $in: Array.from(closedUIDs) } },
      { $set: { active: false, endedAt: new Date() } }
    );
    console.log(`[AutoEnd] Closed ${closedUIDs.size} session(s) for cancelled lectures`);
  }

  // ── Condition 2: end sessions whose schedule endTime has passed ───────────
  const { dayName, totalMin } = nowIST();

  for (const [courseId, sessions] of Object.entries(byCourse)) {
    const course = await Course.findById(courseId).select('schedules lectures').lean();
    if (!course?.schedules?.length) continue;

    for (const session of sessions) {
      if (closedUIDs.has(session.sessionUID)) continue;

      const istMs      = new Date(session.scheduledTime).getTime() + IST_OFFSET_MS;
      const istDate    = new Date(istMs);
      const lecMin     = istDate.getUTCHours() * 60 + istDate.getUTCMinutes();
      const lecDayName = DAY_NAMES[istDate.getUTCDay()];

      const matchingSchedule = course.schedules.find(sch => {
        if (sch.scheduledDay !== lecDayName) return false;
        const [sh, sm] = sch.startTime.split(':').map(Number);
        const [eh, em] = sch.endTime.split(':').map(Number);
        return lecMin >= sh * 60 + sm && lecMin < eh * 60 + em;
      });

      if (!matchingSchedule) continue;

      const [eh, em] = matchingSchedule.endTime.split(':').map(Number);
      const scheduleEndMin = eh * 60 + em;

      if (lecDayName === dayName && totalMin >= scheduleEndMin) {
        await Session.findOneAndUpdate(
          { sessionUID: session.sessionUID },
          { $set: { active: false, endedAt: new Date() } }
        );
        closedUIDs.add(session.sessionUID);
        console.log(`[AutoEnd] Ended session ${session.sessionUID} (${matchingSchedule.endTime} IST passed)`);
      }
    }
  }

  // ── Condition 3: end sessions whose duration has elapsed ──────────────────
  // Backstop for manually-started sessions that have no matching schedule entry
  // (condition 2 never fires for them because matchingSchedule is null).
  // Only sessions with a positive duration field are eligible.
  const now = Date.now();

  for (const sessions of Object.values(byCourse)) {
    for (const session of sessions) {
      if (closedUIDs.has(session.sessionUID)) continue;
      if (!session.duration || session.duration <= 0) continue;

      const startedAt  = new Date(session.timestamp).getTime();
      const expiresAt  = startedAt + session.duration * 60_000;

      if (now >= expiresAt) {
        await Session.findOneAndUpdate(
          { sessionUID: session.sessionUID },
          { $set: { active: false, endedAt: new Date() } }
        );
        closedUIDs.add(session.sessionUID);
        console.log(
          `[AutoEnd] Ended session ${session.sessionUID} (duration ${session.duration} min elapsed` +
          ` — no matching schedule, manual start)`
        );
      }
    }
  }
}

module.exports = { autoEndExpiredSessions };