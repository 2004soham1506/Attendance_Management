/**
 * Students.js — Professor "Students" page.
 *
 * Fixes:
 *  - HistoryModal now uses /student/:id/history/:courseId which returns
 *    lecture-based history (intersection rule). The heatmap is built from
 *    lectures, not raw sessions, so the colour logic matches reality.
 *  - The heatmap previously crashed because buildDayMap expected s.start_time
 *    but the history endpoint returns l.scheduledTime.
 *  - Active session tab now shows all sessions for the current lecture
 *    (activeSessions[] from /activeSession) not just the primary one.
 *  - Roster tab search works by name AND student ID.
 */
import { useState, useEffect, useCallback } from "react";
import { getCourses, getActiveSession, getCourseStudents } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { Search, Users, CheckCircle2, Clock, CalendarDays, X, Wifi, QrCode } from "lucide-react";
import { Badge, Spinner, Empty, ProgressBar } from "../components/UI";
import API from "../api/client";

// ── IST helpers ───────────────────────────────────────────────────────────────

function toZ(s) {
  if (!s) return s;
  return s.endsWith("Z") || s.includes("+") ? s : s + "Z";
}

function formatIST(utcStr) {
  if (!utcStr) return "—";
  return new Date(toZ(utcStr)).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
}

function formatISTTime(utcStr) {
  if (!utcStr) return "—";
  return new Date(toZ(utcStr)).toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit", minute: "2-digit",
  });
}

