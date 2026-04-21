/**
 * autoSessionService.js
 *
 * Runs every minute via cron.
 * Creates a fallback BLE session for any lecture due right now that has
 * no active scheduled session covering it — i.e. the lecture exists in
 * course.lectures[] but there is no matching schedule entry.
 *
 * Timezone contract:
 *   - lecture.scheduledTime      : UTC timestamp
 *   - SLOT_MAP times             : UTC "HH:mm" strings
 *   - schedule startTime/endTime : IST "HH:mm" strings (written to course)
 *   - schedule scheduledDay      : IST day name ("Monday" etc.)
 *
 * Cancellation contract:
 *   - If lecture.cancelled === true the cron skips it entirely.
 *   - The DB query already filters 'lectures.cancelled': false at the
 *     Course.find() level, providing an early short-circuit.
 *
 * Changes vs original (B3 fix):
 *   1. duration derived from SLOT_MAP[course.slot] for that UTC day
 *      (was hardcoded 5 min — now 55 min theory / 85 min lab / etc.)
 *   2. A schedule entry is written to the course document using the
 *      slot's IST start/end times so that autoEndSessionService
 *      condition 2 (endTime passed) fires normally for these sessions.
 *      The write is idempotent: skipped if a matching entry already exists.
 *   3. session.timestamp is snapped to the floor of the IST hour in UTC
 *      so autoEndSessionService condition 3 maths are correct.
 */
const Course  = require('../models/Course');
const Session = require('../models/Session');
const { SLOT_MAP } = require('../utils/lecturePopulator');

const DAY_NAMES      = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const IST_OFFSET_MS  = 5.5 * 60 * 60 * 1000;
const IST_OFFSET_MIN = 330;
const FALLBACK_DURATION_MIN = 55;

// ── Helpers ───────────────────────────────────────────────────────────────────

function toIST(utcDate) {
  const d = new Date(utcDate.getTime() + IST_OFFSET_MS);
  return {
    dayIdx:   d.getUTCDay(),
    dayName:  DAY_NAMES[d.getUTCDay()],
    totalMin: d.getUTCHours() * 60 + d.getUTCMinutes(),
  };
}

