import { useState, useEffect, useCallback } from "react";
import { getAdminStats, getAllCourses, createCourse, getAllUsers, createProfessor,
  createStudent, deleteProfessor, deleteStudent, enrollStudent, unenrollStudent,
  getCourseEnrolled, getAdminStudentAnalytics, enrollBulk } from "../api/client";
import {
  Shield, Activity, Users, AlertTriangle, CheckCircle2, Server,
  Plus, Trash2, RefreshCw, BookOpen, GraduationCap, ChevronDown,
  ChevronUp, X, Search, BarChart3,
} from "lucide-react";
import { Badge, Spinner, ProgressBar, AttendancePct } from "../components/UI";

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatIST(utcStr) {
  if (!utcStr) return "—";
  const s = utcStr.endsWith("Z") || utcStr.includes("+") ? utcStr : utcStr + "Z";
  return new Date(s).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata", day: "2-digit", month: "short",
    hour: "2-digit", minute: "2-digit",
  });
}

const SLOTS = ["A","B","C","D","E","F","G","P","Q","R","S","W","X","Y","Z"];

const ROLE_COLORS = {
  admin:   "text-rose-400 bg-rose-500/15 border-rose-500/20",
  prof:    "text-azure-400 bg-azure-500/15 border-azure-500/20",
  student: "text-jade-400 bg-jade-500/15 border-jade-500/20",
  ta:      "text-amber-400 bg-amber-500/15 border-amber-500/20",
};