function toISTDate(utcStr) {
  if (!utcStr) return null;
  return new Date(new Date(toZ(utcStr)).toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
}

// ── Heatmap helpers ───────────────────────────────────────────────────────────
// Now uses lecture-based history (each entry = one lecture).

function buildDayMap(lectureHistory) {
  const map = {};
  for (const l of lectureHistory) {
    // scheduledTime from the /history endpoint
    const d = toISTDate(l.scheduledTime);
    if (!d) continue;
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
    if (!map[key]) map[key] = { total: 0, attended: 0 };
    map[key].total += 1;
    if (l.attended) map[key].attended += 1;
  }
  return map;
}

function buildCalendarWeeks(dayMap) {
  if (Object.keys(dayMap).length === 0) return [];
  const dateKeys  = Object.keys(dayMap).sort();
  const firstDate = new Date(dateKeys[0] + "T00:00:00");
  const today     = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  today.setHours(0, 0, 0, 0);

  const start = new Date(firstDate);
  start.setDate(start.getDate() - start.getDay()); // go back to Sunday

  const end = new Date(today);
  end.setDate(end.getDate() + (6 - end.getDay())); // forward to Saturday

  const weeks = [];
  let   week  = [];
  const cur   = new Date(start);

  while (cur <= end) {
    const key = `${cur.getFullYear()}-${String(cur.getMonth()+1).padStart(2,"0")}-${String(cur.getDate()).padStart(2,"0")}`;
    week.push({
      key,
      day:     cur.getDate(),
      month:   cur.getMonth(),
      isToday: cur.toDateString() === today.toDateString(),
      data:    dayMap[key] || null,
    });
    if (cur.getDay() === 6) { weeks.push(week); week = []; }
    cur.setDate(cur.getDate() + 1);
  }
  if (week.length > 0) weeks.push(week);
  return weeks;
}

function cellColor(data) {
  if (!data || data.total === 0) return "bg-edge";
  const ratio = data.attended / data.total;
  if (ratio === 0)    return "bg-rose-500/30";  // lecture day, didn't attend
  if (ratio < 1)      return "bg-jade-500/40";  // partial (multi-session)
  return "bg-jade-500";                          // fully attended
}

function cellTitle(data, key) {
  if (!data || data.total === 0) return `${key} — no lecture`;
  return `${key}: ${data.attended}/${data.total} lecture${data.total !== 1 ? "s" : ""} attended`;
}

// ── Student History Modal ─────────────────────────────────────────────────────

function HistoryModal({ student, course, onClose }) {
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState(null);
  const [error,   setError]   = useState(null);
  const [tooltip, setTooltip] = useState(null);

  useEffect(() => {
    API.get(`/student/${student.id}/history/${course.id}`)
      .then(r => setHistory(r.data))
      .catch(() => setError("Could not load attendance history."))
      .finally(() => setLoading(false));
  }, [student.id, course.id]);

  const weeks   = history ? buildCalendarWeeks(buildDayMap(history.history || [])) : [];
  const MONTHS  = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const WEEKDAYS = ["S","M","T","W","T","F","S"];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
      <div className="bg-card border border-edge rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-edge flex items-center justify-between shrink-0">
          <div>
            <p className="text-snow font-semibold text-sm">{student.name}</p>
            <p className="text-soft text-xs font-mono mt-0.5">{course.name}</p>
          </div>
          <button onClick={onClose} className="text-dim hover:text-snow p-1 rounded-lg hover:bg-white/5 transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-5">
          {loading ? (
            <div className="flex justify-center py-12"><Spinner size={24} /></div>
          ) : error ? (
            <p className="text-rose-400 text-sm text-center py-8">{error}</p>
          ) : history ? (
            <>
              {/* Summary */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Lectures Attended", value: history.attended },
                  { label: "Total Lectures",    value: history.total    },
                  {
                    label: "Attendance %",
                    value: <span className={`font-mono font-bold ${
                      history.percentage >= 75 ? "text-jade-400"
                      : history.percentage >= 60 ? "text-amber-400"
                      : "text-rose-400"
                    }`}>{history.percentage}%</span>,
                  },
                ].map((s, i) => (
                  <div key={i} className="bg-ink border border-edge rounded-xl p-3 text-center">
                    <p className="text-soft text-xs uppercase tracking-widest mb-1">{s.label}</p>
                    <p className="text-snow text-lg font-bold">{s.value}</p>
                  </div>
                ))}
              </div>

              {/* Attendance progress bar */}
              <ProgressBar value={history.percentage} max={100} size="lg" />

              {/* Calendar heatmap */}
              {weeks.length > 0 && (
                <div>
                  <p className="text-soft text-xs font-medium mb-2">Lecture calendar</p>
                  {/* Weekday headers */}
                  <div className="grid grid-cols-7 gap-0.5 mb-1">
                    {WEEKDAYS.map((d, i) => (
                      <div key={i} className="text-center text-dim text-xs">{d}</div>
                    ))}
                  </div>

                  <div className="space-y-0.5 relative"
                    onMouseLeave={() => setTooltip(null)}>
                    {weeks.map((week, wi) => (
                      <div key={wi} className="grid grid-cols-7 gap-0.5">
                        {week.map((day, di) => (
                          <div
                            key={di}
                            title={cellTitle(day.data, day.key)}
                            onMouseEnter={e => {
                              if (day.data) setTooltip({
                                text: cellTitle(day.data, day.key),
                                x: e.clientX, y: e.clientY,
                              });
                            }}
                            className={`
                              w-full aspect-square rounded-sm cursor-default transition-opacity
                              ${cellColor(day.data)}
                              ${day.isToday ? "ring-1 ring-azure-400" : ""}
                            `}
                          />
                        ))}
                      </div>
                    ))}
                  </div>

                  {/* Legend */}
                  <div className="flex items-center gap-3 mt-2 text-xs text-dim">
                    <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-jade-500" />Attended</div>
                    <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-rose-500/30" />Absent</div>
                    <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm bg-edge" />No lecture</div>
                  </div>
                </div>
              )}

              {/* Per-lecture detail */}
              {history.history?.length > 0 && (
                <div>
                  <p className="text-soft text-xs font-medium mb-2">Lecture-by-lecture breakdown</p>
                  <div className="divide-y divide-edge border border-edge rounded-xl max-h-56 overflow-y-auto">
                    {history.history.map((l, i) => (
                      <div key={i} className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/2 transition-colors">
                        <div className={`w-2 h-2 rounded-full shrink-0 ${l.attended ? "bg-jade-400" : "bg-rose-400"}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-snow text-xs font-medium">
                            {l.scheduledTime
                              ? new Date(toZ(l.scheduledTime)).toLocaleString("en-IN", {
                                  timeZone: "Asia/Kolkata",
                                  day: "2-digit", month: "short",
                                  hour: "2-digit", minute: "2-digit", hour12: true,
                                })
                              : "—"}
                          </p>
                          {l.sessions?.length > 0 && (
                            <p className="text-dim text-xs font-mono">
                              {l.sessions.map(s =>
                                `${s.method}: ${s.marked ? "✓" : "✗"}`
                              ).join(" | ")}
                            </p>
                          )}
                        </div>
                        <span className={`text-xs font-medium ${l.attended ? "text-jade-400" : "text-rose-400"}`}>
                          {l.attended ? "Present" : "Absent"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-[60] bg-ink border border-edge rounded-lg px-3 py-1.5 text-xs text-snow pointer-events-none"
          style={{ left: tooltip.x + 12, top: tooltip.y - 24 }}
        >
          {tooltip.text}
        </div>
      )}
    </div>
  );
}

// ── Active session attendance panel ──────────────────────────────────────────

function LiveAttendancePanel({ course, activeSessions }) {
  const [records,    setRecords]    = useState([]);
  const [query,      setQuery]      = useState("");
  const [loadingRec, setLoadingRec] = useState(false);

  const primarySession = activeSessions?.[0];

  const fetchRecords = useCallback(async () => {
    if (!primarySession) return;
    setLoadingRec(true);
    try {
      const r = await API.get(`/attendance/${primarySession.session_id}`);
      setRecords(r.data);
    } catch {}
    finally { setLoadingRec(false); }
  }, [primarySession?.session_id]);

  useEffect(() => {
    fetchRecords();
    const t = setInterval(fetchRecords, 3000);
    return () => clearInterval(t);
  }, [fetchRecords]);

  const filtered = records.filter(r =>
    (r.studentName || "").toLowerCase().includes(query.toLowerCase()) ||
    String(r.student_id || r.student || "").includes(query)
  );

  const uniqueStudents = new Set(records.map(r => r.student_id || r.student)).size;
  const lastRecord     = records.length > 0 ? records[records.length - 1] : null;

  if (!primarySession) return (
    <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 mb-4">
      <Clock size={14} className="text-amber-400 shrink-0" />
      <p className="text-amber-300 text-sm">No active session for {course.name}.</p>
    </div>
  );

  const ModeIcon = ({ method }) => {
    if (method === "BLE" || method === "ble") return <Wifi size={11} className="text-azure-400" />;
    if (method === "QRCode" || method === "qr") return <QrCode size={11} className="text-jade-400" />;
    return null;
  };

  return (
    <div className="space-y-4">
      {/* Active sessions info */}
      <div className="flex flex-wrap gap-2">
        {activeSessions.map((s, i) => (
          <div key={i} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-jade-500/10 border border-jade-500/20 text-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-jade-400 animate-pulse" />
            <ModeIcon method={s.method} />
            <span className="text-jade-400 font-mono">{s.method}</span>
            <span className="text-dim">since {formatISTTime(s.startedAt)}</span>
          </div>
        ))}
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card border border-edge rounded-xl p-3 text-center">
          <p className="text-soft text-xs uppercase tracking-widest mb-0.5">Checked In</p>
          <p className="text-snow text-2xl font-bold">{uniqueStudents}</p>
        </div>
        <div className="bg-card border border-edge rounded-xl p-3 text-center">
          <p className="text-soft text-xs uppercase tracking-widest mb-0.5">Total Marks</p>
          <p className="text-snow text-2xl font-bold">{records.length}</p>
        </div>
        <div className="bg-card border border-edge rounded-xl p-3 text-center">
          <p className="text-soft text-xs uppercase tracking-widest mb-0.5">Last Mark</p>
          <p className="text-snow text-base font-bold font-mono">
            {lastRecord ? formatISTTime(lastRecord.markedAt || lastRecord.timestamp) : "—"}
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-dim" />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search by name or ID…"
          className="w-full bg-card border border-edge rounded-xl text-sm text-snow placeholder:text-dim
            focus:outline-none focus:border-azure-500 transition-all pl-10 pr-4 py-2.5"
        />
      </div>

      {/* Log */}
      <div className="bg-card border border-edge rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-edge flex items-center justify-between">
          <h3 className="text-snow font-semibold text-sm">Live Attendance Log</h3>
          <div className="flex items-center gap-2">
            {loadingRec && <Spinner size={13} />}
            <span className="text-soft text-xs font-mono">{filtered.length} entries</span>
          </div>
        </div>
        {filtered.length === 0 ? (
          <Empty icon={Users} title="No attendance yet"
            sub="Records appear as students check in." />
        ) : (
          <div className="divide-y divide-edge max-h-72 overflow-y-auto">
            {filtered.slice().reverse().map((r, i) => (
              <div key={i} className="flex items-center gap-3 px-5 py-3 hover:bg-white/2 transition-colors">
                <div className="w-8 h-8 rounded-xl bg-azure-500/15 flex items-center justify-center shrink-0">
                  <span className="text-azure-400 text-xs font-bold">
                    {(r.studentName || "?").charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-snow text-sm font-medium">{r.studentName || `Student ${r.student_id || r.student}`}</p>
                  <p className="text-soft text-xs font-mono">{formatIST(r.markedAt || r.timestamp)}</p>
                </div>
                <Badge label={r.verifiedVia || "Marked"} variant="live" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Students page ────────────────────────────────────────────────────────

export default function Students() {
  const { user }         = useAuth();
  const [courses,        setCourses]        = useState([]);
  const [selected,       setSelected]       = useState(null);
  const [roster,         setRoster]         = useState([]);
  const [activeSessions, setActiveSessions] = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [loadingRoster,  setLoadingRoster]  = useState(false);
  const [rosterQuery,    setRosterQuery]    = useState("");
  const [activeTab,      setActiveTab]      = useState("live"); // "live" | "roster"
  const [viewStudent,    setViewStudent]    = useState(null);

  // ── Load courses ──────────────────────────────────────────────────────────
  useEffect(() => {
    getCourses(user.user_id)
      .then(r => {
        setCourses(r.data);
        if (r.data.length > 0) setSelected(r.data[0]);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user.user_id]);

  // ── Poll active sessions for selected course ───────────────────────────────
  // Reduced from 5s to 10s to minimize server load
  useEffect(() => {
    if (!selected) return;
    const poll = async () => {
      try {
        const r = await getActiveSession(selected.id);
        setActiveSessions(r.data?.activeSessions || (r.data?.session_id ? [r.data] : []));
      } catch {
        setActiveSessions([]);
      }
    };
    poll();
    const t = setInterval(poll, 10000);
    return () => clearInterval(t);
  }, [selected?.id]);

  // ── Load roster for selected course ───────────────────────────────────────
  useEffect(() => {
    if (!selected) return;
    setLoadingRoster(true);
    getCourseStudents(selected.id)
      .then(r => setRoster(r.data))
      .catch(() => setRoster([]))
      .finally(() => setLoadingRoster(false));
  }, [selected?.id]);

  const filteredRoster = roster.filter(s =>
    s.name.toLowerCase().includes(rosterQuery.toLowerCase()) ||
    String(s.id || s._id).toLowerCase().includes(rosterQuery.toLowerCase())
  );

  if (loading) return (
    <div className="flex items-center justify-center h-64"><Spinner size={28} /></div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="animate-slide-up">
        <h1 className="text-snow text-2xl font-bold tracking-tight">Students</h1>
        <p className="text-soft text-sm mt-1">Live session attendance and per-student lecture history</p>
      </div>

      {/* Course selector */}
      <div className="flex flex-wrap gap-2 animate-slide-up" style={{ animationDelay: "60ms" }}>
        {courses.map(c => (
          <button key={c.id}
            onClick={() => { setSelected(c); setRosterQuery(""); setActiveTab("live"); }}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all border
              ${selected?.id === c.id
                ? "bg-azure-500/15 text-azure-400 border-azure-500/30"
                : "bg-card text-soft border-edge hover:text-snow hover:border-dim"}`}
          >
            {c.name}
            {c.isTA && <span className="ml-1.5 text-amber-400 text-xs">[TA]</span>}
          </button>
        ))}
      </div>

      {selected && (
        <div className="animate-slide-up" style={{ animationDelay: "120ms" }}>
          {/* Tab switcher */}
          <div className="flex gap-1 mb-5 border-b border-edge">
            {[
              { id: "live",   label: "Live Session" },
              { id: "roster", label: `Roster (${roster.length})` },
            ].map(tab => (
              <button key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px
                  ${activeTab === tab.id
                    ? "border-azure-400 text-azure-400"
                    : "border-transparent text-soft hover:text-snow"}`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Live tab */}
          {activeTab === "live" && (
            <LiveAttendancePanel
              course={selected}
              activeSessions={activeSessions}
            />
          )}

          {/* Roster tab */}
          {activeTab === "roster" && (
            <div className="bg-card border border-edge rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-edge flex items-center justify-between">
                <h2 className="text-snow font-semibold text-sm">Enrolled Students</h2>
                <div className="flex items-center gap-3">
                  {loadingRoster && <Spinner size={14} />}
                  <span className="text-soft text-xs font-mono">{filteredRoster.length} students</span>
                </div>
              </div>

              {/* Search */}
              <div className="px-5 py-3 border-b border-edge">
                <div className="relative max-w-sm">
                  <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-dim" />
                  <input
                    value={rosterQuery}
                    onChange={e => setRosterQuery(e.target.value)}
                    placeholder="Search by name or ID…"
                    className="w-full bg-ink border border-edge rounded-xl text-sm text-snow placeholder:text-dim
                      focus:outline-none focus:border-azure-500 transition-all pl-10 pr-4 py-2"
                  />
                </div>
              </div>

              {filteredRoster.length === 0 ? (
                <Empty icon={Users} title="No students found"
                  sub={roster.length === 0 ? "No students enrolled." : "No matching students."} />
              ) : (
                <div className="divide-y divide-edge max-h-[500px] overflow-y-auto">
                  {filteredRoster.map(s => (
                    <button
                      key={s.id || s._id}
                      onClick={() => setViewStudent(s)}
                      className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-white/2 transition-colors text-left group"
                    >
                      <div className="w-9 h-9 rounded-xl bg-violet-500/15 flex items-center justify-center shrink-0 border border-violet-500/20 group-hover:border-violet-500/40 transition-colors">
                        <span className="text-violet-400 text-sm font-bold">
                          {(s.name || "?").charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-snow text-sm font-medium">{s.name}</p>
                        <p className="text-soft text-xs font-mono mt-0.5">ID: {s.id || s._id}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-dim text-xs group-hover:text-violet-400 transition-colors">
                          View history
                        </span>
                        <CalendarDays size={14} className="text-dim group-hover:text-violet-400 transition-colors" />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* History modal */}
      {viewStudent && selected && (
        <HistoryModal
          student={viewStudent}
          course={selected}
          onClose={() => setViewStudent(null)}
        />
      )}
    </div>
  );
}