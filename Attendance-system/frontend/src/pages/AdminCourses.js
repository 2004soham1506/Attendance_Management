/**
 * AdminCourses.js  (full-page version for admin nav → "Courses")
 *
 * Shows all courses with:
 *  - Enrolled students count, TAs, department, slot
 *  - Expandable panel per course showing per-student attendance %
 *  - TA add/remove (student IDs only)
 *  - Enroll / unenroll students
 *  - Create / delete courses
 *  - CSV bulk-create/delete panel
 */
import { useState, useEffect, useCallback } from "react";
import {
  getAllCourses, getAllUsers,
  createCourse, deleteCourse,
  enrollStudent, unenrollStudent,
  getCourseEnrolled,
  getAdminCourseAnalytics,
  addTA, removeTA,
  csvBulkCreate, csvBulkDelete,
} from "../api/client";
import {
  Plus, Trash2, BookOpen, Users, ChevronDown, ChevronUp,
  Search, RefreshCw, UserPlus, Upload, X, GraduationCap,
  AlertTriangle, CheckCircle2, Activity, Shield,
} from "lucide-react";
import { Badge, Button, Spinner, Empty, Modal, ProgressBar, AttendancePct } from "../components/UI";

// ── Helpers ───────────────────────────────────────────────────────────────────
const SLOTS = ["A","B","C","D","E","F","G","P","Q","R","S","W","X","Y","Z"];

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

// ── CSV Upload Panel ──────────────────────────────────────────────────────────
function CsvPanel({ onDone }) {
  const [mode,   setMode]   = useState("create");
  const [type,   setType]   = useState("students");
  const [file,   setFile]   = useState(null);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);
  const [err,    setErr]    = useState("");

  const TYPES = ["students","professors","courses","enrollments"];
  const TEMPLATES = {
    students:    "_id,name,email,password,imageURL",
    professors:  "_id,name,email,password,department",
    courses:     "_id,name,department,slot,venue,startDate,endDate,instructors,tas",
    enrollments: "student,course",
  };

  const handleSubmit = async () => {
    if (!file) { setErr("Please select a CSV file."); return; }
    setSaving(true); setErr(""); setResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("type", type);
      const res = mode === "create" ? await csvBulkCreate(fd) : await csvBulkDelete(fd);
      setResult(res.data);
      setFile(null);
      onDone();
    } catch (e) {
      setErr(e.response?.data?.error || "CSV operation failed.");
    } finally { setSaving(false); }
  };

  return (
    <div className="bg-card border border-edge rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Upload size={15} className="text-violet-400" />
        <h3 className="text-snow font-semibold text-sm">CSV Bulk Operations</h3>
      </div>

      <div className="flex gap-1 p-1 bg-ink rounded-xl border border-edge w-fit">
        {["create","delete"].map(m => (
          <button key={m} onClick={() => { setMode(m); setResult(null); setErr(""); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              mode === m
                ? m === "delete"
                  ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                  : "bg-azure-500/20 text-azure-400 border border-azure-500/30"
                : "text-soft hover:text-snow"
            }`}>
            {m === "create" ? "Bulk Create" : "Bulk Delete"}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {TYPES.map(t => (
          <button key={t} onClick={() => setType(t)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              type === t
                ? "bg-violet-500/15 text-violet-400 border-violet-500/30"
                : "bg-ink text-soft border-edge hover:text-snow"
            }`}>{t}</button>
        ))}
      </div>

      <div className="bg-ink border border-edge rounded-xl px-4 py-2.5">
        <p className="text-dim text-xs font-mono">{TEMPLATES[type]}</p>
        {type === "courses" && (
          <p className="text-dim text-xs mt-1">instructors/tas = comma-separated student IDs within the cell</p>
        )}
        {mode === "delete" && type !== "enrollments" && (
          <p className="text-dim text-xs mt-1">Only _id column needed for delete.</p>
        )}
      </div>

      <label className="flex items-center gap-3 px-4 py-3 bg-ink border border-edge border-dashed rounded-xl cursor-pointer hover:border-violet-500/40 transition-colors">
        <Upload size={16} className="text-dim shrink-0" />
        <span className="text-soft text-sm flex-1 truncate">
          {file ? file.name : "Click to select CSV file…"}
        </span>
        {file && (
          <button onClick={e => { e.preventDefault(); setFile(null); }}
            className="text-dim hover:text-rose-400 transition-colors">
            <X size={14} />
          </button>
        )}
        <input type="file" accept=".csv,text/csv" className="hidden"
          onChange={e => { setFile(e.target.files[0] || null); setResult(null); setErr(""); }} />
      </label>

      {err && <p className="text-rose-400 text-xs">{err}</p>}
      {result && (
        <div className="flex items-start gap-2 bg-jade-500/10 border border-jade-500/20 rounded-xl px-4 py-3">
          <CheckCircle2 size={14} className="text-jade-400 shrink-0 mt-0.5" />
          <div className="text-xs text-jade-300">
            {mode === "create"
              ? `Created: ${result.created ?? 0}  Skipped: ${result.skipped ?? 0}`
              : `Deleted: ${result.deleted ?? 0}`}
            {result.errors?.length > 0 && (
              <p className="text-amber-400 mt-1">Errors: {result.errors.slice(0,5).join("; ")}</p>
            )}
          </div>
        </div>
      )}
      <Button onClick={handleSubmit} loading={saving} variant={mode === "delete" ? "danger" : "primary"}>
        {mode === "create" ? <><Upload size={14} /> Upload & Create</> : <><Trash2 size={14} /> Upload & Delete</>}
      </Button>
    </div>
  );
}

