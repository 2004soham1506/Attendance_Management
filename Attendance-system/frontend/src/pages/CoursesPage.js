import { useEffect, useState } from "react";
import { getCourses, getActiveSession } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { Badge, Empty, Spinner } from "../components/UI";
import { BookOpen, ChevronRight, Wifi, QrCode, Layers } from "lucide-react";

const COURSE_COLORS = [
  "bg-azure-500", "bg-jade-500", "bg-violet-500",
  "bg-amber-500", "bg-rose-500",
];

export default function CoursesPage({ setActiveCourse }) {
  const { user }   = useAuth();
  const [courses,  setCourses]  = useState([]);
  const [sessions, setSessions] = useState({});
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await getCourses(user.user_id);
        setCourses(res.data);

        const sessionMap = {};
        await Promise.all(res.data.map(async (c) => {
          try {
            const s = await getActiveSession(c.id);
            // FIX: getActiveSession returns {} (empty object) when there is no
            // active session. An empty object is truthy, which caused the LIVE
            // badge to always show. We must check for session_id explicitly.
            sessionMap[c.id] = s.data?.session_id ? s.data : null;
          } catch {
            sessionMap[c.id] = null;
          }
        }));
        setSessions(sessionMap);
      } finally {
        setLoading(false);
      }
    }
    load();
    // Reduced from 10s to 15s to minimize server load
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [user.user_id]);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Spinner size={28} />
    </div>
  );

  const ModeIcon = ({ mode }) => {
    if (mode === "ble")    return <Wifi size={12} />;
    if (mode === "qr")     return <QrCode size={12} />;
    if (mode === "hybrid") return <Layers size={12} />;
    return null;
  };

  return (
    <div className="space-y-8">
      <div className="animate-slide-up">
        <h1 className="text-snow text-2xl font-bold tracking-tight">Courses</h1>
        <p className="text-soft text-sm mt-1">
          Select a course to manage attendance sessions.
        </p>
      </div>

      <div className="animate-slide-up" style={{ animationDelay: "80ms" }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-snow font-semibold">Your Courses</h2>
          <span className="text-soft text-xs font-mono">{courses.length} total</span>
        </div>

        {courses.length === 0 ? (
          <Empty icon={BookOpen} title="No courses assigned"
            sub="Courses will appear here once assigned by admin." />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {courses.map((c, i) => {
              // FIX: sessions[c.id] is now null (not {}) when no session is active
              const active = sessions[c.id];
              return (
                <div
                  key={c.id}
                  onClick={() => setActiveCourse(c)}
                  className="animate-slide-up bg-card border border-edge hover:border-azure-500/40
                    rounded-2xl p-5 cursor-pointer group transition-all duration-200 hover:shadow-glow"
                  style={{ animationDelay: `${i * 80}ms` }}
                >
                  <div className={`w-full h-1 rounded-full mb-4 ${COURSE_COLORS[i % COURSE_COLORS.length]}`} />

                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-snow font-semibold text-sm truncate">{c.name}</h3>
                      <p className="text-soft text-xs mt-0.5 font-mono">ID: {c.id}</p>
                    </div>
                    <ChevronRight size={16} className="text-dim group-hover:text-azure-400 transition-colors mt-0.5 shrink-0" />
                  </div>

                  <div className="flex items-center justify-between">
                    {active ? (
                      <Badge label="LIVE" variant="live" />
                    ) : (
                      <Badge label="No Session" variant="ended" />
                    )}
                    {active && (
                      <div className="flex items-center gap-1 text-dim text-xs">
                        <ModeIcon mode={active.mode} />
                        <span className="font-mono uppercase">{active.mode}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}