import { useState, useEffect } from "react";
import { getCourses, getAttendance, getActiveSession } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { Search, Users, CheckCircle2, Clock } from "lucide-react";
import { Badge, Spinner, Empty } from "../components/UI";

// Parse UTC ISO string correctly (backend omits 'Z')
function formatIST(utcStr) {
  if (!utcStr) return "—";
  const s = utcStr.endsWith("Z") || utcStr.includes("+") ? utcStr : utcStr + "Z";
  return new Date(s).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
}

function formatISTTime(utcStr) {
  if (!utcStr) return "—";
  const s = utcStr.endsWith("Z") || utcStr.includes("+") ? utcStr : utcStr + "Z";
  return new Date(s).toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function Students() {
  const { user }     = useAuth();
  const [courses,    setCourses]    = useState([]);
  const [selected,   setSelected]   = useState(null);
  const [records,    setRecords]    = useState([]);
  const [query,      setQuery]      = useState("");
  const [loading,    setLoading]    = useState(true);
  const [loadingRec, setLoadingRec] = useState(false);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await getCourses(user.user_id);
        setCourses(res.data);
        if (res.data.length > 0) setSelected(res.data[0]);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user.user_id]);

  useEffect(() => {
    if (!selected) return;
    async function loadRecords() {
      setLoadingRec(true);
      try {
        const sess = await getActiveSession(selected.id).catch(() => null);
        if (sess?.data?.session_id) {
          setHasSession(true);
          const att = await getAttendance(sess.data.session_id);
          setRecords(att.data);
        } else {
          setHasSession(false);
          setRecords([]);
        }
      } finally {
        setLoadingRec(false);
      }
    }
    loadRecords();
    const t = setInterval(loadRecords, 5000);
    return () => clearInterval(t);
  }, [selected]);

  const filtered = records.filter(r =>
    String(r.student_id).includes(query)
  );
  const unique = new Set(records.map(r => r.student_id)).size;
  const lastRecord = records.length > 0 ? records[records.length - 1] : null;

  if (loading) return (
    <div className="flex items-center justify-center h-64"><Spinner size={28} /></div>
  );

  return (
    <div className="space-y-6">
      <div className="animate-slide-up">
        <h1 className="text-snow text-2xl font-bold tracking-tight">Students</h1>
        <p className="text-soft text-sm mt-1">Live attendance records for active sessions</p>
      </div>

      {/* Course selector */}
      <div className="flex flex-wrap gap-2 animate-slide-up" style={{ animationDelay: "80ms" }}>
        {courses.map(c => (
          <button
            key={c.id}
            onClick={() => { setSelected(c); setQuery(""); }}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all border
              ${selected?.id === c.id
                ? "bg-azure-500/15 text-azure-400 border-azure-500/30"
                : "bg-card text-soft border-edge hover:text-snow hover:border-dim"}`}
          >
            {c.name}
          </button>
        ))}
      </div>

      {selected && (
        <div className="animate-slide-up" style={{ animationDelay: "160ms" }}>

          {/* No active session notice */}
          {!hasSession && (
            <div className="mb-4 flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3">
              <Clock size={14} className="text-amber-400 shrink-0" />
              <p className="text-amber-300 text-sm">No active session for {selected.name}. Start a session to track attendance.</p>
            </div>
          )}

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-card border border-edge rounded-2xl p-4 text-center">
              <p className="text-soft text-xs uppercase tracking-widest mb-1">Checked In</p>
              <p className="text-snow text-3xl font-bold">{unique}</p>
            </div>
            <div className="bg-card border border-edge rounded-2xl p-4 text-center">
              <p className="text-soft text-xs uppercase tracking-widest mb-1">Total Marks</p>
              <p className="text-snow text-3xl font-bold">{records.length}</p>
            </div>
            <div className="bg-card border border-edge rounded-2xl p-4 text-center">
              <p className="text-soft text-xs uppercase tracking-widest mb-1">Last Mark (IST)</p>
              <p className="text-snow text-lg font-bold font-mono">
                {lastRecord ? formatISTTime(lastRecord.timestamp) : "—"}
              </p>
            </div>
          </div>

          {/* Search */}
          <div className="relative mb-4 max-w-sm">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-dim" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search by student ID..."
              className="w-full bg-card border border-edge rounded-xl text-sm text-snow placeholder:text-dim
                focus:outline-none focus:border-azure-500 transition-all pl-10 pr-4 py-2.5"
            />
          </div>

          {/* Table */}
          <div className="bg-card border border-edge rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-edge flex items-center justify-between">
              <h2 className="text-snow font-semibold text-sm">Attendance Log</h2>
              <div className="flex items-center gap-2">
                {loadingRec && <Spinner size={14} />}
                <span className="text-soft text-xs font-mono">{filtered.length} records</span>
              </div>
            </div>

            {filtered.length === 0 ? (
              <Empty icon={Users} title="No records yet"
                sub={records.length === 0 ? "Start a session to begin tracking." : "No matching students."} />
            ) : (
              <div className="divide-y divide-edge">
                {filtered.map((r, i) => (
                  <div key={i}
                    className="flex items-center gap-4 px-5 py-3.5 hover:bg-white/2 transition-colors animate-slide-up"
                    style={{ animationDelay: `${i * 30}ms` }}
                  >
                    <div className="w-9 h-9 rounded-xl bg-azure-500/15 flex items-center justify-center shrink-0">
                      <span className="text-azure-400 text-sm font-bold">
                        {String(r.student_id).slice(-2)}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-snow text-sm font-medium">Student #{r.student_id}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Clock size={11} className="text-dim" />
                        <span className="text-soft text-xs font-mono">{formatIST(r.timestamp)}</span>
                      </div>
                    </div>
                    <CheckCircle2 size={16} className="text-jade-400 shrink-0" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}