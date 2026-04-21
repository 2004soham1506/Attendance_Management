import { createContext, useContext, useEffect, useRef } from "react";
import { useAuth } from "./AuthContext";
import { getCourses, getActiveSession, startSession, endSession, getCourseSchedules } from "../api/client";

const SchedulerContext = createContext(null);

// ── Timezone helpers ──────────────────────────────────────────────────────────

/**
 * B8 FIX — nowIST()
 *
 * Old implementation parsed a locale string as a new Date():
 *   const ist = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
 *   return { dayIdx: ist.getDay(), nowMin: ist.getHours() * 60 + ist.getMinutes() };
 *
 * This is implementation-defined: V8 happens to parse the en-US locale string
 * as local time (not UTC), which gives the right wall-clock fields — but only
 * because the parsed Date's UTC epoch equals the IST wall-clock time numerically.
 * It breaks if the host locale changes or on non-V8 runtimes.
 *
 * Fixed: use Intl.DateTimeFormat.formatToParts(), which is guaranteed by spec
 * to return the correct civil time fields for the given timeZone.
 */
const IST_WEEKDAY_TO_IDX = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
};

function nowIST() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone:  "Asia/Kolkata",
    weekday:   "short",   // "Mon", "Tue" …
    hour:      "numeric", // 0-23 when hour12: false
    minute:    "numeric",
    hour12:    false,
  }).formatToParts(new Date());

  const get     = (type) => parseInt(parts.find(p => p.type === type)?.value ?? "0", 10);
  const weekday = parts.find(p => p.type === "weekday")?.value ?? "Sun";

  // hour "24" can appear for midnight in some Intl implementations — clamp to 0
  const hour = get("hour") % 24;

  return {
    dayIdx: IST_WEEKDAY_TO_IDX[weekday] ?? 0,
    nowMin: hour * 60 + get("minute"),
  };
}

const DAY_TO_IDX = {
  Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3,
  Thursday: 4, Friday: 5, Saturday: 6,
};

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // 19 800 000 ms

/**
 * Given the course's lectures array and the current IST time, find the lecture
 * whose scheduledTime (stored as UTC) falls within ±30 min of now.
 *
 * scheduledTime in DB is UTC.  We add IST_OFFSET_MS to get the IST epoch,
 * then read its UTC fields — which equal the IST civil time fields.
 */
function findActiveLecture(lectures, nowMin, dayIdx) {
  const WINDOW_MIN = 30;

  const candidates = (lectures || [])
    .filter(l => !l.cancelled)
    .map(l => {
      const istMs     = new Date(l.scheduledTime).getTime() + IST_OFFSET_MS;
      const istD      = new Date(istMs);
      const lecDayIdx = istD.getUTCDay();
      const lecMin    = istD.getUTCHours() * 60 + istD.getUTCMinutes();
      const diff      = Math.abs(lecMin - nowMin);
      return { ...l, lecDayIdx, lecMin, diff };
    })
    .filter(l => l.lecDayIdx === dayIdx && l.diff <= WINDOW_MIN)
    .sort((a, b) => a.diff - b.diff);

  return candidates[0] || null;
}

// ── Provider ──────────────────────────────────────────────────────────────────
export function SchedulerProvider({ children }) {
  const { user }  = useAuth();
  const stateRef  = useRef({ courses: [], scheduleCache: {} });

  useEffect(() => {
    if (!user || (user.role !== "prof" && user.role !== "ta")) return;

    async function tick() {
      try {
        const res = await getCourses(user.user_id);
        stateRef.current.courses = res.data;
      } catch {
        return;
      }

      const { dayIdx, nowMin } = nowIST();

      for (const course of stateRef.current.courses) {
        const cacheKey   = course.id || course._id;
        const cacheEntry = stateRef.current.scheduleCache[cacheKey];
        const CACHE_TTL  = 5 * 60 * 1000;
        let schedules    = cacheEntry?.data || [];

        if (!cacheEntry || Date.now() - cacheEntry.fetchedAt > CACHE_TTL) {
          try {
            const r = await getCourseSchedules(cacheKey);
            schedules = r.data || [];
            stateRef.current.scheduleCache[cacheKey] = { data: schedules, fetchedAt: Date.now() };
          } catch {
            schedules = [];
          }
        }

        if (!schedules.length) continue;

        let activeSess = null;
        try {
          const r = await getActiveSession(cacheKey);
          if (r.data?.session_id) activeSess = r.data;
        } catch {}

        // Find a schedule window active right now (switch must be ON)
        const activeWindow = schedules.find(sch => {
          if (!sch.switch) return false;
          const schDayIdx = DAY_TO_IDX[sch.scheduledDay];
          if (schDayIdx !== dayIdx) return false;
          const [sh, sm] = sch.startTime.split(":").map(Number);
          const [eh, em] = sch.endTime.split(":").map(Number);
          return nowMin >= sh * 60 + sm && nowMin < eh * 60 + em;
        });

        const schedulerKey = `scheduler_sess_${cacheKey}`;

        if (activeWindow && !activeSess) {
          const activeLecture = findActiveLecture(course.lectures, nowMin, dayIdx);
          const method = activeWindow.method || "BLE";
          try {
            const res = await startSession({
              course_id: cacheKey,
              mode:      method,
              ...(activeLecture ? { lectureUID: activeLecture.lectureUID } : {}),
            });
            if (res.data?.session_id) {
              sessionStorage.setItem(schedulerKey, String(res.data.session_id));
            }
          } catch (e) {
            if (e.response?.status === 409 && e.response?.data?.session_id) {
              sessionStorage.setItem(schedulerKey, String(e.response.data.session_id));
            }
          }

        } else if (!activeWindow && activeSess) {
          const schedulerSessId = sessionStorage.getItem(schedulerKey);
          if (schedulerSessId && String(activeSess.session_id) === schedulerSessId) {
            try { await endSession(activeSess.session_id); } catch {}
            sessionStorage.removeItem(schedulerKey);
          }

        } else if (activeWindow && activeSess) {
          const schedulerSessId = sessionStorage.getItem(schedulerKey);
          if (!schedulerSessId) {
            sessionStorage.setItem(schedulerKey, String(activeSess.session_id));
          }
        }
      }
    }

    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [user]);

  return (
    <SchedulerContext.Provider value={null}>
      {children}
    </SchedulerContext.Provider>
  );
}

export const useScheduler = () => useContext(SchedulerContext);