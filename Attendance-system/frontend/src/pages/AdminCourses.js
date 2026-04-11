import { useState, useEffect, useCallback } from "react";
import {
  getAdminCourses, getAdminStudents, getAdminProfessors,
  createCourse, deleteCourse, updateCourse,
  adminEnroll, adminEnrollBulk, adminUnenroll,
  addTA, removeTA,
  getStudentCourses, getCourseStudents,
  getCourseAnalytics,
} from "../api/client";
import { StudentLectureHistory } from "./Analytics";
import {
  Plus, Trash2, BookOpen, Users, ChevronDown, ChevronUp,
  Search, X, RefreshCw, GraduationCap, UserPlus, Eye,
  AlertTriangle, CheckCircle2,
} from "lucide-react";
import { Badge, Button, Spinner, Empty, Modal, ProgressBar, AttendancePct } from "../components/UI";

// ── Helpers ───────────────────────────────────────────────────────────────────

const SLOTS = ["A","B","C","D","E","F","G","P","Q","R","S","W","X","Y","Z"];
const COURSE_COLORS = ["bg-azure-500","bg-jade-500","bg-violet-500","bg-amber-500","bg-rose-500"];

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

// ── Create Course Modal ───────────────────────────────────────────────────────

function CreateCourseModal({ professors, onClose, onCreated }) {
  const [form, setForm] = useState({
    name: "", _id: "", slot: "A", classroom: "",
    startDate: "", endDate: "",
    instructors: [], tas: [],
  });
  const [saving, setSaving] = useState(false);
  const [err,    setErr]    = useState("");

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const toggleProf = (id, field) => {
    setForm(f => {
      const arr = f[field].includes(id)
        ? f[field].filter(x => x !== id)
        : [...f[field], id];
      return { ...f, [field]: arr };
    });
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setErr("Course name is required."); return; }
    if (!form.startDate || !form.endDate) { setErr("Start and end dates are required."); return; }
    if (form.instructors.length === 0) { setErr("At least one instructor is required."); return; }
    setSaving(true);
    setErr("");
    try {
      const payload = { ...form };
      if (!payload._id.trim()) delete payload._id;
      const res = await createCourse(payload);
      onCreated(res.data);
      onClose();
    } catch (e) {
      setErr(e.response?.data?.error || "Failed to create course.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Create New Course" onClose={onClose} maxWidth="max-w-xl">
      <div className="p-5 space-y-4">
        {err && (
          <div className="flex items-center gap-2 bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-3">
            <AlertTriangle size={13} className="text-rose-400 shrink-0" />
            <p className="text-rose-300 text-xs">{err}</p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1.5">
            <label className="text-xs text-soft font-medium">Course Name *</label>
            <input value={form.name} onChange={e => set("name", e.target.value)}
              placeholder="e.g. Data Structures and Algorithms"
              className="w-full bg-ink border border-edge rounded-xl text-sm text-snow placeholder:text-dim
                focus:outline-none focus:border-azure-500 transition-all px-4 py-2.5" />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-soft font-medium">Course ID (optional)</label>
            <input value={form._id} onChange={e => set("_id", e.target.value)}
              placeholder="Auto-generated if blank"
              className="w-full bg-ink border border-edge rounded-xl text-sm text-snow placeholder:text-dim
                focus:outline-none focus:border-azure-500 transition-all px-4 py-2.5 font-mono" />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-soft font-medium">Slot *</label>
            <select value={form.slot} onChange={e => set("slot", e.target.value)}
              className="w-full bg-ink border border-edge rounded-xl text-sm text-snow px-4 py-2.5
                focus:outline-none focus:border-azure-500 transition-all appearance-none">
              {SLOTS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-soft font-medium">Start Date *</label>
            <input type="date" value={form.startDate} onChange={e => set("startDate", e.target.value)}
              className="w-full bg-ink border border-edge rounded-xl text-sm text-snow px-4 py-2.5
                focus:outline-none focus:border-azure-500 transition-all" />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-soft font-medium">End Date *</label>
            <input type="date" value={form.endDate} onChange={e => set("endDate", e.target.value)}
              className="w-full bg-ink border border-edge rounded-xl text-sm text-snow px-4 py-2.5
                focus:outline-none focus:border-azure-500 transition-all" />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-soft font-medium">Classroom</label>
            <input value={form.classroom} onChange={e => set("classroom", e.target.value)}
              placeholder="e.g. LH-1"
              className="w-full bg-ink border border-edge rounded-xl text-sm text-snow placeholder:text-dim
                focus:outline-none focus:border-azure-500 transition-all px-4 py-2.5" />
          </div>
        </div>

        {/* Instructor picker */}
        <div className="space-y-2">
          <label className="text-xs text-soft font-medium">Instructors * <span className="text-dim">(select one or more)</span></label>
          <div className="max-h-40 overflow-y-auto divide-y divide-edge border border-edge rounded-xl">
            {professors.map(p => (
              <label key={p._id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/2 cursor-pointer">
                <input type="checkbox"
                  checked={form.instructors.includes(String(p._id))}
                  onChange={() => toggleProf(String(p._id), "instructors")}
                  className="accent-blue-500" />
                <div className="flex-1 min-w-0">
                  <p className="text-snow text-xs font-medium">{p.name}</p>
                  <p className="text-dim text-xs font-mono truncate">{p.email}</p>
                </div>
              </label>
            ))}
            {professors.length === 0 && (
              <p className="text-soft text-xs text-center py-4">No professors found.</p>
            )}
          </div>
        </div>

        {/* TA picker */}
        <div className="space-y-2">
          <label className="text-xs text-soft font-medium">Teaching Assistants <span className="text-dim">(optional)</span></label>
          <div className="max-h-32 overflow-y-auto divide-y divide-edge border border-edge rounded-xl">
            {professors.filter(p => !form.instructors.includes(String(p._id))).map(p => (
              <label key={p._id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/2 cursor-pointer">
                <input type="checkbox"
                  checked={form.tas.includes(String(p._id))}
                  onChange={() => toggleProf(String(p._id), "tas")}
                  className="accent-violet-500" />
                <div className="flex-1 min-w-0">
                  <p className="text-snow text-xs font-medium">{p.name}</p>
                  <p className="text-dim text-xs font-mono truncate">{p.email}</p>
                </div>
              </label>
            ))}
            {professors.filter(p => !form.instructors.includes(String(p._id))).length === 0 && (
              <p className="text-soft text-xs text-center py-4">Assign instructors first to see TA candidates.</p>
            )}
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <Button onClick={handleSave} loading={saving}>
            <CheckCircle2 size={14} /> Create Course
          </Button>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </Modal>
  );
}

// ── Enroll Students Modal ─────────────────────────────────────────────────────

function EnrollStudentsModal({ course, allStudents, onClose, onEnrolled }) {
  const [enrolled,  setEnrolled]  = useState(new Set());
  const [selected,  setSelected]  = useState(new Set());
  const [query,     setQuery]     = useState("");
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [err,       setErr]       = useState("");

  useEffect(() => {
    getCourseStudents(course.id || course._id)
      .then(r => {
        setEnrolled(new Set(r.data.map(s => String(s.id || s._id))));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [course]);

  const filtered = allStudents.filter(s =>
    s.name.toLowerCase().includes(query.toLowerCase()) ||
    String(s._id).toLowerCase().includes(query.toLowerCase()) ||
    (s.email || "").toLowerCase().includes(query.toLowerCase())
  );

  const handleEnroll = async () => {
    if (selected.size === 0) return;
    setSaving(true);
    setErr("");
    try {
      await adminEnrollBulk({
        studentIds: Array.from(selected),
        course:     course.id || course._id,
      });
      setEnrolled(e => new Set([...e, ...selected]));
      setSelected(new Set());
      onEnrolled();
    } catch (e) {
      setErr(e.response?.data?.error || "Failed to enroll.");
    } finally {
      setSaving(false);
    }
  };

  const handleUnenroll = async (studentId) => {
    try {
      await adminUnenroll({ student: studentId, course: course.id || course._id });
      setEnrolled(e => { const s = new Set(e); s.delete(String(studentId)); return s; });
      onEnrolled();
    } catch {}
  };

  return (
    <Modal title={`Enroll Students`} subtitle={course.name} onClose={onClose} maxWidth="max-w-lg">
      <div className="p-5 space-y-4">
        {err && <p className="text-rose-400 text-xs">{err}</p>}

        {/* Search */}
        <div className="relative">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-dim" />
          <input value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Search students…"
            className="w-full bg-ink border border-edge rounded-xl text-sm text-snow placeholder:text-dim
              focus:outline-none focus:border-azure-500 transition-all pl-10 pr-4 py-2.5" />
        </div>

        {loading ? (
          <div className="flex justify-center py-8"><Spinner /></div>
        ) : (
          <div className="divide-y divide-edge border border-edge rounded-xl max-h-72 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="text-soft text-xs text-center py-6">No students found.</p>
            ) : filtered.map(s => {
              const id       = String(s._id);
              const isEnrolled = enrolled.has(id);
              const isSelected = selected.has(id);
              return (
                <div key={id} className="flex items-center gap-3 px-4 py-3 hover:bg-white/2 transition-colors">
                  {!isEnrolled && (
                    <input type="checkbox" checked={isSelected}
                      onChange={() => {
                        setSelected(sel => {
                          const n = new Set(sel);
                          n.has(id) ? n.delete(id) : n.add(id);
                          return n;
                        });
                      }}
                      className="accent-blue-500 shrink-0" />
                  )}
                  {isEnrolled && <CheckCircle2 size={14} className="text-jade-400 shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className="text-snow text-xs font-medium">{s.name}</p>
                    <p className="text-dim text-xs font-mono truncate">{s._id}</p>
                  </div>
                  {isEnrolled ? (
                    <button onClick={() => handleUnenroll(id)}
                      className="text-dim hover:text-rose-400 transition-colors text-xs px-2 py-1 rounded-lg hover:bg-rose-500/10">
                      Remove
                    </button>
                  ) : (
                    <span className="text-dim text-xs">Not enrolled</span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {selected.size > 0 && (
          <Button onClick={handleEnroll} loading={saving}>
            <UserPlus size={14} /> Enroll {selected.size} Student{selected.size !== 1 ? "s" : ""}
          </Button>
        )}
      </div>
    </Modal>
  );
}

// ── Course Analytics Modal (per-student view for admin) ───────────────────────

function CourseAnalyticsModal({ course, allStudents, onClose }) {
  const [data,     setData]     = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [err,      setErr]      = useState(null);
  const [query,    setQuery]    = useState("");
  const [viewStudent, setViewStudent] = useState(null); // { studentId, studentName }

  useEffect(() => {
    getCourseAnalytics(course.id || course._id)
      .then(r => setData(r.data))
      .catch(() => setErr("Could not load analytics."))
      .finally(() => setLoading(false));
  }, [course]);

  const studentMap = Object.fromEntries(allStudents.map(s => [String(s._id), s]));

  const filtered = (data?.studentStats || []).filter(s =>
    (s.name || "").toLowerCase().includes(query.toLowerCase()) ||
    String(s.student_id).toLowerCase().includes(query.toLowerCase())
  );

  return (
    <>
      <Modal title={`Course Analytics`} subtitle={`${course.name} · ${data?.totalLectures ?? "—"} lectures`} onClose={onClose} maxWidth="max-w-lg">
        <div className="p-5 space-y-4">
          {/* Summary strip */}
          {data && (
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Lectures",  value: data.totalLectures },
                { label: "Enrolled",  value: data.enrolled      },
                { label: "Avg Rate",  value: data.studentStats?.length
                    ? `${(data.studentStats.reduce((s,x) => s + x.percentage, 0) / data.studentStats.length).toFixed(1)}%`
                    : "—" },
              ].map((s, i) => (
                <div key={i} className="bg-ink border border-edge rounded-xl p-3 text-center">
                  <p className="text-soft text-xs uppercase tracking-widest mb-0.5">{s.label}</p>
                  <p className="text-snow text-lg font-bold">{s.value}</p>
                </div>
              ))}
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : err ? (
            <p className="text-rose-400 text-sm text-center">{err}</p>
          ) : (
            <>
              <div className="relative">
                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-dim" />
                <input value={query} onChange={e => setQuery(e.target.value)}
                  placeholder="Search students…"
                  className="w-full bg-ink border border-edge rounded-xl text-sm text-snow placeholder:text-dim
                    focus:outline-none focus:border-azure-500 transition-all pl-10 pr-4 py-2.5" />
              </div>

              <div className="divide-y divide-edge border border-edge rounded-xl max-h-80 overflow-y-auto">
                {filtered.length === 0 ? (
                  <p className="text-soft text-xs text-center py-6">No students found.</p>
                ) : filtered.map((s, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-3 hover:bg-white/2 transition-colors">
                    <div className="w-7 h-7 rounded-lg bg-azure-500/15 flex items-center justify-center shrink-0">
                      <span className="text-azure-400 text-xs font-bold">
                        {(s.name || "?").charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-snow text-xs font-medium">{s.name}</p>
                      <p className="text-dim text-xs font-mono">{s.attended}/{s.total} lectures</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="w-16">
                        <ProgressBar value={s.percentage} max={100} />
                      </div>
                      <AttendancePct value={s.percentage} small />
                      <button
                        onClick={() => setViewStudent({ studentId: s.student_id, studentName: s.name })}
                        className="text-xs text-azure-400 hover:text-azure-300 transition-colors px-2 py-1 rounded-lg bg-azure-500/10 border border-azure-500/20"
                      >
                        View
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </Modal>

      {viewStudent && (
        <StudentLectureHistory
          studentId={viewStudent.studentId}
          studentName={viewStudent.studentName}
          courseId={course.id || course._id}
          courseName={course.name}
          onClose={() => setViewStudent(null)}
        />
      )}
    </>
  );
}

// ── Manage TAs Modal ──────────────────────────────────────────────────────────

function ManageTAsModal({ course, professors, onClose, onUpdated }) {
  const [currentTAs, setCurrentTAs] = useState(
    (course.tas || []).map(String)
  );
  const [saving, setSaving] = useState(null);

  const handleToggle = async (profId) => {
    setSaving(profId);
    try {
      const isTA = currentTAs.includes(profId);
      if (isTA) {
        await removeTA(course.id || course._id, profId);
        setCurrentTAs(t => t.filter(x => x !== profId));
      } else {
        await addTA(course.id || course._id, profId);
        setCurrentTAs(t => [...t, profId]);
      }
      onUpdated();
    } catch {}
    finally { setSaving(null); }
  };

  // Instructors can't be TAs
  const instructorIds = (course.instructors || []).map(String);
  const candidates = professors.filter(p => !instructorIds.includes(String(p._id)));

  return (
    <Modal title="Manage TAs" subtitle={course.name} onClose={onClose}>
      <div className="p-5 space-y-3">
        <p className="text-soft text-xs">TAs get read/write access to sessions and schedules for this course.</p>
        <div className="divide-y divide-edge border border-edge rounded-xl max-h-80 overflow-y-auto">
          {candidates.length === 0 ? (
            <p className="text-soft text-xs text-center py-6">No eligible professors.</p>
          ) : candidates.map(p => {
            const pid  = String(p._id);
            const isTA = currentTAs.includes(pid);
            return (
              <div key={pid} className="flex items-center gap-3 px-4 py-3 hover:bg-white/2 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="text-snow text-xs font-medium">{p.name}</p>
                  <p className="text-dim text-xs font-mono truncate">{p.email}</p>
                </div>
                <button
                  onClick={() => handleToggle(pid)}
                  disabled={saving === pid}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                    isTA
                      ? "bg-violet-500/15 text-violet-400 border-violet-500/20 hover:bg-rose-500/15 hover:text-rose-400 hover:border-rose-500/20"
                      : "bg-jade-500/15 text-jade-400 border-jade-500/20 hover:bg-jade-500/25"
                  } disabled:opacity-40`}
                >
                  {saving === pid ? <Spinner size={12} /> : isTA ? "Remove TA" : "Add as TA"}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}

// ── Course Row ────────────────────────────────────────────────────────────────

function CourseRow({ course, professors, allStudents, colorIdx, onDelete, onRefresh }) {
  const [open,       setOpen]       = useState(false);
  const [modal,      setModal]      = useState(null); // "enroll" | "analytics" | "tas"
  const [deleting,   setDeleting]   = useState(false);

  const profMap = Object.fromEntries(professors.map(p => [String(p._id), p]));

  const instructorNames = (course.instructors || [])
    .map(id => profMap[String(id)]?.name || String(id));
  const taNames = (course.tas || [])
    .map(id => profMap[String(id)]?.name || String(id));

  const handleDelete = async () => {
    if (!window.confirm(`Delete course "${course.name}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await deleteCourse(course.id || course._id);
      onDelete(course.id || course._id);
    } catch {
      setDeleting(false);
    }
  };

  return (
    <>
      <div className="bg-card border border-edge rounded-2xl overflow-hidden animate-slide-up">
        {/* Colour bar */}
        <div className={`h-1 ${COURSE_COLORS[colorIdx % COURSE_COLORS.length]}`} />

        <div className="px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-snow font-semibold text-sm">{course.name}</h3>
                <Badge label={`Slot ${course.slot || "—"}`} variant="default" />
                {taNames.length > 0 && <Badge label={`${taNames.length} TA`} variant="ta" />}
              </div>
              <p className="text-soft text-xs font-mono mt-0.5">
                ID: {course.id || course._id} · {course.enrolled ?? "—"} enrolled
              </p>
              <p className="text-dim text-xs mt-1">
                {fmtDate(course.startDate)} → {fmtDate(course.endDate)}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button size="xs" variant="secondary" onClick={() => setModal("analytics")}>
                <Eye size={12} /> Analytics
              </Button>
              <Button size="xs" variant="jade" onClick={() => setModal("enroll")}>
                <UserPlus size={12} /> Enroll
              </Button>
              <Button size="xs" variant="violet" onClick={() => setModal("tas")}>
                <GraduationCap size={12} /> TAs
              </Button>
              <button onClick={handleDelete} disabled={deleting}
                className="text-dim hover:text-rose-400 transition-colors disabled:opacity-40 p-1.5 rounded-lg hover:bg-rose-500/10">
                {deleting ? <Spinner size={13} /> : <Trash2 size={13} />}
              </button>
              <button onClick={() => setOpen(o => !o)}
                className="text-dim hover:text-snow transition-colors p-1.5 rounded-lg hover:bg-white/5">
                {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
            </div>
          </div>

          {/* Expanded details */}
          {open && (
            <div className="mt-4 pt-4 border-t border-edge space-y-2">
              <div className="flex flex-wrap gap-4 text-xs">
                <div>
                  <p className="text-soft uppercase tracking-widest mb-1">Instructors</p>
                  {instructorNames.length ? instructorNames.map((n, i) => (
                    <p key={i} className="text-snow font-medium">{n}</p>
                  )) : <p className="text-dim">None assigned</p>}
                </div>
                {taNames.length > 0 && (
                  <div>
                    <p className="text-soft uppercase tracking-widest mb-1">TAs</p>
                    {taNames.map((n, i) => (
                      <p key={i} className="text-violet-400 font-medium">{n}</p>
                    ))}
                  </div>
                )}
                {course.classroom && (
                  <div>
                    <p className="text-soft uppercase tracking-widest mb-1">Classroom</p>
                    <p className="text-snow font-medium">{course.classroom}</p>
                  </div>
                )}
                <div>
                  <p className="text-soft uppercase tracking-widest mb-1">Lectures</p>
                  <p className="text-snow font-medium font-mono">{course.lectures?.length ?? "—"}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {modal === "enroll" && (
        <EnrollStudentsModal
          course={course}
          allStudents={allStudents}
          onClose={() => setModal(null)}
          onEnrolled={onRefresh}
        />
      )}
      {modal === "analytics" && (
        <CourseAnalyticsModal
          course={course}
          allStudents={allStudents}
          onClose={() => setModal(null)}
        />
      )}
      {modal === "tas" && (
        <ManageTAsModal
          course={course}
          professors={professors}
          onClose={() => setModal(null)}
          onUpdated={onRefresh}
        />
      )}
    </>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AdminCourses() {
  const [courses,    setCourses]    = useState([]);
  const [professors, setProfessors] = useState([]);
  const [students,   setStudents]   = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [query,      setQuery]      = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cRes, pRes, sRes] = await Promise.all([
        getAdminCourses(),
        getAdminProfessors(),
        getAdminStudents(),
      ]);
      setCourses(cRes.data);
      setProfessors(pRes.data);
      setStudents(sRes.data);
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = courses.filter(c =>
    c.name.toLowerCase().includes(query.toLowerCase()) ||
    String(c.id || c._id).toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="animate-slide-up flex items-center justify-between">
        <div>
          <h1 className="text-snow text-2xl font-bold tracking-tight">Courses</h1>
          <p className="text-soft text-sm mt-1">
            Create courses, enroll students, assign TAs, and view attendance analytics.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="text-dim hover:text-snow transition-colors p-2 rounded-xl hover:bg-white/5">
            <RefreshCw size={14} />
          </button>
          <Button onClick={() => setShowCreate(true)}>
            <Plus size={14} /> New Course
          </Button>
        </div>
      </div>

      {/* Search bar */}
      <div className="relative max-w-sm animate-slide-up" style={{ animationDelay: "60ms" }}>
        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-dim" />
        <input value={query} onChange={e => setQuery(e.target.value)}
          placeholder="Search courses…"
          className="w-full bg-card border border-edge rounded-xl text-sm text-snow placeholder:text-dim
            focus:outline-none focus:border-azure-500 transition-all pl-10 pr-4 py-2.5" />
      </div>

      {/* Courses list */}
      {loading ? (
        <div className="flex justify-center py-20"><Spinner size={28} /></div>
      ) : filtered.length === 0 ? (
        <Empty icon={BookOpen} title="No courses found"
          sub={courses.length === 0 ? "Create your first course to get started." : "No courses match your search."} />
      ) : (
        <div className="space-y-4">
          {filtered.map((c, i) => (
            <CourseRow
              key={c.id || c._id}
              course={c}
              professors={professors}
              allStudents={students}
              colorIdx={i}
              onDelete={(id) => setCourses(cs => cs.filter(x => (x.id || x._id) !== id))}
              onRefresh={load}
            />
          ))}
        </div>
      )}

      {showCreate && (
        <CreateCourseModal
          professors={professors}
          onClose={() => setShowCreate(false)}
          onCreated={(newCourse) => {
            setCourses(cs => [newCourse, ...cs]);
          }}
        />
      )}
    </div>
  );
}