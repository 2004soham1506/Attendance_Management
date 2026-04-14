import axios from "axios";

const API = axios.create({
  // baseURL: localStorage.getItem("api_url") || "http://localhost:4040",
  baseURL: localStorage.getItem("api_url") || "https://attendance-management-gazr.onrender.com",
  timeout: 10000,
});

// Token lives in sessionStorage (closes with browser tab)
API.interceptors.request.use(cfg => {
  const token = sessionStorage.getItem("diams_token");
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

// ── Auth ──────────────────────────────────────────────────────────────────────
export const login = (data) => API.post("/login", data);

// ── Courses ───────────────────────────────────────────────────────────────────
export const getCourses        = (profId)   => API.get(`/courses/${profId}`);
export const getAllCourses      = ()         => API.get("/admin/courses");
export const createCourse      = (data)     => API.post("/courses", data);
export const updateCourse      = (id, data) => API.put(`/courses/${id}`, data);
export const deleteCourse      = (id)       => API.delete(`/courses/${id}`);
export const getCourseStudents = (courseId) => API.get(`/course/${courseId}/students`);

// ── Schedules ─────────────────────────────────────────────────────────────────
export const getCourseSchedules = (courseId)            => API.get(`/courses/${courseId}/schedules`);
export const addSchedule        = (courseId, data)      => API.post(`/courses/${courseId}/schedule`, data);
export const updateSchedule     = (courseId, idx, data) => API.patch(`/courses/${courseId}/schedule/${idx}`, data);
export const deleteScheduleItem = (courseId, idx)       => API.delete(`/courses/${courseId}/schedule/${idx}`);
export const replaceSchedules   = (courseId, list)      => API.put(`/courses/${courseId}/schedule`, { schedules: list });

// ── TA management (admin) ─────────────────────────────────────────────────────
export const addTA    = (courseId, studentId) => API.post(`/admin/courses/${courseId}/tas`, { student_id: studentId });
export const removeTA = (courseId, studentId) => API.delete(`/admin/courses/${courseId}/tas/${studentId}`);

// ── Sessions ──────────────────────────────────────────────────────────────────
export const startSession     = (data)      => API.post("/startSession", data);
export const endSession       = (sessionId) => API.post(`/endSession/${sessionId}`);
export const getActiveSession = (courseId)  => API.get(`/activeSession?course_id=${courseId}`);

// ── BLE / QR microservice ─────────────────────────────────────────────────────
export const bleValidate    = (data)         => API.post("/ble/validate", data);
export const getMinor       = (major)        => API.get(`/getMinor?major=${major}`);
export const getQR          = (sessionId)    => API.get(`/getQR/${sessionId}`);
export const qrValidate     = (data)         => API.post("/qr/validate", data);
export const validateBeacon = (major, minor) => API.get(`/validate?major=${major}&minor=${minor}`);

// ── Attendance ────────────────────────────────────────────────────────────────
export const getAttendance        = (sessionId) => API.get(`/attendance/${sessionId}`);
export const markAttendance       = (data)      => API.post("/markAttendance", data);
export const manualAttendance     = (data)      => API.post("/manualAttendance", data);
export const manualAttendanceBulk = (data)      => API.post("/manualAttendance/bulk", data);

// ── Analytics ─────────────────────────────────────────────────────────────────
export const getAdminStats            = ()                    => API.get("/admin/stats");
export const getAdminAnalytics        = ()                    => API.get("/analytics/admin");
export const getCourseAnalytics       = (courseId)            => API.get(`/analytics/course/${courseId}`);
export const getCourseStudentStats    = (courseId)            => API.get(`/analytics/course/${courseId}/students`);
export const getProfAnalytics         = (profId)              => API.get(`/analytics/prof/${profId}`);
export const getStudentCourseHistory  = (studentId, courseId) => API.get(`/student/${studentId}/history/${courseId}`);
export const getAtRiskStudents        = (profId)              => API.get(`/analytics/at-risk/${profId}`);
export const getAdminStudentAnalytics = (studentId)           => API.get(`/admin/student/${studentId}/analytics`);

// NEW: per-course student attendance breakdown for admin Courses page
export const getAdminCourseAnalytics  = (courseId)            => API.get(`/admin/courses/${courseId}/analytics`);

// ── Admin – Users ─────────────────────────────────────────────────────────────
export const getAllUsers     = ()     => API.get("/admin/users");
export const getAllStudents  = ()     => API.get("/admin/students");   // NEW: used by AdminStudents page
export const createProfessor = (data) => API.post("/admin/professors", data);
export const deleteProfessor = (id)   => API.delete(`/admin/professors/${id}`);
export const createStudent   = (data) => API.post("/admin/students", data);
export const deleteStudent   = (id)   => API.delete(`/admin/students/${id}`);

// ── Admin – Enrollment ────────────────────────────────────────────────────────
export const enrollStudent     = (data) => API.post("/admin/enroll", data);
export const enrollBulk        = (data) => API.post("/admin/enroll/bulk", data);
export const unenrollStudent   = (data) => API.post("/admin/unenroll", data);
export const getCourseEnrolled = (cId)  => API.get(`/admin/enrollments/${cId}`);

// ── Admin – CSV bulk operations ───────────────────────────────────────────────
export const csvBulkCreate = (formData) => API.post("/admin/csv/bulk-create", formData, {
  headers: { "Content-Type": "multipart/form-data" },
});
export const csvBulkDelete = (formData) => API.post("/admin/csv/bulk-delete", formData, {
  headers: { "Content-Type": "multipart/form-data" },
});

export default API;