import { createContext, useContext, useEffect, useRef } from "react";
import { useAuth } from "./AuthContext";
import { getCourses, getActiveSession, startSession, endSession } from "../api/client";

const SchedulerContext = createContext(null);

// ── Timezone helpers ──────────────────────────────────────────────────────────

/**
 * Returns the current time in IST as { dayIdx, nowMin }
 * dayIdx: 0=Sun … 6=Sat (IST day)
 * nowMin: minutes since midnight IST
 */
function nowIST() {
  const nowUTC = new Date();
  // Convert to IST string, then re-parse to get IST calendar values
  const istString = nowUTC.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
  const ist = new Date(istString);
  return {
    dayIdx: ist.getDay(),
    nowMin: ist.getHours() * 60 + ist.getMinutes(),
  };
}

/**
 * Schedule time is stored as "HH:MM" in IST (local to the user).
 * Convert schedule time + day to { startMin, endMin } in IST minutes.
 */
function scheduleWindow(sch) {
  const [hh, mm] = sch.time.split(":").map(Number);
  const startMin = hh * 60 + mm;
  const endMin   = startMin + Number(sch.duration);
  return { startMin, endMin };
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function SchedulerProvider({ children }) {
  const { user }   = useAuth();
  const stateRef   = useRef({ courses: [] });

  useEffect(() => {
    if (!user || user.role !== "prof") return;

    async function tick() {
      // 1. Refresh course list
      try {
        const res = await getCourses(user.user_id);
        stateRef.current.courses = res.data;
      } catch {
        return; // If we can't load courses, skip this tick
      }

      const { dayIdx, nowMin } = nowIST();

      for (const course of stateRef.current.courses) {
        const schedules = loadSchedules(course.id);
        if (!schedules.length) continue;

        // Current active session for this course
        let activeSess = null;
        try {
          const r = await getActiveSession(course.id);
          if (r.data?.session_id) activeSess = r.data;
        } catch {}

        // Find the schedule window that should be active right now (IST)
        const activeWindow = schedules.find(sch => {
          if (!sch.enabled) return false;
          if (Number(sch.day) !== dayIdx) return false;
          const { startMin, endMin } = scheduleWindow(sch);
          return nowMin >= startMin && nowMin < endMin;
        });

        const schedulerKey = `scheduler_sess_${course.id}`;

        if (activeWindow && !activeSess) {
          // Should be running — start it
          try {
            const res = await startSession({ course_id: course.id, mode: activeWindow.mode });
            if (res.data?.session_id) {
              localStorage.setItem(schedulerKey, String(res.data.session_id));
            }
          } catch {}

        } else if (!activeWindow && activeSess) {
          // Outside any scheduled window — end only if this was scheduler-started
          const schedulerSessId = localStorage.getItem(schedulerKey);
          if (schedulerSessId && String(activeSess.session_id) === schedulerSessId) {
            try {
              await endSession(activeSess.session_id);
            } catch {}
            localStorage.removeItem(schedulerKey);
          }

        } else if (activeWindow && activeSess) {
          // Running and should be — ensure ownership is tracked
          const schedulerSessId = localStorage.getItem(schedulerKey);
          if (!schedulerSessId) {
            // Not yet tracked; it may have been started by scheduler on a previous tab
            localStorage.setItem(schedulerKey, String(activeSess.session_id));
          }
        }
      }
    }

    // Run immediately, then every 30 seconds
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

// ── Shared schedule helpers (used by both SchedulerProvider and CourseView) ──

export function loadSchedules(courseId) {
  try {
    return JSON.parse(localStorage.getItem(`schedules_${courseId}`) || "[]");
  } catch {
    return [];
  }
}

export function saveSchedules(courseId, list) {
  localStorage.setItem(`schedules_${courseId}`, JSON.stringify(list));
}

export const useScheduler = () => useContext(SchedulerContext);