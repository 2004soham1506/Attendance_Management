import { useState, useEffect, useCallback } from "react";
import {
  startSession, getQR, getAttendance, endSession, getActiveSession,
  manualAttendanceBulk, getCourseStudents,
  getCourseSchedules, addSchedule as apiAddSchedule,
  updateSchedule as apiUpdateSchedule, deleteScheduleItem as apiDeleteSchedule,
  getMinor,
} from "../api/client";
import { QRCodeCanvas } from "qrcode.react";
import {
  Wifi, QrCode, Layers, Play, Square, RefreshCw, Activity,
  Users, Clock, ArrowLeft, CheckCircle2, CalendarClock,
  Plus, Trash2, ToggleLeft, ToggleRight, Pencil, Save, X,
  Radio, AlertCircle,
} from "lucide-react";
import { Button, Badge, Empty, Spinner } from "../components/UI";
import { useAuth } from "../context/AuthContext";

const MODES = [
  { value: "BLE",    label: "BLE Beacon", icon: Wifi   },
  { value: "QRCode", label: "QR Code",    icon: QrCode },
  { value: "Manual", label: "Manual",     icon: Users  },
];

const DAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const VALID_DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];

function formatIST(utcStr) {
  if (!utcStr) return "—";
  const s = utcStr.endsWith("Z") || utcStr.includes("+") ? utcStr : utcStr + "Z";
  return new Date(s).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
}

