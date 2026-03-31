import { useState, useEffect } from "react";
import { getAdminStats, getCourses, getCourseAnalytics, getProfAnalytics } from "../api/client";
import { useAuth } from "../context/AuthContext";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell,
} from "recharts";
import { BarChart3, TrendingUp, Users, Activity } from "lucide-react";
import { StatCard, ProgressBar, AttendancePct, Spinner, Empty } from "../components/UI";

// ── Helpers ───────────────────────────────────────────────────────────────────

// Parse UTC ISO string correctly (backend stores UTC without 'Z')
function parseUTC(str) {
  if (!str) return null;
  // Append 'Z' only if no timezone info present
  const s = str.endsWith("Z") || str.includes("+") ? str : str + "Z";
  return new Date(s);
}

// Format date to IST locale string
function toIST(str) {
  const d = parseUTC(str);
  if (!d) return "—";
  return d.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
}

// ── Dark tooltip ──────────────────────────────────────────────────────────────
const DarkTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-edge rounded-xl px-3 py-2.5 text-xs shadow-float">
      <p className="text-snow font-medium mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>{p.name}: {p.value}</p>
      ))}
    </div>
  );
};

const PIE_COLORS  = ["#34D399", "#FBBF24", "#FB7185"];
const COURSE_COLORS = ["bg-azure-500","bg-jade-500","bg-violet-500","bg-amber-500","bg-rose-500"];

