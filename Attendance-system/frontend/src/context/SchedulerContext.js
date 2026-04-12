import { createContext, useContext, useEffect, useRef } from "react";
import { useAuth } from "./AuthContext";
import { getCourses, getActiveSession, startSession, endSession, getCourseSchedules } from "../api/client";

const SchedulerContext = createContext(null);

// ── Timezone helpers ──────────────────────────────────────────────────────────
function nowIST() {
  const istString = new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
  const ist = new Date(istString);
  return { dayIdx: ist.getDay(), nowMin: ist.getHours() * 60 + ist.getMinutes() };
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
 * This is the client-side mirror of resolveOrCreateLecture's step 2.
 * By resolving the lectureUID here and passing it explicitly to startSession,
 * the backend never needs to guess and never creates an ad-hoc duplicate.
 *
 * scheduledTime in DB is UTC.  We convert to IST minutes-since-midnight to
 * match the schedule's startTime/endTime strings.
 */
function findActiveLecture(lectures, nowMin, dayIdx) {
  const WINDOW_MIN = 30; // ±30 minutes

  const candidates = (lectures || [])
    .filter(l => !l.cancelled)
    .map(l => {
      // Convert stored UTC scheduledTime → IST
      const utcMs  = new Date(l.scheduledTime).getTime();
      const istMs  = utcMs + IST_OFFSET_MS;
      const istD   = new Date(istMs);
      const lecDayIdx = istD.getUTCDay();
      const lecMin    = istD.getUTCHours() * 60 + istD.getUTCMinutes();
      const diff      = Math.abs(lecMin - nowMin);
      return { ...l, lecDayIdx, lecMin, diff };
    })
    .filter(l => l.lecDayIdx === dayIdx && l.diff <= WINDOW_MIN)
    .sort((a, b) => a.diff - b.diff);

  return candidates[0] || null; // closest match within window, or null
}

// ── Provider ──────────────────────────────────────────────────────────────────
export function SchedulerProvider({ children }) {
  const { user }   = useAuth();
  const stateRef   = useRef({ courses: [], scheduleCache: {} });

  useEffect(() => {
    // Only run for prof and TA roles
    if (!user || (user.role !== "prof" && user.role !== "ta")) return;

    async function tick() {
      // 1. Refresh course list (includes lectures[])
      try {
        const res = await getCourses(user.user_id);
        stateRef.current.courses = res.data;
      } catch {
        return;
      }

      const { dayIdx, nowMin } = nowIST();

      for (const course of stateRef.current.courses) {
        // 2. Fetch schedules from DB (cached per-course, refresh every 5 min)
        const cacheKey    = course.id || course._id;
        const cacheEntry  = stateRef.current.scheduleCache[cacheKey];
        const CACHE_TTL   = 5 * 60 * 1000;
        let schedules     = cacheEntry?.data || [];

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

        // 3. Check for active session
        let activeSess = null;
        try {
          const r = await getActiveSession(cacheKey);
          if (r.data?.session_id) activeSess = r.data;
        } catch {}

        // 4. Find a schedule window that is active right now (switch must be ON)
        const activeWindow = schedules.find(sch => {
          if (!sch.switch) return false;
          const schDayIdx = DAY_TO_IDX[sch.scheduledDay];
          if (schDayIdx !== dayIdx) return false;
          const [sh, sm] = sch.startTime.split(":").map(Number);
          const [eh, em] = sch.endTime.split(":").map(Number);
          const startMin = sh * 60 + sm;
          const endMin   = eh * 60 + em;
          return nowMin >= startMin && nowMin < endMin;
        });

        const schedulerKey = `scheduler_sess_${cacheKey}`;

        if (activeWindow && !activeSess) {
          // FIX: resolve the lectureUID on the client before calling startSession.
          // Previously no lectureUID was passed, so the backend's resolveOrCreateLecture
          // had to guess.  Under concurrent/rapid ticks both requests would see the
          // same stale course (no ad-hoc lecture yet) and each independently push a
          // new lecture → two entries with the same scheduledTime.
          //
          // By finding the matching lecture here and passing its UID explicitly, the
          // backend skips the ad-hoc creation path entirely (step 1 of
          // resolveOrCreateLecture returns immediately).  If no lecture is found
          // within ±30 min we still fall back to letting the backend handle it, but
          // that case should be rare after the lecturePopulator UTC fix.
          const activeLecture = findActiveLecture(course.lectures, nowMin, dayIdx);

          const method = activeWindow.method || "BLE";
          try {
            const res = await startSession({
              course_id:  cacheKey,
              mode:       method,
              // Pass the resolved lectureUID — backend uses it directly in step 1,
              // bypassing the find-closest / ad-hoc-create logic entirely.
              ...(activeLecture ? { lectureUID: activeLecture.lectureUID } : {}),
            });
            if (res.data?.session_id) {
              sessionStorage.setItem(schedulerKey, String(res.data.session_id));
            }
          } catch (e) {
            // 409 = session already exists for this lecture+method — record it so
            // we can end it when the window closes.
            if (e.response?.status === 409 && e.response?.data?.session_id) {
              sessionStorage.setItem(schedulerKey, String(e.response.data.session_id));
            }
          }

        } else if (!activeWindow && activeSess) {
          // Outside window — end only if this scheduler started it
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