function StatBox({ label, value, mono }) {
  return (
    <div className="bg-card border border-edge rounded-2xl p-4 flex flex-col gap-1">
      <p className="text-soft text-xs uppercase tracking-widest">{label}</p>
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

// ── BLE Beacon Panel ──────────────────────────────────────────────────────────
// Shows live minor value fetched from the BLE microservice (via our backend proxy).
// The ESP32 also calls GET /getMinor?major=... to get its rotating minor.
function BleBeaconPanel({ session, courseId }) {
  const [minorData, setMinorData]   = useState(null);
  const [minorError, setMinorError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  // We use a placeholder major derived from the courseId as an example.
  // In a real deployment the beacon's major is its hardware bleID from the DB.
  // The professor panel shows the current minor so they can verify the beacon
  // is broadcasting the correct value.
  const exampleMajor = courseId;

  const fetchMinor = useCallback(async () => {
    setRefreshing(true);
    setMinorError("");
    try {
      const r = await getMinor(exampleMajor);
      setMinorData(r.data);
    } catch (e) {
      setMinorError(e.response?.data?.error || "Could not fetch minor from BLE service");
    } finally {
      setRefreshing(false);
    }
  }, [exampleMajor]);

  // Fetch on mount and whenever session changes
  useEffect(() => {
    if (!session) return;
    fetchMinor();
    // Refresh every 30 s (matches beacon rotation window)
    const id = setInterval(fetchMinor, 30000);
    return () => clearInterval(id);
  }, [session, fetchMinor]);

  return (
    <div className="bg-card border border-edge rounded-2xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-snow font-semibold text-sm">BLE Beacon</h3>
        <button
          onClick={fetchMinor}
          disabled={refreshing}
          className="flex items-center gap-1.5 text-dim hover:text-azure-400 transition-colors text-xs"
        >
          <RefreshCw size={12} className={refreshing ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      <div className="space-y-3">
        <InfoRow icon={Wifi}     label="Mode"       value={<Badge label="BLE" variant="ble" />} />
        <InfoRow icon={Activity} label="Session ID" value={session.session_id} mono />
        {minorData && (
          <>
            <InfoRow
              icon={Radio}
              label="Current Minor"
              value={
                <span className="font-mono text-azure-400 font-bold text-base">
                  {minorData.minor}
                  {minorData.fallback && (
                    <span className="ml-2 text-amber-400 text-xs font-normal">(local)</span>
                  )}
                </span>
              }
              mono
            />
            <InfoRow
              label="Expires in"
              value={`${minorData.expiresIn}s`}
              mono
            />
          </>
        )}
        {minorError && (
          <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
            <AlertCircle size={13} className="text-amber-400 shrink-0" />
            <p className="text-amber-300 text-xs">{minorError}</p>
          </div>
        )}
      </div>

      <div className="p-3 rounded-xl bg-azure-500/8 border border-azure-500/15 space-y-1">
        <p className="text-azure-400 text-xs font-medium">ESP32 Configuration</p>
        <p className="text-dim text-xs font-mono break-all">
          GET /getMinor?major={"{beacon_bleID}"}
        </p>
        <p className="text-dim text-xs">
          ESP32 calls this endpoint every 30 s to get the rotating minor.
          Students scan the beacon — the mobile app sends beacons + session_id
          to POST /ble/validate.
        </p>
      </div>

      {minorData?.source === "fallback" && (
        <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2.5">
          <AlertCircle size={13} className="text-amber-400 shrink-0 mt-0.5" />
          <p className="text-amber-300 text-xs">
            BLE microservice unreachable — using local HMAC fallback.
            Attendance validation will use DB beacon lookup.
          </p>
        </div>
      )}
    </div>
  );
}

// ── QR Panel ──────────────────────────────────────────────────────────────────
// Displays the QR code fetched from GET /getQR/:sessionId, which proxies to
// the QR microservice's POST /qr/generate endpoint.
function QrPanel({ session, qr, source }) {
  return (
    <div className="bg-card border border-edge rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-snow font-semibold text-sm">QR Code</h3>
        <div className="flex items-center gap-2">
          {source === "fallback" && (
            <span className="text-amber-400 text-xs font-mono">(local fallback)</span>
          )}
          <div className="flex items-center gap-1.5 text-jade-400 text-xs">
            <RefreshCw size={11} className="animate-spin-slow" /> Refreshes every 5s
          </div>
        </div>
      </div>

      {qr ? (
        <div className="flex flex-col items-center gap-4">
          {/* QR code renders the hash value returned by the service */}
          <div className="p-4 bg-white rounded-2xl">
            <QRCodeCanvas value={qr} size={180} />
          </div>
          <div className="w-full p-2.5 rounded-xl bg-ink border border-edge text-center">
            <p className="text-dim text-xs font-mono break-all">{qr}</p>
          </div>
          <p className="text-dim text-xs text-center">
            Students scan this with the mobile app. The hash rotates every 5 s.
          </p>
        </div>
      ) : (
        <div className="flex items-center justify-center h-48">
          <Spinner />
        </div>
      )}

      {source === "fallback" && (
        <div className="mt-3 flex items-start gap-2 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2.5">
          <AlertCircle size={13} className="text-amber-400 shrink-0 mt-0.5" />
          <p className="text-amber-300 text-xs">
            QR microservice unreachable — showing locally-generated token.
            Students must use the same backend for validation.
          </p>
        </div>
      )}
    </div>
  );
}

// ── Schedule row with inline edit ─────────────────────────────────────────────
function ScheduleRow({ sch, index, onToggle, onDelete, onSave, saving }) {
  const [editing, setEditing] = useState(false);
  const [form,    setForm]    = useState({
    scheduledDay: sch.scheduledDay,
    startTime:    sch.startTime,
    endTime:      sch.endTime,
    method:       sch.method,
    switch:       sch.switch,
  });

  const handleSave = async () => {
    await onSave(index, form);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="px-5 py-3 bg-ink border-b border-edge space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs text-soft">Day</label>
            <select
              value={form.scheduledDay}
              onChange={e => setForm(f => ({ ...f, scheduledDay: e.target.value }))}
              className="w-full bg-card border border-edge rounded-xl text-sm text-snow px-3 py-2 focus:outline-none focus:border-violet-500 transition-all appearance-none"
            >
              {VALID_DAYS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-soft">Method</label>
            <select
              value={form.method}
              onChange={e => setForm(f => ({ ...f, method: e.target.value }))}
              className="w-full bg-card border border-edge rounded-xl text-sm text-snow px-3 py-2 focus:outline-none focus:border-violet-500 transition-all appearance-none"
            >
              {["BLE","QRCode","Manual"].map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-soft">Start Time (IST)</label>
            <input type="time" value={form.startTime}
              onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))}
              className="w-full bg-card border border-edge rounded-xl text-sm text-snow px-3 py-2 focus:outline-none focus:border-violet-500 transition-all" />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-soft">End Time (IST)</label>
            <input type="time" value={form.endTime}
              onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))}
              className="w-full bg-card border border-edge rounded-xl text-sm text-snow px-3 py-2 focus:outline-none focus:border-violet-500 transition-all" />
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-500/15 text-violet-400 text-xs border border-violet-500/20 hover:bg-violet-500/25 transition-colors disabled:opacity-50">
            {saving ? <Spinner size={12} /> : <Save size={12} />} Save
          </button>
          <button onClick={() => setEditing(false)}
            className="px-3 py-1.5 rounded-lg bg-edge text-soft text-xs hover:text-snow transition-colors">
            Cancel
          </button>
        </div>
      </div>
    );
  }

  const methodVariant = sch.method === "BLE" ? "ble" : sch.method === "QRCode" ? "qr" : "manual";

  return (
    <div className={`flex items-center gap-4 px-5 py-3.5 hover:bg-white/2 transition-colors border-b border-edge last:border-0 ${!sch.switch ? "opacity-50" : ""}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-snow text-sm font-medium">{sch.scheduledDay}</span>
          <span className="text-soft text-xs font-mono">{sch.startTime} → {sch.endTime} IST</span>
          <Badge label={sch.method} variant={methodVariant} />
        </div>
      </div>
      {/* Pencil edit */}
      <button onClick={() => setEditing(true)} title="Edit"
        className="text-dim hover:text-violet-400 transition-colors shrink-0">
        <Pencil size={14} />
      </button>
      {/* Toggle auto-start */}
      <button onClick={() => onToggle(index)} title={sch.switch ? "Disable auto-start" : "Enable auto-start"}
        className="transition-colors shrink-0">
        {sch.switch
          ? <ToggleRight size={22} className="text-violet-400" />
          : <ToggleLeft  size={22} className="text-dim" />}
      </button>
      {/* Delete */}
      <button onClick={() => onDelete(index)}
        className="text-dim hover:text-rose-400 transition-colors shrink-0">
        <Trash2 size={15} />
      </button>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function CourseView({ course, goBack }) {
  const { user } = useAuth();
  const courseId = course.id || course._id;

  const [mode,         setMode]         = useState("BLE");
  const [session,      setSession]      = useState(null);
  const [qr,           setQr]           = useState("");
  const [qrSource,     setQrSource]     = useState("service"); // "service" | "fallback"
  const [attendance,   setAttendance]   = useState([]);
  const [loadingStart, setLoadingStart] = useState(false);
  const [error,        setError]        = useState("");
  const [elapsed,      setElapsed]      = useState(0);

  // Schedule state
  const [schedules,    setSchedules]    = useState([]);
  const [schLoading,   setSchLoading]   = useState(true);
  const [showSchForm,  setShowSchForm]  = useState(false);
  const [schSaving,    setSchSaving]    = useState(false);
  const [newSch,       setNewSch]       = useState({
    scheduledDay: "Monday", startTime: "09:00", endTime: "09:50",
    method: "BLE",
  });

  // Manual attendance
  const [roster,   setRoster]   = useState([]);
  const [selected, setSelected] = useState(new Set());

  // Read-only for TAs on schedule auto-start toggle
  const isTa = user?.role === "ta";

  // ── Load schedules from DB ────────────────────────────────────────────────
  const loadSchedules = useCallback(async () => {
    setSchLoading(true);
    try {
      const r = await getCourseSchedules(courseId);
      setSchedules(r.data || []);
    } catch {
      setSchedules([]);
    } finally {
      setSchLoading(false);
    }
  }, [courseId]);

  useEffect(() => { loadSchedules(); }, [loadSchedules]);

  // ── Restore active session on mount ──────────────────────────────────────
  useEffect(() => {
    async function restore() {
      try {
        const res = await getActiveSession(courseId);
        if (res.data?.session_id) {
          setSession(res.data);
          setMode(res.data.method || "BLE");

          const startedAt = res.data.startedAt;
          if (startedAt) {
            const startMs  = new Date(startedAt).getTime();
            const nowMs    = Date.now();
            const seconds  = Math.max(0, Math.floor((nowMs - startMs) / 1000));
            setElapsed(seconds);
          }
        }
      } catch {}
    }
    restore();
  }, [courseId]);

  // ── Session start/end ─────────────────────────────────────────────────────
  const handleStart = async () => {
    setLoadingStart(true); setError("");
    try {
      const res = await startSession({ course_id: courseId, mode });
      setSession(res.data);
      setElapsed(0);
    } catch (e) {
      setError(e.response?.data?.error || "Could not start session.");
    } finally {
      setLoadingStart(false);
    }
  };

  const handleEnd = async () => {
    if (!session) return;
    try { await endSession(session.session_id); } catch {}
    setSession(null); setQr(""); setAttendance([]); setElapsed(0);
  };

  // ── Load roster ───────────────────────────────────────────────────────────
  useEffect(() => {
    getCourseStudents(courseId)
      .then(r => setRoster(Array.from(new Map(r.data.map(s => [s.id, s])).values())))
      .catch(() => setRoster([]));
  }, [courseId]);

  // ── QR refresh — polls GET /getQR/:sessionId which proxies to QR service ──
  useEffect(() => {
    if (!session || mode !== "QRCode") return;
    const fetch = async () => {
      try {
        const r = await getQR(session.session_id);
        setQr(r.data.qr);
        setQrSource(r.data.source || "service");
      } catch {}
    };
    fetch();
    const id = setInterval(fetch, 5000);
    return () => clearInterval(id);
  }, [session, mode]);

  // ── Attendance polling ────────────────────────────────────────────────────
  useEffect(() => {
    if (!session) return;
    const fetch = async () => {
      try { const r = await getAttendance(session.session_id); setAttendance(r.data); } catch {}
    };
    fetch();
    const id = setInterval(fetch, 3000);
    return () => clearInterval(id);
  }, [session]);

  // ── Elapsed timer ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!session) return;
    const t = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(t);
  }, [session]);

  // ── Manual attendance ─────────────────────────────────────────────────────
  const handleBulkMark = async () => {
    if (!session || selected.size === 0) return;
    try {
      await manualAttendanceBulk({ session_id: session.session_id, student_ids: Array.from(selected) });
      const r = await getAttendance(session.session_id);
      setAttendance(r.data);
      setSelected(new Set());
    } catch {}
  };

  // ── Schedule handlers ─────────────────────────────────────────────────────
  const handleAddSchedule = async () => {
    setSchSaving(true);
    try {
      await apiAddSchedule(courseId, { ...newSch, switch: false });
      await loadSchedules();
      setShowSchForm(false);
      setNewSch({ scheduledDay: "Monday", startTime: "09:00", endTime: "09:50", method: "BLE" });
    } catch (e) {
      setError(e.response?.data?.error || "Could not add schedule.");
    } finally {
      setSchSaving(false);
    }
  };

  const handleToggleSchedule = async (idx) => {
    const sch = schedules[idx];
    try {
      await apiUpdateSchedule(courseId, idx, { switch: !sch.switch });
      await loadSchedules();
    } catch {}
  };

  const handleSaveSchedule = async (idx, data) => {
    setSchSaving(true);
    try {
      await apiUpdateSchedule(courseId, idx, data);
      await loadSchedules();
    } catch (e) {
      setError(e.response?.data?.error || "Could not update schedule.");
    } finally {
      setSchSaving(false);
    }
  };

  const handleDeleteSchedule = async (idx) => {
    try {
      await apiDeleteSchedule(courseId, idx);
      await loadSchedules();
    } catch {}
  };

  const presentStudents = new Set(attendance.map(a => a.student)).size;
  const fmt = s => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div className="space-y-8">

      {/* Header */}
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
          <p className="text-soft text-xs mt-0.5 font-mono">Course ID: {courseId}</p>
        </div>
      </div>

      {error && (
        <div className="text-rose-400 text-sm bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-3 flex items-center justify-between">
          {error}
          <button onClick={() => setError("")}><X size={14} /></button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-slide-up" style={{ animationDelay: "80ms" }}>
        <StatBox label="Present"        value={presentStudents} />
        <StatBox label="Total Students" value={roster.length} />
        <StatBox label="Total Marks"    value={attendance.length} />
        <StatBox label="Duration"       value={fmt(elapsed)} mono />
      </div>

      {/* Mode selector + Start/End */}
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

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left: QR / BLE info */}
        <div className="lg:col-span-2 animate-slide-up" style={{ animationDelay: "200ms" }}>

          {/* QR Panel — uses QR microservice via GET /getQR/:sessionId */}
          {session && mode === "QRCode" && (
            <QrPanel session={session} qr={qr} source={qrSource} />
          )}

          {/* BLE Panel — shows rotating minor from BLE microservice */}
          {session && mode === "BLE" && (
            <BleBeaconPanel session={session} courseId={courseId} />
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
                      <p className="text-snow text-sm font-medium">{a.studentName || `Student #${a.student}`}</p>
                      <p className="text-soft text-xs font-mono">{formatIST(a.markedAt || a.timestamp)}</p>
                    </div>
                    <Badge label={a.verifiedVia || "Marked"} variant={
                      a.verifiedVia === "BLE" ? "ble" :
                      a.verifiedVia === "QRCode" ? "qr" :
                      a.verifiedVia === "Manual" ? "manual" : "live"
                    } />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Manual Roll Call */}
      {session && (
        <div className="animate-slide-up bg-card border border-edge rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-edge">
            <h3 className="text-snow font-semibold text-sm">Manual Roll Call</h3>
          </div>
          <div className="px-5 py-4 space-y-3">
            <div className="flex justify-between items-center">
              <p className="text-xs text-soft">Select students to mark present</p>
              <button onClick={() => setSelected(new Set(roster.map(s => s.id)))}
                className="text-xs text-azure-400 hover:text-azure-300 transition-colors">
                Select All
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto">
              {roster.map(s => {
                const alreadyMarked = attendance.some(a => a.student === s.id);
                return (
                  <label key={s.id} className={`flex items-center gap-2 text-sm ${alreadyMarked ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}>
                    <input type="checkbox"
                      checked={selected.has(s.id) || alreadyMarked}
                      disabled={alreadyMarked}
                      onChange={() => {
                        if (alreadyMarked) return;
                        const n = new Set(selected);
                        n.has(s.id) ? n.delete(s.id) : n.add(s.id);
                        setSelected(n);
                      }}
                    />
                    <span className={alreadyMarked ? "text-jade-400" : "text-snow"}>{s.name}</span>
                    {alreadyMarked && <CheckCircle2 size={12} className="text-jade-400 shrink-0" />}
                  </label>
                );
              })}
            </div>
            <button onClick={handleBulkMark} disabled={selected.size === 0}
              className="mt-2 px-4 py-2 rounded-xl bg-amber-500 text-black text-sm font-medium
                disabled:opacity-40 disabled:cursor-not-allowed hover:bg-amber-400 transition-colors">
              Mark Selected ({selected.size})
            </button>
          </div>
        </div>
      )}

      {/* Schedules */}
      <div className="animate-slide-up bg-card border border-edge rounded-2xl overflow-hidden" style={{ animationDelay: "380ms" }}>
        <div className="px-5 py-4 border-b border-edge flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarClock size={15} className="text-violet-400" />
            <h3 className="text-snow font-semibold text-sm">Schedules</h3>
            <span className="text-dim text-xs font-mono">auto-starts sessions · times in IST</span>
          </div>
          {!isTa && (
            <button onClick={() => setShowSchForm(v => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-500/15 text-violet-400 text-xs
                hover:bg-violet-500/25 transition-colors border border-violet-500/20">
              <Plus size={12} /> Add Schedule
            </button>
          )}
        </div>

        {showSchForm && !isTa && (
          <div className="px-5 py-4 border-b border-edge bg-ink space-y-3">
            <p className="text-snow text-xs font-semibold">New recurring schedule</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-soft">Day</label>
                <select value={newSch.scheduledDay}
                  onChange={e => setNewSch(s => ({ ...s, scheduledDay: e.target.value }))}
                  className="w-full bg-card border border-edge rounded-xl text-sm text-snow px-3 py-2 focus:outline-none focus:border-violet-500 transition-all appearance-none">
                  {VALID_DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-soft">Method</label>
                <select value={newSch.method}
                  onChange={e => setNewSch(s => ({ ...s, method: e.target.value }))}
                  className="w-full bg-card border border-edge rounded-xl text-sm text-snow px-3 py-2 focus:outline-none focus:border-violet-500 transition-all appearance-none">
                  {["BLE","QRCode","Manual"].map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs text-soft">Start Time <span className="text-violet-400 font-mono">(IST)</span></label>
                <input type="time" value={newSch.startTime}
                  onChange={e => setNewSch(s => ({ ...s, startTime: e.target.value }))}
                  className="w-full bg-card border border-edge rounded-xl text-sm text-snow px-3 py-2 focus:outline-none focus:border-violet-500 transition-all" />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-soft">End Time <span className="text-violet-400 font-mono">(IST)</span></label>
                <input type="time" value={newSch.endTime}
                  onChange={e => setNewSch(s => ({ ...s, endTime: e.target.value }))}
                  className="w-full bg-card border border-edge rounded-xl text-sm text-snow px-3 py-2 focus:outline-none focus:border-violet-500 transition-all" />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={handleAddSchedule} disabled={schSaving}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-violet-500/15 text-violet-400 text-xs font-medium
                  border border-violet-500/20 hover:bg-violet-500/25 transition-colors disabled:opacity-50">
                {schSaving ? <Spinner size={12} /> : <Save size={12} />} Save Schedule
              </button>
              <button onClick={() => setShowSchForm(false)}
                className="px-4 py-2 rounded-xl bg-edge text-soft text-xs hover:text-snow transition-colors">
                Cancel
              </button>
            </div>
          </div>
        )}

        {schLoading ? (
          <div className="flex items-center justify-center py-10"><Spinner size={20} /></div>
        ) : schedules.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
            <CalendarClock size={22} className="text-dim" />
            <p className="text-soft text-sm">No schedules yet</p>
            <p className="text-dim text-xs max-w-xs">
              Add a schedule to auto-start and auto-end sessions. All times are IST.
            </p>
          </div>
        ) : (
          <div>
            {schedules.map((sch, idx) => (
              <ScheduleRow
                key={idx}
                sch={sch}
                index={idx}
                onToggle={handleToggleSchedule}
                onDelete={handleDeleteSchedule}
                onSave={handleSaveSchedule}
                saving={schSaving}
              />
            ))}
          </div>
        )}
      </div>

    </div>
  );
}