// ── Days of week (IST-aware trend) ───────────────────────────────────────────
const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function buildTrendData(allSessions) {
  // Group sessions by IST day-of-week; compute average unique attendance
  const byDay = {};
  DAY_LABELS.forEach((d, i) => { byDay[i] = { total: 0, sessions: 0 }; });

  allSessions.forEach(s => {
    const d = parseUTC(s.start_time);
    if (!d) return;
    // Convert to IST
    const ist = new Date(d.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
    const dow = ist.getDay();
    byDay[dow].total    += s.unique_students;
    byDay[dow].sessions += 1;
  });

  // Return Mon-Sat (skip Sun if no data)
  return [1,2,3,4,5,6].map(i => ({
    day: DAY_LABELS[i],
    pct: byDay[i].sessions > 0
      ? Math.round(byDay[i].total / byDay[i].sessions)
      : null,
  })).filter(d => d.pct !== null);
}

function buildPieData(courseAnalytics) {
  // courseAnalytics: [{course_id, sessions: [{unique_students, total_enrolled?}]}]
  // We'll bucket courses by their overall avg unique / enrolled
  // Without enrolled count, bucket by raw avg unique attendance per session
  let high = 0, mid = 0, low = 0;
  courseAnalytics.forEach(({ sessions, enrolled }) => {
    if (!sessions.length) return;
    const avgUnique = sessions.reduce((s, x) => s + x.unique_students, 0) / sessions.length;
    const pct = enrolled > 0 ? (avgUnique / enrolled) * 100 : null;

    if (pct === null) return;
    if (pct >= 75)    high++;
    else if (pct >= 60) mid++;
    else              low++;
  });

  const total = high + mid + low;
  if (total === 0) return null;
  return [
    { name: "≥75%",   value: Math.round((high / total) * 100) },
    { name: "60–75%", value: Math.round((mid  / total) * 100) },
    { name: "<60%",   value: Math.round((low  / total) * 100) },
  ];
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function Analytics() {
  const { user }  = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats,   setStats]   = useState(null);   // admin only
  const [courses, setCourses] = useState([]);
  const [profData, setProfData] = useState([]);   // prof analytics array
  const [courseSessionMap, setCourseSessionMap] = useState({}); // courseId → sessions[]
  const [enrolledMap, setEnrolledMap] = useState({});           // courseId → enrolled count

  useEffect(() => {
    async function load() {
      try {
        if (user.role === "admin") {
          const s = await getAdminStats();
          setStats(s.data);
          return;
        }

        // Professor flow
        const cRes = await getCourses(user.user_id);
        setCourses(cRes.data);

        // Prof-level analytics (avg per course)
        const pRes = await getProfAnalytics(user.user_id);
        setProfData(pRes.data);

        // Per-course session detail (for trend + bar chart)
        const sessMap   = {};
        const enrollMap = {};
        await Promise.all(cRes.data.map(async (c) => {
          try {
            const r = await getCourseAnalytics(c.id);
            sessMap[c.id]   = r.data.sessions;
            enrollMap[c.id] = r.data.enrolled ?? 0;
          } catch {
            sessMap[c.id]   = [];
            enrollMap[c.id] = 0;
          }
        }));
        setCourseSessionMap(sessMap);
        setEnrolledMap(enrollMap);

      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user]);

  if (loading) return (
    <div className="flex items-center justify-center h-64"><Spinner size={28} /></div>
  );

  // ── Chart data ─────────────────────────────────────────────────────────────
  const barData = courses.map(c => {
    const sessions = courseSessionMap[c.id] || [];
    return {
      name:    c.name.length > 10 ? c.name.slice(0, 10) + "…" : c.name,
      unique:  Math.round(sessions.reduce((s, x) => s + x.unique_students, 0) / (sessions.length || 1)),
      total:   Math.round(sessions.reduce((s, x) => s + x.total_marks, 0) / (sessions.length || 1)),
    };
  });

  // Flatten all sessions for trend
  const allSessions = Object.values(courseSessionMap).flat();
  const trendData   = buildTrendData(allSessions);

  // Pie data from real data
  const pieInput = courses.map(c => ({
    sessions: courseSessionMap[c.id] || [],
    enrolled: enrolledMap[c.id] || 0,
  }));
  const pieData = buildPieData(pieInput) || [
    { name: "≥75%", value: 50 }, { name: "60–75%", value: 30 }, { name: "<60%", value: 20 },
  ];

  return (
    <div className="space-y-8">
      <div className="animate-slide-up">
        <h1 className="text-snow text-2xl font-bold tracking-tight">Analytics</h1>
        <p className="text-soft text-sm mt-1">Attendance insights across your courses</p>
      </div>

      {/* Admin-only global stats */}
      {user.role === "admin" && stats && (
        <div className="grid grid-cols-3 gap-4">
          <StatCard label="Total Sessions"   value={stats.sessions}                        icon={Activity}   color="azure"  delay={0}   />
          <StatCard label="Total Attendance" value={stats.attendance}                      icon={Users}      color="jade"   delay={80}  />
          <StatCard label="Avg per Session"  value={stats.avg_attendance?.toFixed(1) ?? 0} icon={TrendingUp} color="amber"  delay={160} />
        </div>
      )}

      {/* Prof-level summary */}
      {user.role !== "admin" && profData.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <StatCard
            label="Total Sessions"
            value={profData.reduce((s, c) => s + c.sessions, 0)}
            icon={Activity} color="azure" delay={0}
          />
          <StatCard
            label="Total Attendance Marks"
            value={profData.reduce((s, c) => s + c.attendance, 0)}
            icon={Users} color="jade" delay={80}
          />
          <StatCard
            label="Avg Marks / Session"
            value={(
              profData.reduce((s, c) => s + c.attendance, 0) /
              (profData.reduce((s, c) => s + c.sessions, 0) || 1)
            ).toFixed(1)}
            icon={TrendingUp} color="amber" delay={160}
          />
        </div>
      )}

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Bar chart — avg unique attendance per session per course */}
        <div className="lg:col-span-2 bg-card border border-edge rounded-2xl p-6 animate-slide-up" style={{ animationDelay: "100ms" }}>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-snow font-semibold text-sm">Avg Attendance per Session</h2>
              <p className="text-soft text-xs mt-0.5">Unique students &amp; total marks, averaged per session</p>
            </div>
            <BarChart3 size={16} className="text-dim" />
          </div>
          {barData.length === 0 ? (
            <Empty icon={BarChart3} title="No data yet" sub="Start sessions to see data here." />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={barData} barSize={20} barGap={6}>
                <XAxis dataKey="name" tick={{ fill: "#6B7499", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#6B7499", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<DarkTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                <Bar dataKey="unique" name="Avg Unique Students" fill="#3B82F6" radius={[6,6,0,0]} />
                <Bar dataKey="total"  name="Avg Total Marks"     fill="#8B5CF6" radius={[6,6,0,0]} fillOpacity={0.6} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Pie — attendance distribution across courses */}
        <div className="bg-card border border-edge rounded-2xl p-6 animate-slide-up" style={{ animationDelay: "180ms" }}>
          <h2 className="text-snow font-semibold text-sm mb-1">Course Distribution</h2>
          <p className="text-soft text-xs mb-4">Courses by avg attendance bracket</p>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value" paddingAngle={4}>
                {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
              </Pie>
              <Tooltip content={<DarkTooltip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-2 mt-2">
            {pieData.map((d, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ background: PIE_COLORS[i] }} />
                  <span className="text-soft">{d.name}</span>
                </div>
                <span className="text-snow font-mono">{d.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Trend line — avg unique attendance by day of week (IST) */}
      <div className="bg-card border border-edge rounded-2xl p-6 animate-slide-up" style={{ animationDelay: "260ms" }}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-snow font-semibold text-sm">Weekly Trend</h2>
            <p className="text-soft text-xs mt-0.5">
              Avg unique students per session by day of week (IST) — computed from historical sessions
            </p>
          </div>
          <TrendingUp size={16} className="text-dim" />
        </div>
        {trendData.length === 0 ? (
          <Empty icon={TrendingUp} title="Not enough data" sub="Run sessions on multiple days to see the trend." />
        ) : (
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={trendData}>
              <XAxis dataKey="day" tick={{ fill: "#6B7499", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#6B7499", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<DarkTooltip />} />
              <Line
                type="monotone" dataKey="pct" name="Avg Unique Students"
                stroke="#3B82F6" strokeWidth={2.5}
                dot={{ fill: "#3B82F6", r: 4, strokeWidth: 0 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Per-course breakdown table */}
      {profData.length > 0 && (
        <div className="bg-card border border-edge rounded-2xl overflow-hidden animate-slide-up" style={{ animationDelay: "340ms" }}>
          <div className="px-5 py-4 border-b border-edge">
            <h2 className="text-snow font-semibold text-sm">Course Breakdown</h2>
          </div>
          <div className="divide-y divide-edge">
            {profData.map((c, i) => {
              const avgPct = c.sessions > 0
                ? Math.min(100, (c.avg / (enrolledMap[c.course_id] || Math.max(c.avg, 1))) * 100)
                : 0;
              return (
                <div key={c.course_id} className="flex items-center gap-4 px-5 py-4 hover:bg-white/2 transition-colors">
                  <div className={`w-2 h-8 rounded-full ${COURSE_COLORS[i % COURSE_COLORS.length]}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-snow text-sm font-medium">{c.course_name}</p>
                    <p className="text-soft text-xs mt-0.5">
                      {c.sessions} sessions · {c.attendance} total marks · avg {c.avg} / session
                    </p>
                  </div>
                  <div className="w-32">
                    <ProgressBar value={avgPct} max={100} />
                  </div>
                  <AttendancePct value={avgPct} />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}