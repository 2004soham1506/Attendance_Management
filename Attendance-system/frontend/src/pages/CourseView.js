import { useState, useEffect } from "react";
import { startSession, getQR, getAttendance, endSession, getActiveSession, manualAttendanceBulk, getCourseStudents } from "../api/client";
import { QRCodeCanvas } from "qrcode.react";
import {
  Wifi, QrCode, Layers, Play, Square, RefreshCw, Activity,
  Users, Clock, ArrowLeft, CheckCircle2, CalendarClock,
  Plus, Trash2, ToggleLeft, ToggleRight,
} from "lucide-react";
import { Button, Badge, Empty, Spinner } from "../components/UI";
import { loadSchedules, saveSchedules } from "../context/SchedulerContext";

const MODES = [
  { value: "ble",    label: "BLE Beacon", icon: Wifi    },
  { value: "qr",     label: "QR Code",    icon: QrCode  },
  { value: "hybrid", label: "Hybrid",     icon: Layers  },
];

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function makeId() { return `sch_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`; }

// ── Timezone helpers ──────────────────────────────────────────────────────────

/**
 * Backend stores timestamps as UTC but without 'Z'.
 * Append 'Z' so the browser interprets them as UTC, then format in IST.
 */
function formatIST(utcStr) {
  if (!utcStr) return "—";
  const s = utcStr.endsWith("Z") || utcStr.includes("+") ? utcStr : utcStr + "Z";
  return new Date(s).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
}

