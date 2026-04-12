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

// ── Provider ──────────────────────────────────────────────────────────────────
export function SchedulerProvider({ children }) {
  const { user }   = useAuth();
  const stateRef   = useRef({ courses: [], scheduleCache: {} });

  useEffect(() => {
    // Only run for prof and TA roles
    if (!user || (user.role !== "prof" && user.role !== "ta")) return;

    async function tick() {
      // 1. Refresh course list
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

        // 4. Find a schedule window that is active right now
        const activeWindow = schedules.find(sch => {
          if (!sch.switch) return false; // only auto-start if switch is ON
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
          // Should be running — start it.
          // FIX: Pass method as-is from the schedule (already in correct case: "BLE", "QRCode",
          // "Manual"). Previously used .toLowerCase() which produced "ble"/"qrcode" — these
          // fail the Session schema enum validation ['BLE','QRCode','Manual'], causing a
          // Mongoose error on session creation. Because the session was never saved, the
          // duplicate-guard was bypassed on the next tick, and resolveOrCreateLecture ran
          // again at a slightly different time → creating a second ad-hoc lecture entry.
          const method = activeWindow.method || "BLE";
          try {
            const res = await startSession({
              course_id: cacheKey,
              mode:      method,   // FIX: use the exact casing from schedule (BLE, QRCode, Manual)
            });
            if (res.data?.session_id) {
              sessionStorage.setItem(schedulerKey, String(res.data.session_id));
            }
          } catch (e) {
            // 409 means a session already exists for this lecture+method — that's fine,
            // record the existing session_id so we can end it when the window closes.
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