// ── TA Management ─────────────────────────────────────────────────────────────
function TaPanel({ courseId, currentTas, allStudents, onRefresh }) {
  const [newTaId,  setNewTaId]  = useState("");
  const [adding,   setAdding]   = useState(false);
  const [removing, setRemoving] = useState(null);
  const [err,      setErr]      = useState("");

  const studentMap = Object.fromEntries((allStudents || []).map(s => [s._id || s.id, s.name]));

  const handleAdd = async () => {
    if (!newTaId.trim()) return setErr("Enter a student ID");
    setAdding(true); setErr("");
    try {
      await addTA(courseId, newTaId.trim());
      setNewTaId(""); onRefresh();
    } catch (e) {
      setErr(e.response?.data?.error || "Failed to add TA");
    } finally { setAdding(false); }
  };

  const handleRemove = async (studentId) => {
    setRemoving(studentId);
    try {
      await removeTA(courseId, studentId);
      onRefresh();
    } catch {} finally { setRemoving(null); }
  };

  return (
    <div className="space-y-2">
      <p className="text-soft text-xs font-medium uppercase tracking-wider">Teaching Assistants</p>
      {(currentTas || []).length === 0 ? (
        <p className="text-dim text-xs">No TAs assigned.</p>
      ) : (
        <div className="space-y-1">
          {currentTas.map(taId => (
            <div key={taId} className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
              <span className="text-amber-400 text-xs font-mono flex-1">
                {taId}{studentMap[taId] ? ` — ${studentMap[taId]}` : ""}
              </span>
              <button onClick={() => handleRemove(taId)} disabled={removing === taId}
                className="text-dim hover:text-rose-400 transition-colors">
                {removing === taId ? <Spinner size={11} /> : <X size={12} />}
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-2 mt-2">
        <input value={newTaId} onChange={e => setNewTaId(e.target.value)}
          placeholder="Student ID to add as TA"
          onKeyDown={e => e.key === "Enter" && handleAdd()}
          className="flex-1 bg-card border border-edge rounded-xl text-xs text-snow px-3 py-1.5
            focus:outline-none focus:border-amber-500 placeholder:text-dim transition-all" />
        <button onClick={handleAdd} disabled={adding}
          className="px-3 py-1.5 rounded-xl bg-amber-500/15 text-amber-400 text-xs border border-amber-500/20
            hover:bg-amber-500/25 transition-colors disabled:opacity-50 flex items-center gap-1">
          {adding ? <Spinner size={11} /> : <UserPlus size={12} />} Add TA
        </button>
      </div>
      {err && <p className="text-rose-400 text-xs">{err}</p>}
    </div>
  );
}

// ── Student Stats Panel ───────────────────────────────────────────────────────
function CourseStudentStats({ courseId }) {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [query,   setQuery]   = useState("");

  useEffect(() => {
    getAdminCourseAnalytics(courseId)
      .then(r => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [courseId]);

  if (loading) return <div className="flex justify-center py-4"><Spinner size={16} /></div>;
  if (!data)   return <p className="text-dim text-xs py-2">Could not load student stats.</p>;

  const filtered = (data.studentStats || []).filter(s =>
    s.name.toLowerCase().includes(query.toLowerCase()) ||
    String(s.student_id).toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-soft text-xs font-medium uppercase tracking-wider">
          Enrolled Students
          <span className="ml-1.5 text-dim normal-case font-mono">
            ({data.enrolled} enrolled)
          </span>
        </p>
        <div className="relative">
          <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-dim" />
          <input value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Search…"
            className="bg-card border border-edge rounded-lg text-xs text-snow pl-7 pr-2.5 py-1
              focus:outline-none focus:border-azure-500 transition-all w-36 placeholder:text-dim" />
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-dim text-xs py-2 text-center">No students found.</p>
      ) : (
        <div className="space-y-1 max-h-52 overflow-y-auto">
          {filtered.map(s => (
            <div key={s.student_id} className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-white/2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-snow text-xs font-medium truncate">{s.name}</p>
                  {s.isTA && (
                    <span className="px-1.5 py-0.5 rounded text-xs bg-amber-500/15 text-amber-400 border border-amber-500/20 font-mono shrink-0">TA</span>
                  )}
                </div>
                <p className="text-dim text-xs font-mono">{s.student_id}</p>
              </div>
              <div className="w-20 shrink-0">
                <ProgressBar value={s.attendancePct} max={100} size="sm" />
              </div>
              <AttendancePct value={s.attendancePct} small />
              <span className="text-dim text-xs font-mono w-16 text-right shrink-0">
                {s.attended}/{s.totalLectures}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Create Course Form ────────────────────────────────────────────────────────
function CreateCourseForm({ professors, onCreated, onCancel }) {
  const [form, setForm] = useState({
    name: "", _id: "", slot: "A",
    department: "CSE", venue: "",
    startDate: "", endDate: "",
    instructors: [], tas: "",
  });
  const [saving, setSaving] = useState(false);
  const [err,    setErr]    = useState("");

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const toggleInstructor = (id) => {
    setForm(f => ({
      ...f,
      instructors: f.instructors.includes(id)
        ? f.instructors.filter(x => x !== id)
        : [...f.instructors, id],
    }));
  };

  const handleSave = async () => {
    if (!form.name.trim())        { setErr("Course name required."); return; }
    if (!form.department.trim())  { setErr("Department required."); return; }
    if (!form.venue.trim())       { setErr("Venue required."); return; }
    if (!form.startDate || !form.endDate) { setErr("Start and end dates required."); return; }
    if (form.instructors.length === 0)    { setErr("At least one instructor required."); return; }
    setSaving(true); setErr("");
    try {
      const payload = {
        ...form,
        _id:  form._id.trim() || undefined,
        tas:  form.tas ? form.tas.split(",").map(s => s.trim()).filter(Boolean) : [],
      };
      if (!payload._id) delete payload._id;
      const res = await createCourse(payload);
      onCreated(res.data);
    } catch (e) {
      setErr(e.response?.data?.error || "Failed to create course.");
    } finally { setSaving(false); }
  };

  return (
    <div className="border border-azure-500/20 rounded-xl p-4 bg-ink space-y-3 animate-slide-up">
      <p className="text-snow text-xs font-semibold">Create New Course</p>
      {err && (
        <div className="flex items-center gap-2 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
          <AlertTriangle size={12} className="text-rose-400 shrink-0" />
          <p className="text-rose-300 text-xs">{err}</p>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        {[
          ["Course Name *", "name", "text", "Data Structures"],
          ["Course ID (optional)", "_id", "text", "CS3101"],
          ["Department *", "department", "text", "CSE"],
          ["Venue *", "venue", "text", "LH-1"],
        ].map(([lbl, key, type, placeholder]) => (
          <div key={key} className="space-y-1">
            <label className="text-xs text-soft">{lbl}</label>
            <input type={type} value={form[key]} placeholder={placeholder}
              onChange={e => set(key, e.target.value)}
              className="w-full bg-card border border-edge rounded-xl text-xs text-snow px-3 py-1.5
                focus:outline-none focus:border-azure-500 transition-all placeholder:text-dim" />
          </div>
        ))}
        <div className="space-y-1">
          <label className="text-xs text-soft">Start Date *</label>
          <input type="date" value={form.startDate} onChange={e => set("startDate", e.target.value)}
            className="w-full bg-card border border-edge rounded-xl text-xs text-snow px-3 py-1.5
              focus:outline-none focus:border-azure-500 transition-all" />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-soft">End Date *</label>
          <input type="date" value={form.endDate} onChange={e => set("endDate", e.target.value)}
            className="w-full bg-card border border-edge rounded-xl text-xs text-snow px-3 py-1.5
              focus:outline-none focus:border-azure-500 transition-all" />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-soft">Slot</label>
          <select value={form.slot} onChange={e => set("slot", e.target.value)}
            className="w-full bg-card border border-edge rounded-xl text-xs text-snow px-3 py-1.5
              focus:outline-none focus:border-azure-500 transition-all appearance-none">
            {SLOTS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="col-span-2 space-y-1">
          <label className="text-xs text-soft">TA Student IDs (comma-separated)</label>
          <input type="text" value={form.tas} placeholder="CS22B0001,CS22B0002"
            onChange={e => set("tas", e.target.value)}
            className="w-full bg-card border border-edge rounded-xl text-xs text-snow px-3 py-1.5
              focus:outline-none focus:border-azure-500 transition-all placeholder:text-dim" />
        </div>
      </div>

      {/* Instructors */}
      <div className="space-y-1.5">
        <label className="text-xs text-soft">Instructors * (select one or more)</label>
        <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
          {professors.map(p => (
            <button key={p._id || p.id} type="button"
              onClick={() => toggleInstructor(p._id || p.id)}
              className={`px-2.5 py-1 rounded-lg text-xs border transition-colors ${
                form.instructors.includes(p._id || p.id)
                  ? "bg-violet-500/20 text-violet-400 border-violet-500/30"
                  : "bg-card text-soft border-edge hover:text-snow"
              }`}>
              {p.name}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-azure-500/15 text-azure-400 text-xs
            border border-azure-500/20 hover:bg-azure-500/25 transition-colors disabled:opacity-50">
          {saving ? <Spinner size={12} /> : <Plus size={12} />}
          {saving ? "Creating…" : "Create Course"}
        </button>
        <button onClick={onCancel}
          className="px-3 py-1.5 rounded-xl bg-edge text-soft text-xs hover:text-snow transition-colors">
          Cancel
        </button>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AdminCourses() {
  const [courses,      setCourses]      = useState([]);
  const [professors,   setProfessors]   = useState([]);
  const [allStudents,  setAllStudents]  = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [expanded,     setExpanded]     = useState(null);
  const [enrolled,     setEnrolled]     = useState({});
  const [enrollId,     setEnrollId]     = useState("");
  const [enrolling,    setEnrolling]    = useState(false);
  const [enrollErr,    setEnrollErr]    = useState("");
  const [deleting,     setDeleting]     = useState(null);
  const [showCreate,   setShowCreate]   = useState(false);
  const [showCsv,      setShowCsv]      = useState(false);
  const [searchQuery,  setSearchQuery]  = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cRes, uRes] = await Promise.all([
        getAllCourses(),
        getAllUsers(),
      ]);
      setCourses(Array.isArray(cRes.data) ? cRes.data : []);
      const users = Array.isArray(uRes.data) ? uRes.data : [];
      setProfessors(users.filter(u => u.role === "prof"));
      setAllStudents(users.filter(u => u.role === "student" || u.role === "ta"));
    } catch (e) {
      console.error("AdminCourses load failed:", e);
    } finally { setLoading(false); }
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
      setEnrollId(""); await loadEnrolled(courseId); await load();
    } catch (e) {
      setEnrollErr(e.response?.data?.error || "Enrollment failed.");
    } finally { setEnrolling(false); }
  };

  const handleUnenroll = async (studentId, courseId) => {
    try {
      await unenrollStudent({ student: studentId, course: courseId });
      await loadEnrolled(courseId); await load();
    } catch {}
  };

  const handleDelete = async (courseId) => {
    if (!window.confirm("Delete this course and all its data?")) return;
    setDeleting(courseId);
    try { await deleteCourse(courseId); await load(); }
    catch {} finally { setDeleting(null); }
  };

  const filteredCourses = courses.filter(c =>
    (c.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c._id || c.id || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.department || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="animate-slide-up flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-azure-500/15 flex items-center justify-center border border-azure-500/20">
            <BookOpen size={18} className="text-azure-400" />
          </div>
          <div>
            <h1 className="text-snow text-2xl font-bold tracking-tight">Courses</h1>
            <p className="text-soft text-sm mt-0.5">{courses.length} courses · manage enrollment, TAs & attendance</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowCsv(v => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-500/15 text-violet-400 text-xs
              border border-violet-500/20 hover:bg-violet-500/25 transition-colors">
            <Upload size={12} /> {showCsv ? "Hide CSV" : "CSV Import"}
          </button>
          <button onClick={() => setShowCreate(v => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-azure-500/15 text-azure-400 text-xs
              border border-azure-500/20 hover:bg-azure-500/25 transition-colors">
            <Plus size={12} /> {showCreate ? "Cancel" : "New Course"}
          </button>
          <button onClick={load} className="p-1.5 rounded-lg bg-card border border-edge text-dim hover:text-snow transition-colors">
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      {/* CSV Panel */}
      {showCsv && <CsvPanel onDone={load} />}

      {/* Create Course Form */}
      {showCreate && (
        <CreateCourseForm
          professors={professors}
          onCreated={() => { setShowCreate(false); load(); }}
          onCancel={() => setShowCreate(false)}
        />
      )}

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-dim" />
        <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search courses…"
          className="w-full bg-card border border-edge rounded-xl text-sm text-snow pl-10 pr-4 py-2.5
            focus:outline-none focus:border-azure-500 transition-all placeholder:text-dim" />
      </div>

      {/* Course list */}
      {loading ? (
        <div className="flex items-center justify-center h-40"><Spinner size={24} /></div>
      ) : filteredCourses.length === 0 ? (
        <Empty icon={BookOpen} title="No courses found" sub="Create a course to get started." />
      ) : (
        <div className="space-y-3">
          {filteredCourses.map(c => {
            const courseId = c._id || c.id;
            const taCount  = (c.tas || []).length;
            return (
              <div key={courseId}
                className="bg-card border border-edge rounded-2xl overflow-hidden">
                {/* Course header */}
                <button onClick={() => handleExpand(courseId)}
                  className="w-full flex items-center gap-4 px-5 py-4 hover:bg-white/2 transition-colors text-left">
                  <div className="w-9 h-9 rounded-xl bg-azure-500/15 border border-azure-500/20 flex items-center justify-center shrink-0">
                    <BookOpen size={15} className="text-azure-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-snow text-sm font-semibold">{c.name}</p>
                      <span className="text-dim text-xs font-mono">({courseId})</span>
                      <Badge label={`Slot ${c.slot}`} variant="manual" />
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      <span className="text-dim text-xs">{c.department}</span>
                      <span className="text-dim text-xs">·</span>
                      <span className="text-dim text-xs">{c.venue}</span>
                      <span className="text-dim text-xs">·</span>
                      <span className="text-soft text-xs font-mono">
                        <Users size={10} className="inline mr-1" />{c.enrolled || 0} enrolled
                      </span>
                      {taCount > 0 && (
                        <>
                          <span className="text-dim text-xs">·</span>
                          <span className="text-amber-400 text-xs font-mono">
                            {taCount} TA{taCount !== 1 ? "s" : ""}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={e => { e.stopPropagation(); handleDelete(courseId); }}
                      disabled={deleting === courseId}
                      className="p-1.5 rounded-lg text-dim hover:text-rose-400 hover:bg-rose-500/10 transition-colors">
                      {deleting === courseId ? <Spinner size={14} /> : <Trash2 size={14} />}
                    </button>
                    {expanded === courseId
                      ? <ChevronUp size={16} className="text-dim" />
                      : <ChevronDown size={16} className="text-dim" />}
                  </div>
                </button>

                {/* Expanded content */}
                {expanded === courseId && (
                  <div className="border-t border-edge bg-ink px-5 py-4 space-y-5 animate-slide-up">
                    {/* Instructors row */}
                    <div>
                      <p className="text-soft text-xs font-medium uppercase tracking-wider mb-1.5">Instructors</p>
                      <div className="flex flex-wrap gap-1.5">
                        {(c.instructors || []).map(id => (
                          <span key={id} className="px-2.5 py-1 rounded-lg bg-violet-500/15 text-violet-400 text-xs border border-violet-500/20 font-mono">{id}</span>
                        ))}
                      </div>
                    </div>

                    {/* TA Management */}
                    <TaPanel
                      courseId={courseId}
                      currentTas={c.tas || []}
                      allStudents={allStudents}
                      onRefresh={load}
                    />

                    {/* Enroll student */}
                    <div className="space-y-2">
                      <p className="text-soft text-xs font-medium uppercase tracking-wider">Enroll Student</p>
                      <div className="flex gap-2">
                        <input value={enrollId} onChange={e => setEnrollId(e.target.value)}
                          placeholder="Student ID"
                          onKeyDown={e => e.key === "Enter" && handleEnroll(courseId)}
                          className="flex-1 bg-card border border-edge rounded-xl text-xs text-snow px-3 py-1.5
                            focus:outline-none focus:border-jade-500 placeholder:text-dim transition-all" />
                        <button onClick={() => handleEnroll(courseId)} disabled={enrolling}
                          className="px-3 py-1.5 rounded-xl bg-jade-500/15 text-jade-400 text-xs border border-jade-500/20
                            hover:bg-jade-500/25 transition-colors disabled:opacity-50">
                          {enrolling ? <Spinner size={11} /> : "Enroll"}
                        </button>
                      </div>
                      {enrollErr && <p className="text-rose-400 text-xs">{enrollErr}</p>}
                      {/* Enrolled list */}
                      {(enrolled[courseId] || []).length > 0 && (
                        <div className="space-y-1 max-h-28 overflow-y-auto mt-1">
                          {(enrolled[courseId] || []).map(s => (
                            <div key={s._id || s.id} className="flex items-center gap-2 py-0.5">
                              <span className="text-snow text-xs flex-1 font-mono">{s._id || s.id} — {s.name}</span>
                              <button onClick={() => handleUnenroll(s._id || s.id, courseId)}
                                className="text-dim hover:text-rose-400 transition-colors">
                                <X size={12} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Student attendance stats */}
                    <CourseStudentStats courseId={courseId} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}