// ── Student Analytics Modal ───────────────────────────────────────────────────
function StudentAnalyticsModal({ student, onClose }) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAdminStudentAnalytics(student.id || student._id)
      .then(r => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [student]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-card border border-edge rounded-2xl w-full max-w-xl shadow-float animate-slide-up overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-edge">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-azure-500/15 border border-azure-500/20 flex items-center justify-center">
              <BarChart3 size={16} className="text-azure-400" />
            </div>
            <div>
              <p className="text-snow font-semibold text-sm">{student.name}</p>
              <p className="text-soft text-xs font-mono">{student.email} · Course Analytics</p>
            </div>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-xl bg-edge flex items-center justify-center text-soft hover:text-snow transition-colors">
            <X size={15} />
          </button>
        </div>

        <div className="px-6 py-5">
          {loading ? (
            <div className="flex items-center justify-center h-40"><Spinner size={24} /></div>
          ) : !data || data.courses.length === 0 ? (
            <p className="text-soft text-sm text-center py-10">No enrolled courses.</p>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {data.courses.map((c, i) => (
                <div key={i} className="p-3 rounded-xl bg-ink border border-edge">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-snow text-sm font-medium">{c.courseName}</p>
                    <AttendancePct value={c.attendancePct} />
                  </div>
                  <ProgressBar value={c.attendancePct} max={100} size="sm" />
                  <p className="text-dim text-xs font-mono mt-1.5">
                    {c.attended} / {c.sessionsHeld} lectures attended · {c.totalLectures} scheduled
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Course Creation Panel ─────────────────────────────────────────────────────
function CreateCoursePanel({ onCreated }) {
  const blank = {
    _id: "", name: "", department: "", slot: "A",
    venue: "", startDate: "", endDate: "",
    instructors: "", tas: "",
  };
  const [form,     setForm]     = useState(blank);
  const [creating, setCreating] = useState(false);
  const [err,      setErr]      = useState("");
  const [success,  setSuccess]  = useState("");

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const handle = async () => {
    setErr(""); setSuccess("");
    if (!form._id || !form.name || !form.department || !form.slot ||
        !form.venue || !form.startDate || !form.endDate) {
      return setErr("All fields except instructors/TAs are required.");
    }
    setCreating(true);
    try {
      await createCourse({
        ...form,
        instructors: form.instructors ? form.instructors.split(",").map(s => s.trim()).filter(Boolean) : [],
        tas:         form.tas         ? form.tas.split(",").map(s => s.trim()).filter(Boolean)         : [],
        startDate:   new Date(form.startDate).toISOString(),
        endDate:     new Date(form.endDate).toISOString(),
      });
      setSuccess(`Course "${form.name}" created with lectures auto-populated.`);
      setForm(blank);
      onCreated?.();
    } catch (e) {
      setErr(e.response?.data?.error || "Could not create course.");
    } finally {
      setCreating(false);
    }
  };

  const field = (label, key, type = "text", extra = {}) => (
    <div className="space-y-1">
      <label className="text-xs text-soft">{label}</label>
      <input type={type} value={form[key]} onChange={set(key)} {...extra}
        className="w-full bg-card border border-edge rounded-xl text-sm text-snow px-3 py-2
          focus:outline-none focus:border-azure-500 transition-all placeholder:text-dim" />
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {field("Course ID (e.g. CS101)", "_id", "text", { placeholder: "CS101" })}
        {field("Course Name", "name", "text", { placeholder: "Introduction to CS" })}
        {field("Department", "department", "text", { placeholder: "CSE" })}
        <div className="space-y-1">
          <label className="text-xs text-soft">Slot</label>
          <select value={form.slot} onChange={set("slot")}
            className="w-full bg-card border border-edge rounded-xl text-sm text-snow px-3 py-2
              focus:outline-none focus:border-azure-500 transition-all appearance-none">
            {SLOTS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        {field("Venue / Classroom ID", "venue", "text", { placeholder: "TT101" })}
        {field("Start Date", "startDate", "date")}
        {field("End Date", "endDate", "date")}
        {field("Instructor IDs (comma-sep)", "instructors", "text", { placeholder: "prof01, prof02" })}
        {field("TA IDs (comma-sep)", "tas", "text", { placeholder: "20CSE001" })}
      </div>
      {err     && <p className="text-rose-400 text-xs">{err}</p>}
      {success && <p className="text-jade-400 text-xs">{success}</p>}
      <button onClick={handle} disabled={creating}
        className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-azure-500/15 text-azure-400 text-xs font-medium
          border border-azure-500/20 hover:bg-azure-500/25 transition-colors disabled:opacity-50">
        {creating ? <Spinner size={12} /> : <Plus size={12} />}
        {creating ? "Creating…" : "Create Course"}
      </button>
      <p className="text-dim text-xs font-mono">
        Lectures are auto-generated from the slot map between start and end date.
      </p>
    </div>
  );
}

// ── Course List with Enrollment Panel ─────────────────────────────────────────
function CoursesPanel() {
  const [courses,  setCourses]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [enrolled, setEnrolled] = useState({});
  const [enrollId, setEnrollId] = useState("");
  const [enrolling, setEnrolling] = useState(false);
  const [enrollErr, setEnrollErr] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await getAllCourses();
      setCourses(r.data);
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const loadEnrolled = async (courseId) => {
    try {
      const r = await getCourseEnrolled(courseId);
      setEnrolled(e => ({ ...e, [courseId]: r.data }));
    } catch {}
  };

  const handleExpand = (courseId) => {
    if (expanded === courseId) { setExpanded(null); return; }
    setExpanded(courseId);
    setEnrollErr("");
    if (!enrolled[courseId]) loadEnrolled(courseId);
  };

  const handleEnroll = async (courseId) => {
    if (!enrollId.trim()) return setEnrollErr("Enter a student ID");
    setEnrolling(true); setEnrollErr("");
    try {
      await enrollStudent({ student: enrollId.trim(), course: courseId });
      setEnrollId("");
      await loadEnrolled(courseId);
    } catch (e) {
      setEnrollErr(e.response?.data?.error || "Enrollment failed.");
    } finally { setEnrolling(false); }
  };

  const handleUnenroll = async (studentId, courseId) => {
    try {
      await unenrollStudent({ student: studentId, course: courseId });
      await loadEnrolled(courseId);
    } catch {}
  };

  if (loading) return <div className="flex justify-center py-10"><Spinner size={20} /></div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-soft text-xs font-mono">{courses.length} courses</p>
        <button onClick={() => setShowCreate(v => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-azure-500/15 text-azure-400 text-xs
            border border-azure-500/20 hover:bg-azure-500/25 transition-colors">
          <Plus size={12} /> {showCreate ? "Cancel" : "New Course"}
        </button>
      </div>

      {showCreate && (
        <div className="border border-edge rounded-xl p-4 bg-ink animate-slide-up">
          <p className="text-snow text-xs font-semibold mb-3">Create New Course</p>
          <CreateCoursePanel onCreated={() => { setShowCreate(false); load(); }} />
        </div>
      )}

      <div className="space-y-2 max-h-96 overflow-y-auto">
        {courses.length === 0 ? (
          <p className="text-soft text-sm text-center py-8">No courses yet.</p>
        ) : courses.map(c => (
          <div key={c._id} className="border border-edge rounded-xl overflow-hidden">
            <button onClick={() => handleExpand(c._id)}
              className="w-full flex items-center gap-3 px-4 py-3 bg-ink hover:bg-white/2 transition-colors text-left">
              <div className="w-7 h-7 rounded-lg bg-azure-500/15 border border-azure-500/20 flex items-center justify-center shrink-0">
                <BookOpen size={13} className="text-azure-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-snow text-xs font-medium truncate">{c.name}</p>
                <p className="text-dim text-xs font-mono">{c._id} · Slot {c.slot} · {c.enrolled || 0} enrolled</p>
              </div>
              {expanded === c._id ? <ChevronUp size={14} className="text-dim" /> : <ChevronDown size={14} className="text-dim" />}
            </button>

            {expanded === c._id && (
              <div className="px-4 pb-4 pt-2 border-t border-edge bg-ink space-y-3 animate-slide-up">
                {/* Enrolled students */}
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {(enrolled[c._id] || []).length === 0 ? (
                    <p className="text-dim text-xs py-2">No students enrolled.</p>
                  ) : (enrolled[c._id] || []).map(s => (
                    <div key={s._id} className="flex items-center gap-2 py-1">
                      <span className="text-snow text-xs flex-1 font-mono">{s._id} — {s.name}</span>
                      <button onClick={() => handleUnenroll(s._id, c._id)}
                        className="text-dim hover:text-rose-400 transition-colors">
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
                {/* Enroll input */}
                <div className="flex gap-2">
                  <input value={enrollId} onChange={e => setEnrollId(e.target.value)}
                    placeholder="Student ID to enroll"
                    className="flex-1 bg-card border border-edge rounded-xl text-xs text-snow px-3 py-1.5
                      focus:outline-none focus:border-azure-500 placeholder:text-dim transition-all" />
                  <button onClick={() => handleEnroll(c._id)} disabled={enrolling}
                    className="px-3 py-1.5 rounded-xl bg-jade-500/15 text-jade-400 text-xs border border-jade-500/20
                      hover:bg-jade-500/25 transition-colors disabled:opacity-50">
                    {enrolling ? <Spinner size={11} /> : "Enroll"}
                  </button>
                </div>
                {enrollErr && <p className="text-rose-400 text-xs">{enrollErr}</p>}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Users panel ───────────────────────────────────────────────────────────────
function UsersPanel() {
  const [users,    setUsers]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [query,    setQuery]    = useState("");
  const [roleTab,  setRoleTab]  = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [formErr,  setFormErr]  = useState("");
  const [selectedStudent, setSelectedStudent] = useState(null);

  const [form, setForm] = useState({
    _id: "", name: "", email: "", password: "", role: "student",
  });

  const load = useCallback(async () => {
    try {
      const r = await getAllUsers();
      setUsers(r.data);
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = users.filter(u => {
    if (roleTab !== "all" && u.role !== roleTab) return false;
    const q = query.toLowerCase();
    return (u.name || "").toLowerCase().includes(q) ||
           (u.email || "").toLowerCase().includes(q) ||
           (u.id || "").toLowerCase().includes(q);
  });

  const handleCreate = async () => {
    setFormErr("");
    if (!form._id || !form.name || !form.email || !form.password) {
      return setFormErr("All fields required.");
    }
    setCreating(true);
    try {
      if (form.role === "prof" || form.role === "admin") {
        await createProfessor({ ...form });
      } else {
        await createStudent({ ...form });
      }
      setForm({ _id: "", name: "", email: "", password: "", role: "student" });
      setShowForm(false);
      await load();
    } catch (e) {
      setFormErr(e.response?.data?.error || "Creation failed.");
    } finally { setCreating(false); }
  };

  const handleDelete = async (u) => {
    setDeleting(u.id);
    try {
      if (u.role === "prof" || u.role === "admin") await deleteProfessor(u.id);
      else await deleteStudent(u.id);
      await load();
    } catch {} finally { setDeleting(null); }
  };

  if (loading) return <div className="flex justify-center py-10"><Spinner size={20} /></div>;

  return (
    <div className="space-y-3">
      {/* Controls */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-32">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-dim" />
          <input value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Search users…"
            className="w-full bg-card border border-edge rounded-xl text-xs text-snow pl-8 pr-3 py-2
              focus:outline-none focus:border-azure-500 transition-all placeholder:text-dim" />
        </div>
        {["all","student","prof","admin"].map(r => (
          <button key={r} onClick={() => setRoleTab(r)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all border
              ${roleTab === r ? "bg-azure-500/15 text-azure-400 border-azure-500/30" : "bg-card text-soft border-edge hover:text-snow"}`}>
            {r.charAt(0).toUpperCase() + r.slice(1)}
          </button>
        ))}
        <button onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-jade-500/15 text-jade-400 text-xs
            border border-jade-500/20 hover:bg-jade-500/25 transition-colors">
          <Plus size={12} /> Add
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="border border-edge rounded-xl p-4 bg-ink space-y-3 animate-slide-up">
          <div className="grid grid-cols-2 gap-2">
            {[
              ["ID", "_id", "text"],
              ["Name", "name", "text"],
              ["Email", "email", "email"],
              ["Password", "password", "password"],
            ].map(([lbl, key, type]) => (
              <div key={key} className="space-y-1">
                <label className="text-xs text-soft">{lbl}</label>
                <input type={type} value={form[key]}
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  className="w-full bg-card border border-edge rounded-xl text-xs text-snow px-3 py-1.5
                    focus:outline-none focus:border-jade-500 transition-all" />
              </div>
            ))}
            <div className="space-y-1">
              <label className="text-xs text-soft">Role</label>
              <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                className="w-full bg-card border border-edge rounded-xl text-xs text-snow px-3 py-1.5
                  focus:outline-none focus:border-jade-500 transition-all appearance-none">
                <option value="student">Student</option>
                <option value="prof">Professor</option>
              </select>
            </div>
          </div>
          {formErr && <p className="text-rose-400 text-xs">{formErr}</p>}
          <div className="flex gap-2">
            <button onClick={handleCreate} disabled={creating}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                bg-jade-500/15 text-jade-400 border border-jade-500/30 hover:bg-jade-500/25 transition-colors disabled:opacity-50">
              {creating ? <Spinner size={12} /> : <CheckCircle2 size={13} />}
              {creating ? "Creating…" : "Create"}
            </button>
            <button onClick={() => { setShowForm(false); setFormErr(""); }}
              className="px-3 py-1.5 rounded-lg text-xs bg-edge text-soft hover:text-snow transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* User list */}
      <div className="divide-y divide-edge rounded-xl border border-edge overflow-hidden max-h-80 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="text-soft text-sm text-center py-8">No users found.</p>
        ) : filtered.map(u => (
          <div key={u.id} className="flex items-center gap-3 px-4 py-3 bg-ink hover:bg-white/2 transition-colors">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border text-xs font-bold ${ROLE_COLORS[u.role] || ROLE_COLORS.student}`}>
              {(u.name || u.id).charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-snow text-xs font-medium truncate">{u.name}</p>
              <p className="text-dim text-xs font-mono truncate">{u.email}</p>
            </div>
            <span className={`text-xs font-mono px-2 py-0.5 rounded-lg border ${ROLE_COLORS[u.role] || ROLE_COLORS.student}`}>
              {u.role}
            </span>
            {/* Student analytics button */}
            {u.role === "student" && (
              <button onClick={() => setSelectedStudent(u)} title="View course analytics"
                className="text-dim hover:text-azure-400 transition-colors shrink-0">
                <BarChart3 size={13} />
              </button>
            )}
            <button onClick={() => handleDelete(u)} disabled={deleting === u.id}
              className="text-dim hover:text-rose-400 transition-colors shrink-0 disabled:opacity-40">
              {deleting === u.id ? <Spinner size={13} /> : <Trash2 size={13} />}
            </button>
          </div>
        ))}
      </div>
      <p className="text-dim text-xs font-mono">{filtered.length} user{filtered.length !== 1 ? "s" : ""} shown</p>

      {selectedStudent && (
        <StudentAnalyticsModal student={selectedStudent} onClose={() => setSelectedStudent(null)} />
      )}
    </div>
  );
}

// ── Sessions panel ────────────────────────────────────────────────────────────
function SessionsPanel() {
  const [sessions, setSessions] = useState([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    import("../api/client").then(({ default: API }) =>
      API.get("/admin/sessions")
        .then(r => setSessions(r.data))
        .catch(() => {})
        .finally(() => setLoading(false))
    );
  }, []);

  if (loading) return <div className="flex justify-center py-10"><Spinner size={20} /></div>;
  if (sessions.length === 0) return <p className="text-soft text-sm text-center py-6">No sessions yet.</p>;

  return (
    <div className="space-y-2 max-h-72 overflow-y-auto">
      {sessions.slice(0, 50).map(s => (
        <div key={s.sessionUID} className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-ink border border-edge">
          <Activity size={13} className="text-azure-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-snow text-xs font-mono truncate">{s.sessionUID}</p>
            <p className="text-dim text-xs truncate">Course: {s.course_id}</p>
          </div>
          <div className="text-right shrink-0">
            <p className="text-soft text-xs">{formatIST(s.timestamp)}</p>
            <Badge label={s.method} variant={s.method === "BLE" ? "ble" : s.method === "QRCode" ? "qr" : "manual"} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Expandable action card ────────────────────────────────────────────────────
function ActionCard({ icon: Icon, title, subtitle, color, children }) {
  const [open, setOpen] = useState(false);
  const colorMap = {
    azure:  { bg: "bg-azure-500/15",  border: "border-azure-500/20",  text: "text-azure-400"  },
    jade:   { bg: "bg-jade-500/15",   border: "border-jade-500/20",   text: "text-jade-400"   },
    violet: { bg: "bg-violet-500/15", border: "border-violet-500/20", text: "text-violet-400" },
    amber:  { bg: "bg-amber-500/15",  border: "border-amber-500/20",  text: "text-amber-400"  },
  };
  const c = colorMap[color] || colorMap.azure;
  return (
    <div className={`rounded-xl border ${open ? "border-dim" : "border-edge"} bg-ink overflow-hidden transition-all`}>
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-white/2 transition-colors text-left">
        <div className={`w-8 h-8 rounded-xl ${c.bg} border ${c.border} flex items-center justify-center shrink-0`}>
          <Icon size={14} className={c.text} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-snow text-xs font-medium">{title}</p>
          <p className="text-dim text-xs mt-0.5">{subtitle}</p>
        </div>
        {open ? <ChevronUp size={14} className="text-dim shrink-0" /> : <ChevronDown size={14} className="text-dim shrink-0" />}
      </button>
      {open && (
        <div className="px-4 pb-4 pt-1 border-t border-edge animate-slide-up">
          {children}
        </div>
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const [stats,   setStats]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    async function load() {
      try {
        const r = await getAdminStats();
        setStats(r.data);
        setError(null);
      } catch {
        setError("Could not load stats — check backend connection.");
      } finally {
        setLoading(false);
      }
    }
    load();
    const t = setInterval(load, 15_000);
    return () => clearInterval(t);
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><Spinner size={28} /></div>;

  const services = [
    { name: "Node API",          status: !error, detail: "http://localhost:4040" },
    { name: "MongoDB",           status: !error, detail: "mongoose / attendance" },
    { name: "BLE Beacon Server", status: true,   detail: "GET /getMinor"         },
    { name: "JWT Auth",          status: true,   detail: "HS256"                 },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="animate-slide-up flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-rose-500/15 flex items-center justify-center border border-rose-500/20">
          <Shield size={18} className="text-rose-400" />
        </div>
        <div>
          <h1 className="text-snow text-2xl font-bold tracking-tight">Admin Panel</h1>
          <p className="text-soft text-sm mt-0.5">System management and service health</p>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl px-5 py-4 animate-slide-up">
          <AlertTriangle size={16} className="text-amber-400 shrink-0 mt-0.5" />
          <p className="text-amber-300 text-sm">{error}</p>
        </div>
      )}

      {/* Stats strip */}
      {stats && (
        <div className="grid grid-cols-3 lg:grid-cols-6 gap-4 animate-slide-up" style={{ animationDelay: "80ms" }}>
          {[
            { label: "Students",   value: stats.students,      color: "text-jade-400"   },
            { label: "Professors", value: stats.professors,    color: "text-violet-400" },
            { label: "Courses",    value: stats.courses,       color: "text-azure-400"  },
            { label: "Sessions",   value: stats.sessions,      color: "text-amber-400"  },
            { label: "Enrollments",value: stats.enrollments,   color: "text-rose-400"   },
            { label: "Att. Marks", value: stats.attendance,    color: "text-snow"       },
          ].map((s, i) => (
            <div key={i} className="bg-card border border-edge rounded-2xl p-4 text-center">
              <p className="text-soft text-xs uppercase tracking-widest mb-1">{s.label}</p>
              <p className={`text-2xl font-bold font-mono ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Service health */}
      <div className="bg-card border border-edge rounded-2xl p-6 animate-slide-up" style={{ animationDelay: "160ms" }}>
        <h2 className="text-snow font-semibold text-sm mb-4">Service Health</h2>
        <div className="space-y-3">
          {services.map((svc, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-ink border border-edge">
              <div className={`w-2 h-2 rounded-full ${svc.status ? "bg-jade-400" : "bg-rose-400"} animate-pulse`} />
              <div className="flex-1">
                <p className="text-snow text-sm font-medium">{svc.name}</p>
                <p className="text-dim text-xs font-mono">{svc.detail}</p>
              </div>
              <Badge label={svc.status ? "UP" : "DOWN"} variant={svc.status ? "live" : "danger"} />
            </div>
          ))}
        </div>
      </div>

      {/* Action panels */}
      <div className="animate-slide-up space-y-3" style={{ animationDelay: "240ms" }}>
        <h2 className="text-snow font-semibold text-sm">Management</h2>

        <ActionCard icon={BookOpen} title="Courses & Enrollment"
          subtitle="Create courses, manage enrollments, view per-course students" color="azure">
          <CoursesPanel />
        </ActionCard>

        <ActionCard icon={Users} title="Users"
          subtitle="Add/remove students and professors · view student course analytics" color="jade">
          <UsersPanel />
        </ActionCard>

        <ActionCard icon={Activity} title="Sessions"
          subtitle="Browse recent sessions across all courses" color="violet">
          <SessionsPanel />
        </ActionCard>

        <ActionCard icon={Server} title="Server Logs"
          subtitle="Access backend logs via Docker CLI" color="amber">
          <div className="bg-ink border border-edge rounded-xl p-4 font-mono text-xs space-y-2">
            {[
              "Server logs are generated by the Docker container.",
              "To view live logs, run in your terminal:",
              "  docker logs -f attendance-backend",
              "Or tail the last 100 lines:",
              "  docker logs --tail 100 attendance-backend",
            ].map((line, i) => (
              <p key={i} className={line.startsWith("  ") ? "text-jade-400 pl-4" : "text-soft"}>{line}</p>
            ))}
          </div>
        </ActionCard>
      </div>

      <div className="flex items-center gap-2 px-1 animate-slide-up" style={{ animationDelay: "300ms" }}>
        <CheckCircle2 size={13} className="text-jade-400 shrink-0" />
        <p className="text-dim text-xs font-mono">
          All timestamps stored as UTC · displayed in IST (UTC+5:30) throughout the portal
        </p>
      </div>
    </div>
  );
}