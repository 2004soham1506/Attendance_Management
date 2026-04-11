import { useState, useEffect } from "react";
import {
  getCourses, getCourseAnalytics, getProfAnalytics,
  getAdminAnalytics, getAtRiskStudents, getCourseStudentStats,
} from "../api/client";
import { useAuth } from "../context/AuthContext";
import {
  BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line,
} from "recharts";
import {
  BarChart3, TrendingUp, Users, Activity, AlertTriangle,
  GraduationCap, ChevronDown, ChevronUp, BookOpen,
} from "lucide-react";
import { StatCard, ProgressBar, AttendancePct, Spinner, Empty } from "../components/UI";

// ── Helpers ───────────────────────────────────────────────────────────────────
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

const COURSE_COLORS = ["bg-azure-500","bg-jade-500","bg-violet-500","bg-amber-500","bg-rose-500"];
const BAR_COLORS    = ["#3B82F6","#34D399","#8B5CF6","#FBBF24","#FB7185"];
const DAY_LABELS    = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

// ── Lecture timeline for one course ──────────────────────────────────────────
function LectureTimeline({ courseId }) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [open,    setOpen]    = useState(false);

  useEffect(() => {
    getCourseAnalytics(courseId)
      .then(r => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [courseId]);

  if (loading) return <div className="flex justify-center py-4"><Spinner size={16} /></div>;
  if (!data)   return null;

  const held = data.lectureStats?.filter(l => l.hasSession) || [];
  if (held.length === 0) return (
    <p className="text-dim text-xs py-3 text-center">No lectures held yet.</p>
  );

  return (
    <div>
      <button onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 text-xs text-dim hover:text-soft transition-colors py-2">
        {open ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        {open ? "Hide" : "Show"} lecture breakdown ({held.length} held)
      </button>
      {open && (
        <div className="space-y-1 max-h-64 overflow-y-auto mt-1">
          {held.map((l, i) => (
            <div key={i} className="flex items-center gap-3 py-1.5 px-2 rounded-lg hover:bg-white/2">
              <span className="text-dim text-xs font-mono w-20 shrink-0">
                {new Date(l.scheduledTime).toLocaleDateString("en-IN", {
                  timeZone: "Asia/Kolkata", day: "2-digit", month: "short",
                })}
              </span>
              <div className="flex-1">
                <ProgressBar value={l.attendancePct} max={100} />
              </div>
              <span className="text-soft text-xs font-mono w-20 text-right shrink-0">
                {l.attended}/{l.enrolled} ({l.attendancePct}%)
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Per-course student table ──────────────────────────────────────────────────
function CourseStudentTable({ courseId, courseName }) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCourseStudentStats(courseId)
      .then(r => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [courseId]);

  if (loading) return <div className="flex justify-center py-6"><Spinner size={18} /></div>;
  if (!data)   return <p className="text-dim text-sm text-center py-4">Could not load.</p>;

  return (
    <div className="space-y-2">
      <p className="text-soft text-xs font-mono">
        {data.enrolled} enrolled · {data.totalLectures} lectures held
      </p>
      <div className="divide-y divide-edge rounded-xl border border-edge overflow-hidden max-h-64 overflow-y-auto">
        {data.studentStats.length === 0 ? (
          <p className="text-soft text-sm text-center py-6">No students enrolled.</p>
        ) : data.studentStats.map((s, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-2.5 bg-ink hover:bg-white/2 transition-colors">
            <div className="w-7 h-7 rounded-lg bg-azure-500/15 flex items-center justify-center shrink-0">
              <span className="text-azure-400 text-xs font-bold">{s.name.charAt(0)}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-snow text-xs font-medium truncate">{s.name}</p>
              <p className="text-dim text-xs font-mono truncate">{s.student_id}</p>
            </div>
            <div className="w-20 shrink-0">
              <ProgressBar value={s.attendancePct} max={100} />
            </div>
            <AttendancePct value={s.attendancePct} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── At-Risk card ──────────────────────────────────────────────────────────────
function AtRiskCard({ profId }) {
  const [data,    setData]    = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAtRiskStudents(profId)
      .then(r => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [profId]);

  return (
    <div className="bg-card border border-edge rounded-2xl p-6">
      <div className="flex items-center gap-2 mb-1">
        <AlertTriangle size={14} className="text-rose-400" />
        <h2 className="text-snow font-semibold text-sm">At-Risk Students</h2>
      </div>
      <p className="text-soft text-xs mb-4">Below 75% lecture attendance in any course</p>

      {loading ? (
        <div className="flex items-center justify-center h-32"><Spinner size={20} /></div>
      ) : data.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 h-32">
          <Users size={20} className="text-jade-400" />
          <p className="text-soft text-xs text-center">No at-risk students 🎉</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {data.map((s, i) => (
            <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl bg-ink border border-edge hover:border-rose-500/20 transition-colors">
              <div className="w-7 h-7 rounded-lg bg-rose-500/15 flex items-center justify-center shrink-0 border border-rose-500/20">
                <span className="text-rose-400 text-xs font-bold">{s.student_name.charAt(0)}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-snow text-xs font-medium truncate">{s.student_name}</p>
                <p className="text-dim text-xs font-mono truncate">{s.course_name}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-rose-400 text-xs font-bold font-mono">{s.pct}%</p>
                <p className="text-dim text-xs font-mono">{s.attended}/{s.total}</p>
              </div>
            </div>
          ))}
        </div>
      )}
      {!loading && data.length > 0 && (
        <p className="text-dim text-xs font-mono mt-3 pt-3 border-t border-edge">
          {data.length} student{data.length !== 1 ? "s" : ""} flagged
        </p>
      )}
    </div>
  );
}

// ── Prof / TA Analytics view ──────────────────────────────────────────────────
function ProfAnalyticsView({ user }) {
  const [loading,  setLoading]  = useState(true);
  const [courses,  setCourses]  = useState([]);
  const [profData, setProfData] = useState([]);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const [cRes, pRes] = await Promise.all([
          getCourses(user.user_id),
          getProfAnalytics(user.user_id),
        ]);
        setCourses(cRes.data);
        setProfData(pRes.data);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user]);

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner size={28} /></div>;

  const totalSessions   = profData.reduce((s, c) => s + c.sessions, 0);
  const totalAttendance = profData.reduce((s, c) => s + c.attendance, 0);
  const totalLectures   = profData.reduce((s, c) => s + c.lectures, 0);

  const barData = profData.map(c => ({
    name:    c.course_name.length > 12 ? c.course_name.slice(0, 12) + "…" : c.course_name,
    avg_pct: c.avg_pct,
    sessions: c.sessions,
    lectures: c.lectures,
  }));

  return (
    <div className="space-y-8">
      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Lectures Held"    value={totalSessions}   icon={Activity}   color="azure" delay={0}   />
        <StatCard label="Total Lectures"   value={totalLectures}   icon={BookOpen}   color="violet" delay={80} />
        <StatCard label="Avg Marks/Lecture"
          value={(totalSessions > 0 ? totalAttendance / totalSessions : 0).toFixed(1)}
          icon={TrendingUp} color="jade" delay={160} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Bar chart */}
        <div className="lg:col-span-2 bg-card border border-edge rounded-2xl p-6 animate-slide-up">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-snow font-semibold text-sm">Avg Attendance % per Course</h2>
              <p className="text-soft text-xs mt-0.5">Lecture-based: attended / enrolled</p>
            </div>
            <BarChart3 size={16} className="text-dim" />
          </div>
          {barData.length === 0 ? (
            <Empty icon={BarChart3} title="No data yet" sub="Start sessions to see data here." />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={barData} barSize={24}>
                <XAxis dataKey="name" tick={{ fill: "#6B7499", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#6B7499", fontSize: 11 }} axisLine={false} tickLine={false} domain={[0,100]}
                  tickFormatter={v => `${v}%`} />
                <Tooltip content={<DarkTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
                <Bar dataKey="avg_pct" name="Avg Attendance %" radius={[6,6,0,0]}>
                  {barData.map((_, i) => <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* At-risk */}
        <AtRiskCard profId={user.user_id} />
      </div>

      {/* Per-course breakdown with student table drill-down */}
      {profData.length > 0 && (
        <div className="bg-card border border-edge rounded-2xl overflow-hidden animate-slide-up">
          <div className="px-5 py-4 border-b border-edge">
            <h2 className="text-snow font-semibold text-sm">Course Breakdown</h2>
            <p className="text-soft text-xs mt-0.5">Click a course to see per-student and per-lecture stats</p>
          </div>
          <div className="divide-y divide-edge">
            {profData.map((c, i) => (
              <div key={c.course_id}>
                <button
                  onClick={() => setExpanded(expanded === c.course_id ? null : c.course_id)}
                  className="w-full flex items-center gap-4 px-5 py-4 hover:bg-white/2 transition-colors text-left"
                >
                  <div className={`w-2 h-8 rounded-full shrink-0 ${COURSE_COLORS[i % COURSE_COLORS.length]}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-snow text-sm font-medium">{c.course_name}</p>
                    <p className="text-soft text-xs mt-0.5">
                      {c.sessions} lectures held · {c.lectures} total · {c.enrolled} enrolled
                    </p>
                  </div>
                  <div className="w-28 shrink-0">
                    <ProgressBar value={c.avg_pct} max={100} />
                  </div>
                  <AttendancePct value={c.avg_pct} />
                  {expanded === c.course_id
                    ? <ChevronUp size={14} className="text-dim shrink-0" />
                    : <ChevronDown size={14} className="text-dim shrink-0" />}
                </button>

                {/* Expanded: lecture timeline + student table */}
                {expanded === c.course_id && (
                  <div className="px-5 pb-5 space-y-4 border-t border-edge bg-ink animate-slide-up">
                    <LectureTimeline courseId={c.course_id} />
                    <CourseStudentTable courseId={c.course_id} courseName={c.course_name} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Admin Analytics view ──────────────────────────────────────────────────────
function AdminAnalyticsView() {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    getAdminAnalytics()
      .then(r => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner size={28} /></div>;
  if (!data) return (
    <div className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl px-5 py-4">
      <AlertTriangle size={16} className="text-amber-400" />
      <p className="text-amber-300 text-sm">Could not load admin analytics.</p>
    </div>
  );

  const { totals, profs } = data;
  const allCourses = profs.flatMap(p => p.courses.map(c => ({
    name:    c.name.length > 12 ? c.name.slice(0, 12) + "…" : c.name,
    avg_pct: c.avg_pct,
    prof:    p.prof_name.split(" ").slice(-1)[0],
    sessions: c.sessions,
    enrolled: c.enrolled,
  })));

  return (
    <div className="space-y-8">
      {/* Totals */}
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: "Sessions",   value: totals.sessions,   color: "text-azure-400"  },
          { label: "Att. Marks", value: totals.attendance, color: "text-jade-400"   },
          { label: "Avg/Session",value: totals.avg,        color: "text-violet-400" },
          { label: "Students",   value: totals.students,   color: "text-amber-400"  },
          { label: "Courses",    value: totals.courses,    color: "text-rose-400"   },
          { label: "Professors", value: totals.profs,      color: "text-snow"       },
        ].map((s, i) => (
          <div key={i} className="bg-card border border-edge rounded-2xl p-4 text-center animate-slide-up"
            style={{ animationDelay: `${i * 40}ms` }}>
            <p className="text-soft text-xs uppercase tracking-widest mb-1">{s.label}</p>
            <p className={`text-2xl font-bold font-mono ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Bar chart */}
      <div className="bg-card border border-edge rounded-2xl p-6 animate-slide-up" style={{ animationDelay: "80ms" }}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-snow font-semibold text-sm">Avg Attendance % per Course</h2>
            <p className="text-soft text-xs mt-0.5">Lecture-based across all professors</p>
          </div>
          <BarChart3 size={16} className="text-dim" />
        </div>
        {allCourses.length === 0 ? (
          <Empty icon={BarChart3} title="No course data" sub="Start sessions to see data." />
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={allCourses} barSize={24}>
              <XAxis dataKey="name" tick={{ fill: "#6B7499", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#6B7499", fontSize: 11 }} axisLine={false} tickLine={false} domain={[0,100]}
                tickFormatter={v => `${v}%`} />
              <Tooltip content={<DarkTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
              <Bar dataKey="avg_pct" name="Avg Attendance %" radius={[6,6,0,0]}>
                {allCourses.map((_, i) => <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Per-professor breakdown with course drill-down */}
      {profs.map((prof, pi) => (
        <div key={prof.prof_id} className="bg-card border border-edge rounded-2xl overflow-hidden animate-slide-up"
          style={{ animationDelay: `${160 + pi * 60}ms` }}>
          <div className="px-5 py-4 border-b border-edge flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-violet-500/15 border border-violet-500/20 flex items-center justify-center">
              <GraduationCap size={14} className="text-violet-400" />
            </div>
            <div>
              <p className="text-snow font-semibold text-sm">{prof.prof_name}</p>
              <p className="text-soft text-xs font-mono">{prof.courses.length} course{prof.courses.length !== 1 ? "s" : ""}</p>
            </div>
          </div>
          {prof.courses.length === 0 ? (
            <p className="text-soft text-sm text-center py-6">No courses assigned.</p>
          ) : (
            <div className="divide-y divide-edge">
              {prof.courses.map((c, ci) => (
                <div key={c.course_id}>
                  <button
                    onClick={() => setExpanded(expanded === `${prof.prof_id}-${c.course_id}` ? null : `${prof.prof_id}-${c.course_id}`)}
                    className="w-full flex items-center gap-4 px-5 py-4 hover:bg-white/2 transition-colors text-left"
                  >
                    <div className={`w-2 h-8 rounded-full shrink-0 ${COURSE_COLORS[ci % COURSE_COLORS.length]}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-snow text-sm font-medium">{c.name}</p>
                      <p className="text-soft text-xs mt-0.5">{c.sessions} held · {c.enrolled} enrolled</p>
                    </div>
                    <div className="w-28 shrink-0">
                      <ProgressBar value={c.avg_pct} max={100} />
                    </div>
                    <AttendancePct value={c.avg_pct} />
                    {expanded === `${prof.prof_id}-${c.course_id}`
                      ? <ChevronUp size={14} className="text-dim shrink-0" />
                      : <ChevronDown size={14} className="text-dim shrink-0" />}
                  </button>

                  {expanded === `${prof.prof_id}-${c.course_id}` && (
                    <div className="px-5 pb-5 border-t border-edge bg-ink animate-slide-up space-y-4">
                      <LectureTimeline courseId={c.course_id} />
                      <CourseStudentTable courseId={c.course_id} courseName={c.name} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────
export default function Analytics() {
  const { user } = useAuth();

  return (
    <div className="space-y-8">
      <div className="animate-slide-up">
        <h1 className="text-snow text-2xl font-bold tracking-tight">Analytics</h1>
        <p className="text-soft text-sm mt-1">
          {user.role === "admin"
            ? "System-wide attendance breakdown — lecture as unit"
            : "Attendance insights across your courses — lecture as unit"}
        </p>
      </div>
      {user.role === "admin" ? <AdminAnalyticsView /> : <ProfAnalyticsView user={user} />}
    </div>
  );
}