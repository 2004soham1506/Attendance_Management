const { v4: uuidv4 } = require('uuid');

/**
 * SLOT_MAP — times are in UTC.
 *
 * These are the actual UTC times at which each slot runs.
 * e.g. Slot A Monday 03:30 UTC = 09:00 IST.
 *
 * DO NOT change these to IST — they are used directly to set
 * scheduledTime (stored as UTC) on each lecture.
 *
 * The schedules array (startTime / endTime strings) is derived
 * from these by adding +5:30 so that the frontend, SchedulerContext,
 * and autoSessionService — which all work in IST — see correct IST strings.
 */
const SLOT_MAP = {
  A: [
    { day: 1, start: '03:30', end: '04:25' },
    { day: 3, start: '05:30', end: '06:25' },
    { day: 4, start: '04:30', end: '05:25' }
  ],
  B: [
    { day: 1, start: '04:30', end: '05:25' },
    { day: 3, start: '03:30', end: '04:25' },
    { day: 4, start: '05:30', end: '06:25' }
  ],
  C: [
    { day: 1, start: '05:30', end: '06:25' },
    { day: 3, start: '04:30', end: '05:25' },
    { day: 4, start: '03:30', end: '04:25' }
  ],
  D: [
    { day: 1, start: '06:30', end: '07:25' },
    { day: 2, start: '03:30', end: '04:25' },
    { day: 5, start: '05:30', end: '06:25' }
  ],
  E: [
    { day: 2, start: '04:30', end: '05:25' },
    { day: 4, start: '06:30', end: '07:25' },
    { day: 5, start: '03:30', end: '04:25' }
  ],
  F: [
    { day: 2, start: '05:30', end: '06:25' },
    { day: 3, start: '09:00', end: '10:25' },
    { day: 5, start: '04:30', end: '05:25' }
  ],
  G: [
    { day: 2, start: '06:30', end: '07:25' },
    { day: 3, start: '06:30', end: '07:25' },
    { day: 5, start: '06:30', end: '07:25' }
  ],
  P: [
    { day: 1, start: '09:00', end: '10:25' },
    { day: 4, start: '10:30', end: '11:55' }
  ],
  Q: [
    { day: 1, start: '10:30', end: '11:55' },
    { day: 4, start: '09:00', end: '10:25' }
  ],
  R: [
    { day: 2, start: '09:00', end: '10:25' },
    { day: 5, start: '10:30', end: '11:55' }
  ],
  S: [
    { day: 2, start: '10:30', end: '11:55' },
    { day: 5, start: '09:00', end: '10:25' }
  ],
  W: [
    { day: 1, start: '12:00', end: '13:30' },
    { day: 4, start: '12:00', end: '13:30' }
  ],
  X: [
    { day: 1, start: '13:30', end: '15:00' },
    { day: 4, start: '13:30', end: '15:00' }
  ],
  Y: [
    { day: 2, start: '12:00', end: '13:30' },
    { day: 5, start: '12:00', end: '13:30' }
  ],
  Z: [
    { day: 2, start: '13:30', end: '15:00' },
    { day: 5, start: '13:30', end: '15:00' }
  ]
};

const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

// IST = UTC + 5h30m = 330 minutes
const IST_OFFSET_MIN = 330;

/**
 * Convert a UTC "HH:mm" string to an IST "HH:mm" string.
 * Used only for building the schedules array so that all consumers
 * (SchedulerContext, autoSessionService, CourseView UI) see IST times,
 * which is what they all expect.
 *
 * e.g. "03:30" UTC -> "09:00" IST
 *      "22:30" UTC -> "04:00" IST (next calendar day, but schedules only care about HH:mm)
 */
function utcToISTString(utcTime) {
  const [hh, mm] = utcTime.split(':').map(Number);
  const totalMin = hh * 60 + mm + IST_OFFSET_MIN;
  const istMin   = totalMin % (24 * 60); // wrap around midnight
  const ih = Math.floor(istMin / 60);
  const im = istMin % 60;
  return `${String(ih).padStart(2, '0')}:${String(im).padStart(2, '0')}`;
}

/**
 * Given a course (with slot, startDate, endDate), generate:
 *
 *  lectures[]  — one entry per scheduled class day between startDate and endDate.
 *                scheduledTime is stored as UTC (SLOT_MAP times are already UTC).
 *
 *  schedules[] — one entry per slot window, with startTime/endTime as IST strings
 *                so the frontend and SchedulerContext (which work in IST) are correct.
 */
function populateLectures(course) {
  const slotWindows = SLOT_MAP[course.slot] || [];
  const lectures  = [];
  const schedules = [];

  // Build schedules array — convert UTC slot times to IST strings
  for (const w of slotWindows) {
    schedules.push({
      scheduledDay: DAY_NAMES[w.day],
      startTime:    utcToISTString(w.start),  // e.g. "03:30" UTC -> "09:00" IST
      endTime:      utcToISTString(w.end),    // e.g. "04:25" UTC -> "09:55" IST
      method:       'BLE',
      switch:       false,
    });
  }

  // Walk every day from startDate to endDate using UTC date arithmetic
  // so the server's local timezone never shifts the calendar day.
  const startD = new Date(course.startDate);
  const endD   = new Date(course.endDate);

  let cursorUtcMs = Date.UTC(
    startD.getUTCFullYear(),
    startD.getUTCMonth(),
    startD.getUTCDate()
  );
  const endUtcMs  = Date.UTC(
    endD.getUTCFullYear(),
    endD.getUTCMonth(),
    endD.getUTCDate()
  );
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;

  while (cursorUtcMs <= endUtcMs) {
    const cursorDate = new Date(cursorUtcMs);
    const dow = cursorDate.getUTCDay(); // 0=Sun...6=Sat

    for (const w of slotWindows) {
      if (w.day === dow) {
        const [hh, mm] = w.start.split(':').map(Number);

        // SLOT_MAP is already UTC, so use setUTCHours directly.
        const scheduledTime = new Date(cursorUtcMs);
        scheduledTime.setUTCHours(hh, mm, 0, 0);

        lectures.push({
          lectureUID:    uuidv4(),
          scheduledTime, // correct UTC timestamp
          cancelled:     false,
        });
      }
    }
    cursorUtcMs += ONE_DAY_MS;
  }

  return { lectures, schedules };
}

module.exports = { populateLectures, SLOT_MAP };