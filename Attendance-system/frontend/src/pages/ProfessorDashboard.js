import { useEffect, useState } from "react";
import { getCourses, getActiveSession, getProfAnalytics } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { StatCard, Badge, Empty, Spinner } from "../components/UI";
import { BookOpen, Users, Activity, TrendingUp, ChevronRight, Wifi, QrCode, Layers } from "lucide-react";

const COURSE_COLORS = [
  "bg-azure-500", "bg-jade-500", "bg-violet-500",
  "bg-amber-500", "bg-rose-500",
];

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  return "evening";
}

const ModeIcon = ({ mode }) => {
  if (mode === "ble")    return <Wifi size={12} />;
  if (mode === "qr")     return <QrCode size={12} />;
  if (mode === "hybrid") return <Layers size={12} />;
  return null;
};

export default function ProfessorDashboard({ setPage, setActiveCourse }) {
  const { user }   = useAuth();
  const [courses,  setCourses]  = useState([]);
  const [sessions, setSessions] = useState({});
  const [loading,  setLoading]  = useState(true);
  const [stats,    setStats]    = useState({
    totalStudents: 0,
    avgAttendance: 0,
  });

  useEffect(() => {
    async function load() {
      try {
        const courseRes = await getCourses(user.user_id);
        setCourses(courseRes.data);

        // Active session status for each course
        const sessionMap = {};
        await Promise.all(courseRes.data.map(async (c) => {
          try {
            const s = await getActiveSession(c.id);
            sessionMap[c.id] = s.data;
          } catch {
            sessionMap[c.id] = null;
          }
        }));
        setSessions(sessionMap);

        // Real avg attendance from prof analytics
        try {
          const analytics = await getProfAnalytics(user.user_id);
          const data = analytics.data; // [{course_id, sessions, attendance, avg}]

          const totalSessions  = data.reduce((s, c) => s + c.sessions, 0);
          const totalAttendance = data.reduce((s, c) => s + c.attendance, 0);
          const avgAttendance  = totalSessions > 0
            ? totalAttendance / totalSessions
            : 0;

          // Unique students across all courses (rough: sum unique per course)
          // We'll use enrollment-based count via getCourseStudents indirectly
          // For the dashboard summary, we just show avg marks per session
          setStats({
            totalStudents: 0, // will be updated below
            avgAttendance,
          });
        } catch {}

      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user.user_id]);

  const activeSessions = Object.values(sessions).filter(Boolean).length;

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Spinner size={28} />
    </div>
  );

  return (
    <div className="space-y-8">
      {/* Greeting */}
      <div className="animate-slide-up">
        <h1 className="text-snow text-2xl font-bold tracking-tight">
          Good {getGreeting()}, {user.name.split(" ")[0]} 👋
        </h1>
        <p className="text-soft text-sm mt-1">
          Here's what's happening with your courses today.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard label="My Courses"      value={courses.length}                       icon={BookOpen}    color="azure"  delay={0}   />
        <StatCard label="Active Sessions" value={activeSessions}                        icon={Activity}    color="jade"   delay={80}  />
        <StatCard
          label="Avg Attendance / Session"
          value={stats.avgAttendance.toFixed(1)}
          icon={TrendingUp}
          color="amber"
          delay={160}
          sub="marks per session across all courses"
        />
      </div>

      {/* Recent Courses — quick access */}
      <div className="animate-slide-up" style={{ animationDelay: "200ms" }}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-snow font-semibold">Your Courses</h2>
          <button
            onClick={() => setPage("courses")}
            className="text-azure-400 text-xs hover:text-azure-300 transition-colors font-medium"
          >
            Manage →
          </button>
        </div>

        {courses.length === 0 ? (
          <Empty icon={BookOpen} title="No courses assigned"
            sub="Courses will appear here once assigned by admin." />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {courses.map((c, i) => {
              const active = sessions[c.id];
              return (
                <div
                  key={c.id}
                  onClick={() => { setActiveCourse(c); setPage("courses"); }}
                  className="animate-slide-up bg-card border border-edge hover:border-azure-500/40
                    rounded-2xl p-5 cursor-pointer group transition-all duration-200 hover:shadow-glow"
                  style={{ animationDelay: `${300 + i * 80}ms` }}
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