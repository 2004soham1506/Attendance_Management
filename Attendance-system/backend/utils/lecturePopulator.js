const { v4: uuidv4 } = require('uuid');

// SLOT → days of week (0=Sun…6=Sat) + time windows
// These are example VIT-style slot mappings. Adjust to your institution.
const SLOT_MAP = {
  A:  [{ day: 1, start: '08:00', end: '08:50' }, { day: 3, start: '08:00', end: '08:50' }, { day: 5, start: '08:00', end: '08:50' }],
  B:  [{ day: 1, start: '09:00', end: '09:50' }, { day: 3, start: '09:00', end: '09:50' }, { day: 5, start: '09:00', end: '09:50' }],
  C:  [{ day: 1, start: '10:00', end: '10:50' }, { day: 3, start: '10:00', end: '10:50' }, { day: 5, start: '10:00', end: '10:50' }],
  D:  [{ day: 1, start: '11:00', end: '11:50' }, { day: 3, start: '11:00', end: '11:50' }, { day: 5, start: '11:00', end: '11:50' }],
  E:  [{ day: 2, start: '08:00', end: '08:50' }, { day: 4, start: '08:00', end: '08:50' }, { day: 6, start: '08:00', end: '08:50' }],
  F:  [{ day: 2, start: '09:00', end: '09:50' }, { day: 4, start: '09:00', end: '09:50' }, { day: 6, start: '09:00', end: '09:50' }],
  G:  [{ day: 2, start: '10:00', end: '10:50' }, { day: 4, start: '10:00', end: '10:50' }, { day: 6, start: '10:00', end: '10:50' }],
  P:  [{ day: 1, start: '14:00', end: '14:50' }, { day: 3, start: '14:00', end: '14:50' }],
  Q:  [{ day: 1, start: '15:00', end: '15:50' }, { day: 4, start: '15:00', end: '15:50' }],
  R:  [{ day: 2, start: '14:00', end: '14:50' }, { day: 5, start: '14:00', end: '14:50' }],
  S:  [{ day: 2, start: '15:00', end: '15:50' }, { day: 5, start: '15:00', end: '15:50' }],
  W:  [{ day: 3, start: '15:00', end: '15:50' }, { day: 6, start: '09:00', end: '09:50' }],
  X:  [{ day: 4, start: '09:00', end: '09:50' }, { day: 6, start: '10:00', end: '10:50' }],
  Y:  [{ day: 1, start: '16:00', end: '16:50' }, { day: 3, start: '16:00', end: '16:50' }],
  Z:  [{ day: 2, start: '16:00', end: '16:50' }, { day: 4, start: '16:00', end: '16:50' }],
};

const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

/**
 * Given a course (with slot, startDate, endDate),
 * generate the full lecture list using SLOT_MAP.
 * Also populates the `schedules` array on the course.
 */
function populateLectures(course) {
  const slotWindows = SLOT_MAP[course.slot] || [];
  const lectures = [];
  const schedules = [];

  // Build schedules array from slot windows
  for (const w of slotWindows) {
    schedules.push({
      scheduledDay: DAY_NAMES[w.day],
      startTime: w.start,
      endTime:   w.end,
      method:    'BLE',
      switch:    false,
    });
  }

  // Walk every day from startDate to endDate
  const cursor = new Date(course.startDate);
  const end    = new Date(course.endDate);
  cursor.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  while (cursor <= end) {
    const dow = cursor.getDay(); // 0=Sun…6=Sat
    for (const w of slotWindows) {
      if (w.day === dow) {
        const [hh, mm] = w.start.split(':').map(Number);
        const scheduledTime = new Date(cursor);
        scheduledTime.setHours(hh, mm, 0, 0);

        lectures.push({
          lectureUID:    uuidv4(),
          scheduledTime,
          cancelled:     false,
        });
      }
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return { lectures, schedules };
}

module.exports = { populateLectures, SLOT_MAP };