// ── Stat box ──────────────────────────────────────────────────────────────────
function StatBox({ label, value, mono }) {
  return (
    <div className="bg-card border border-edge rounded-2xl p-4 text-center">
      <p className="text-soft text-xs uppercase tracking-widest mb-1">{label}</p>
      <p className={`text-snow text-2xl font-bold ${mono ? "font-mono" : ""}`}>{value}</p>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value, mono }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-edge last:border-0">
      <div className="flex items-center gap-2">
        {Icon && <Icon size={13} className="text-dim" />}
        <span className="text-soft text-xs">{label}</span>
      </div>
      <span className={`text-snow text-sm ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function CourseView({ course, goBack }) {
  const [mode,         setMode]         = useState("ble");
  const [session,      setSession]      = useState(null);
  const [qr,           setQr]           = useState("");
  const [attendance,   setAttendance]   = useState([]);
  const [loadingStart, setLoadingStart] = useState(false);
  const [error,        setError]        = useState("");
  const [elapsed,      setElapsed]      = useState(0);

  // Schedule state
  const [schedules,   setSchedules]   = useState(() => loadSchedules(course.id));
  const [showSchForm, setShowSchForm] = useState(false);
  const [schDay,      setSchDay]      = useState(1);
  const [schTime,     setSchTime]     = useState("09:00");
  const [schDur,      setSchDur]      = useState(60);
  const [schMode,     setSchMode]     = useState("ble");

  // Manual attendance
  const [roster,   setRoster]   = useState([]);
  const [selected, setSelected] = useState(new Set());

  // ── Restore active session on mount ────────────────────────────────────────
  useEffect(() => {
    async function restore() {
      try {
        const res = await getActiveSession(course.id);
        if (res.data?.session_id) {
          setSession(res.data);
          setMode(res.data.mode || "ble");
        }
      } catch {}
    }
    restore();
  }, [course.id]);

  // ── Start ───────────────────────────────────────────────────────────────────
  const handleStart = async () => {
    setLoadingStart(true);
    setError("");
    try {
      const res = await startSession({ course_id: course.id, mode });
      setSession(res.data);
      setElapsed(0);
    } catch (e) {
      setError(e.response?.data?.error || "Could not start session.");
    } finally {
      setLoadingStart(false);
    }
  };

  // ── End ─────────────────────────────────────────────────────────────────────
  const handleEnd = async () => {
    if (!session) return;
    try { await endSession(session.session_id); } catch {}
    setSession(null);
    setQr("");
    setAttendance([]);
    setElapsed(0);
  };

  // ── Load roster ─────────────────────────────────────────────────────────────
  useEffect(() => {
    async function loadRoster() {
      try {
        const res = await getCourseStudents(course.id);
        const unique = Array.from(new Map(res.data.map(s => [s.id, s])).values());
        setRoster(unique);
      } catch {
        setRoster([]);
      }
    }
    loadRoster();
  }, [course.id]);

  // ── QR refresh ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!session || mode === "ble") return;
    const fetch = async () => {
      try { const r = await getQR(session.session_id); setQr(r.data.qr); } catch {}
    };
    fetch();
    const id = setInterval(fetch, 5000);
    return () => clearInterval(id);
  }, [session, mode]);

  // ── Attendance polling ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!session) return;
    const fetch = async () => {
      try { const r = await getAttendance(session.session_id); setAttendance(r.data); } catch {}
    };
    fetch();
    const id = setInterval(fetch, 3000);
    return () => clearInterval(id);
  }, [session]);

  // ── Elapsed timer ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!session) return;
    const t = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(t);
  }, [session]);

  // ── Manual attendance ───────────────────────────────────────────────────────
  const handleBulkMark = async () => {
    if (!session || selected.size === 0) return;
    try {
      await manualAttendanceBulk({
        session_id:  session.session_id,
        student_ids: Array.from(selected),
      });
      const r = await getAttendance(session.session_id);
      setAttendance(r.data);
      setSelected(new Set());
    } catch {}
  };

  // ── Schedule CRUD ───────────────────────────────────────────────────────────
  const addSchedule = () => {
    const updated = [...schedules, {
      id:       makeId(),
      day:      Number(schDay),
      time:     schTime,   // "HH:MM" IST — interpreted as IST by SchedulerContext
      duration: Number(schDur),
      mode:     schMode,
      enabled:  true,
    }];
    setSchedules(updated);
    saveSchedules(course.id, updated);
    setShowSchForm(false);
  };

  const toggleSchedule = (id) => {
    const updated = schedules.map(s => s.id === id ? { ...s, enabled: !s.enabled } : s);
    setSchedules(updated);
    saveSchedules(course.id, updated);
  };

  const deleteSchedule = (id) => {
    const updated = schedules.filter(s => s.id !== id);
    setSchedules(updated);
    saveSchedules(course.id, updated);
  };

  const presentStudents = new Set(attendance.map(a => a.student_id)).size;
  const totalStudents   = roster.length;
  const fmt = s => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div className="space-y-8">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4 animate-slide-up">
        <button onClick={goBack}
          className="w-9 h-9 rounded-xl bg-edge flex items-center justify-center text-soft hover:text-snow transition-colors">
          <ArrowLeft size={16} />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-snow font-bold text-xl">{course.name}</h1>
            {session && <Badge label="LIVE" variant="live" />}
          </div>
          <p className="text-soft text-xs mt-0.5 font-mono">Course ID: {course.id}</p>
        </div>
      </div>

      {error && (
        <div className="text-rose-400 text-sm bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-3">{error}</div>
      )}

      {/* ── Stats ──────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-slide-up" style={{ animationDelay: "80ms" }}>
        <StatBox label="Present"        value={presentStudents} />
        <StatBox label="Total Students" value={totalStudents} />
        <StatBox label="Total Marks"    value={attendance.length} />
        <StatBox label="Duration"       value={fmt(elapsed)} mono />
      </div>

      {/* ── Mode selector + Start / End ────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3 items-end animate-slide-up" style={{ animationDelay: "160ms" }}>
        <div className="flex gap-2">
          {MODES.map(({ value, label, icon: Icon }) => (
            <button key={value}
              onClick={() => !session && setMode(value)}
              disabled={!!session}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all border
                ${mode === value
                  ? "bg-azure-500/15 text-azure-400 border-azure-500/30"
                  : "bg-card text-soft border-edge hover:text-snow hover:border-dim disabled:opacity-40 disabled:cursor-not-allowed"}`}
            >
              <Icon size={14} />{label}
            </button>
          ))}
        </div>

        {!session ? (
          <Button onClick={handleStart} loading={loadingStart} size="md">
            <Play size={14} /> Start Session
          </Button>
        ) : (
          <Button onClick={handleEnd} variant="danger" size="md">
            <Square size={14} /> End Session
          </Button>
        )}
      </div>

      {/* ── Main grid ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* Left: QR / BLE info / placeholder */}
        <div className="lg:col-span-2 animate-slide-up" style={{ animationDelay: "200ms" }}>
          {session && (mode === "qr" || mode === "hybrid") && (
            <div className="bg-card border border-edge rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-snow font-semibold text-sm">QR Code</h3>
                <div className="flex items-center gap-1.5 text-jade-400 text-xs">
                  <RefreshCw size={11} className="animate-spin-slow" /> Refreshes every 5s
                </div>
              </div>
              {qr ? (
                <div className="flex flex-col items-center gap-4">
                  <div className="p-4 bg-white rounded-2xl">
                    <QRCodeCanvas value={qr} size={180} />
                  </div>
                </div>
              ) : <div className="flex items-center justify-center h-48"><Spinner /></div>}
            </div>
          )}

          {session && mode === "ble" && (
            <div className="bg-card border border-edge rounded-2xl p-6">
              <h3 className="text-snow font-semibold text-sm mb-4">Beacon Info</h3>
              <div className="space-y-3">
                <InfoRow icon={Wifi}     label="Mode"       value={<Badge label="BLE" variant="ble" />} />
                <InfoRow icon={Activity} label="Session ID" value={session.session_id} mono />
              </div>
              <div className="mt-4 p-3 rounded-xl bg-azure-500/8 border border-azure-500/15">
                <p className="text-azure-400 text-xs">ESP32 beacon is broadcasting. Students scan with the mobile app.</p>
              </div>
            </div>
          )}

          {!session && (
            <div className="bg-card border border-edge rounded-2xl p-6 flex flex-col items-center justify-center h-48 gap-3">
              <div className="w-12 h-12 rounded-2xl bg-edge flex items-center justify-center">
                <Play size={20} className="text-dim" />
              </div>
              <p className="text-soft text-sm text-center">Start a session to begin tracking attendance</p>
            </div>
          )}
        </div>

        {/* Right: Attendance log */}
        <div className="lg:col-span-3 animate-slide-up" style={{ animationDelay: "280ms" }}>
          <div className="bg-card border border-edge rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-edge flex items-center justify-between">
              <h3 className="text-snow font-semibold text-sm">Attendance Log</h3>
              <span className="text-soft text-xs font-mono">{attendance.length} entries</span>
            </div>

            {attendance.length === 0 ? (
              <Empty icon={Users} title="No attendance yet" sub="Records will appear as students check in." />
            ) : (
              <div className="divide-y divide-edge max-h-72 overflow-y-auto">
                {attendance.slice().reverse().map((a, i) => (
                  <div key={i} className="flex items-center gap-3 px-5 py-3 hover:bg-white/2 transition-colors">
                    <div className="w-8 h-8 rounded-xl bg-azure-500/15 flex items-center justify-center shrink-0">
                      <CheckCircle2 size={14} className="text-azure-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-snow text-sm font-medium">Student #{a.student_id}</p>
                      {/* Timestamps from backend are UTC; display in IST */}
                      <p className="text-soft text-xs font-mono">{formatIST(a.timestamp)}</p>
                    </div>
                    <Badge label="Marked" variant="live" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Manual Roll Call ────────────────────────────────────────────────── */}
      {session && (
        <div className="animate-slide-up bg-card border border-edge rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-edge">
            <h3 className="text-snow font-semibold text-sm">Manual Roll Call</h3>
          </div>
          <div className="px-5 py-4 space-y-3">
            <div className="flex justify-between items-center">
              <p className="text-xs text-soft">Select students to mark present</p>
              <button
                onClick={() => setSelected(new Set(roster.map(s => s.id)))}
                className="text-xs text-azure-400 hover:text-azure-300 transition-colors"
              >
                Select All
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
              {roster.map(s => {
                const alreadyMarked = attendance.some(a => a.student_id === s.id);
                return (
                  <label key={s.id} className={`flex items-center gap-2 text-sm ${alreadyMarked ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}>
                    <input
                      type="checkbox"
                      checked={selected.has(s.id) || alreadyMarked}
                      disabled={alreadyMarked}
                      onChange={() => {
                        if (alreadyMarked) return;
                        const newSet = new Set(selected);
                        newSet.has(s.id) ? newSet.delete(s.id) : newSet.add(s.id);
                        setSelected(newSet);
                      }}
                    />
                    <span className={alreadyMarked ? "text-jade-400" : "text-snow"}>{s.name}</span>
                    {alreadyMarked && <CheckCircle2 size={12} className="text-jade-400 shrink-0" />}
                  </label>
                );
              })}
            </div>
            <button
              onClick={handleBulkMark}
              disabled={selected.size === 0}
              className="mt-2 px-4 py-2 rounded-xl bg-amber-500 text-black text-sm font-medium
                disabled:opacity-40 disabled:cursor-not-allowed hover:bg-amber-400 transition-colors"
            >
              Mark Selected ({selected.size})
            </button>
          </div>
        </div>
      )}

      {/* ── Schedules ─────────────────────────────────────────────────────── */}
      <div className="animate-slide-up bg-card border border-edge rounded-2xl overflow-hidden" style={{ animationDelay: "380ms" }}>
        <div className="px-5 py-4 border-b border-edge flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarClock size={15} className="text-violet-400" />
            <h3 className="text-snow font-semibold text-sm">Schedules</h3>
            <span className="text-dim text-xs font-mono">auto-starts &amp; ends sessions · times in IST</span>
          </div>
          <button
            onClick={() => setShowSchForm(v => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-500/15 text-violet-400 text-xs
              hover:bg-violet-500/25 transition-colors border border-violet-500/20"
          >
            <Plus size={12} /> Add Schedule
          </button>
        </div>

        {/* Add form */}
        {showSchForm && (
          <div className="px-5 py-4 border-b border-edge bg-ink space-y-3">
            <p className="text-snow text-xs font-semibold">New recurring schedule</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-soft">Day</label>
                <select value={schDay} onChange={e => setSchDay(e.target.value)}
                  className="w-full bg-card border border-edge rounded-xl text-sm text-snow px-3 py-2
                    focus:outline-none focus:border-violet-500 transition-all appearance-none">
                  {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-soft">Start Time <span className="text-violet-400 font-mono">(IST)</span></label>
                <input type="time" value={schTime} onChange={e => setSchTime(e.target.value)}
                  className="w-full bg-card border border-edge rounded-xl text-sm text-snow px-3 py-2
                    focus:outline-none focus:border-violet-500 transition-all" />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-soft">Duration (minutes)</label>
                <input type="number" min={5} max={300} value={schDur} onChange={e => setSchDur(e.target.value)}
                  className="w-full bg-card border border-edge rounded-xl text-sm text-snow px-3 py-2
                    focus:outline-none focus:border-violet-500 transition-all" />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-soft">Mode</label>
                <select value={schMode} onChange={e => setSchMode(e.target.value)}
                  className="w-full bg-card border border-edge rounded-xl text-sm text-snow px-3 py-2
                    focus:outline-none focus:border-violet-500 transition-all appearance-none">
                  {MODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={addSchedule}
                className="px-4 py-2 rounded-xl bg-violet-500/15 text-violet-400 text-xs font-medium
                  border border-violet-500/20 hover:bg-violet-500/25 transition-colors">
                Save Schedule
              </button>
              <button onClick={() => setShowSchForm(false)}
                className="px-4 py-2 rounded-xl bg-edge text-soft text-xs hover:text-snow transition-colors">
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Schedule list */}
        {schedules.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
            <CalendarClock size={22} className="text-dim" />
            <p className="text-soft text-sm">No schedules yet</p>
            <p className="text-dim text-xs max-w-xs">
              Schedules auto-start and auto-end sessions at the set time — even when you're not on this page.
              All times are in IST (UTC+5:30).
            </p>
          </div>
        ) : (
          <div className="divide-y divide-edge">
            {schedules.map(sch => {
              const [hh, mm] = sch.time.split(":").map(Number);
              const endTotalMin = hh * 60 + mm + Number(sch.duration);
              const endH   = Math.floor(endTotalMin / 60) % 24;
              const endM   = endTotalMin % 60;
              const endStr = `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;
              return (
                <div key={sch.id}
                  className={`flex items-center gap-4 px-5 py-3.5 hover:bg-white/2 transition-colors ${!sch.enabled ? "opacity-40" : ""}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-snow text-sm font-medium">{DAYS[sch.day]}</span>
                      <span className="text-soft text-xs font-mono">{sch.time} → {endStr} IST</span>
                      <span className="text-dim text-xs">({sch.duration} min)</span>
                      <Badge
                        label={sch.mode.toUpperCase()}
                        variant={sch.mode === "ble" ? "ble" : sch.mode === "qr" ? "qr" : "hybrid"}
                      />
                      {!sch.enabled && <span className="text-dim text-xs font-mono">disabled</span>}
                    </div>
                  </div>
                  <button
                    onClick={() => toggleSchedule(sch.id)}
                    title={sch.enabled ? "Click to disable" : "Click to enable"}
                    className="transition-colors shrink-0"
                  >
                    {sch.enabled
                      ? <ToggleRight size={22} className="text-violet-400" />
                      : <ToggleLeft  size={22} className="text-dim" />}
                  </button>
                  <button onClick={() => deleteSchedule(sch.id)}
                    className="text-dim hover:text-rose-400 transition-colors shrink-0">
                    <Trash2 size={15} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}