/** "HH:mm" UTC string → "HH:mm" IST string */
function utcToISTString(utcHHmm) {
  const [hh, mm] = utcHHmm.split(':').map(Number);
  const total = (hh * 60 + mm + IST_OFFSET_MIN) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/** "HH:mm" → total minutes */
function hhmm(str) {
  const [h, m] = str.split(':').map(Number);
  return h * 60 + m;
}

/**
 * Find the SLOT_MAP window for (slot, UTC day index).
 * Returns { durationMin, istStart, istEnd } or null.
 */
function slotWindowForDay(slot, utcDayIdx) {
  const w = (SLOT_MAP[slot] || []).find(x => x.day === utcDayIdx);
  if (!w) return null;
  return {
    durationMin: hhmm(w.end) - hhmm(w.start),
    istStart:    utcToISTString(w.start),
    istEnd:      utcToISTString(w.end),
  };
}

/**
 * Snap a UTC Date to the floor of the current IST hour, returned as UTC.
 * e.g. 10:52 UTC (= 16:22 IST) → 10:30 UTC (= 16:00 IST)
 */
function floorToISTHour(utcDate) {
  const istMs = utcDate.getTime() + IST_OFFSET_MS;
  const d = new Date(istMs);
  d.setUTCMinutes(0, 0, 0);
  return new Date(d.getTime() - IST_OFFSET_MS);
}

// ── Main export ───────────────────────────────────────────────────────────────

async function autoCreateFallbackSessions() {
  const now         = new Date();
  const windowStart = new Date(now.getTime() - 2 * 60000);
  const windowEnd   = new Date(now.getTime() + 2 * 60000);

  const courses = await Course.find({
    'lectures.scheduledTime': { $gte: windowStart, $lte: windowEnd },
    'lectures.cancelled':     false,
  }).lean();

  for (const course of courses) {
    const dueLectures = course.lectures.filter(l =>
      !l.cancelled &&
      new Date(l.scheduledTime) >= windowStart &&
      new Date(l.scheduledTime) <= windowEnd
    );

    for (const lecture of dueLectures) {
      if (lecture.cancelled) continue;

      const { dayIdx, dayName: lecDayName, totalMin: lecMin } =
        toIST(new Date(lecture.scheduledTime));

      // ── Skip if a schedule already covers this lecture's IST time ─────────
      const covered = (course.schedules || []).some(s => {
        if (s.scheduledDay !== lecDayName) return false;
        const [sh, sm] = s.startTime.split(':').map(Number);
        const [eh, em] = s.endTime.split(':').map(Number);
        return lecMin >= sh * 60 + sm && lecMin < eh * 60 + em;
      });

      if (covered) continue; // SchedulerContext handles scheduled slots

      // ── Skip if an active session already exists ───────────────────────────
      const existing = await Session.findOne({
        course:     course._id,
        lectureUID: lecture.lectureUID,
        active:     true,
      }).lean();

      if (existing) continue;

      // ── Derive duration and IST window from SLOT_MAP ──────────────────────
      // dayIdx = UTC day of lecture.scheduledTime, which equals SLOT_MAP's day field.
      const slotWindow = slotWindowForDay(course.slot, dayIdx);

      const durationMin = slotWindow ? slotWindow.durationMin : FALLBACK_DURATION_MIN;
      const istStart    = slotWindow
        ? slotWindow.istStart
        : (() => {
            // Fallback: floor-of-IST-hour as start
            const snapped = floorToISTHour(new Date(lecture.scheduledTime));
            const istD = new Date(snapped.getTime() + IST_OFFSET_MS);
            return `${String(istD.getUTCHours()).padStart(2, '0')}:00`;
          })();
      const istEnd      = slotWindow
        ? slotWindow.istEnd
        : (() => {
            const endMin = hhmm(istStart) + FALLBACK_DURATION_MIN;
            return `${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`;
          })();

      // ── Write a schedule entry to the course (idempotent) ─────────────────
      // Lets autoEndSessionService condition 2 (schedule endTime passed) fire
      // normally for this session. Guarded by scheduledDay + startTime match.
      const alreadyHasSchedule = (course.schedules || []).some(
        s => s.scheduledDay === lecDayName && s.startTime === istStart
      );

      if (!alreadyHasSchedule) {
        await Course.updateOne(
          { _id: course._id },
          {
            $push: {
              schedules: {
                scheduledDay: lecDayName,
                startTime:    istStart,
                endTime:      istEnd,
                method:       'BLE',
                switch:       false,
              },
            },
          }
        );
        console.log(
          `[AutoSession] Added schedule ${lecDayName} ${istStart}–${istEnd} IST ` +
          `for ${course._id} (slot ${course.slot || 'unknown'})`
        );
        // Update local copy so the covered-check above stays accurate
        // for any subsequent lectures in the same course iteration.
        course.schedules = course.schedules || [];
        course.schedules.push({
          scheduledDay: lecDayName, startTime: istStart,
          endTime: istEnd, method: 'BLE', switch: false,
        });
      }

      // ── Snap session timestamp to floor of IST hour ───────────────────────
      // autoEndSessionService condition 3 uses session.timestamp + duration * 60000.
      // Snapping to the floor means the session expires at the correct wall-clock
      // end time even if the cron fires a few minutes into the slot.
      const snappedTimestamp = floorToISTHour(new Date(lecture.scheduledTime));

      // ── Create the session ────────────────────────────────────────────────
      await Session.create({
        course:          course._id,
        lectureUID:      lecture.lectureUID,
        scheduledTime:   lecture.scheduledTime,
        timestamp:       snappedTimestamp,
        duration:        durationMin,
        method:          'BLE',
        isAutoGenerated: true,
        active:          true,
      });

      console.log(
        `[AutoSession] Fallback session for ${course._id} / ${lecture.lectureUID} ` +
        `— slot ${course.slot || 'unknown'}, duration ${durationMin} min, ` +
        `timestamp snapped to ${snappedTimestamp.toISOString()}`
      );
    }
  }
}

module.exports = { autoCreateFallbackSessions };