import axios from "axios";

const API = axios.create({
  baseURL: localStorage.getItem("api_url") || "http://localhost:4040",
  timeout: 10000,
});

// Attach JWT on every request
API.interceptors.request.use(cfg => {
  const token = localStorage.getItem("token");
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
export const getCourseStudents = (courseId) => API.get(`/course/${courseId}/students`);

// ── Schedules ─────────────────────────────────────────────────────────────────
export const getCourseSchedules = (courseId)        => API.get(`/courses/${courseId}/schedules`);
export const addSchedule        = (courseId, data)  => API.post(`/courses/${courseId}/schedule`, data);
export const updateSchedule     = (courseId, idx, data) => API.patch(`/courses/${courseId}/schedule/${idx}`, data);
export const deleteSchedule     = (courseId, idx)   => API.delete(`/courses/${courseId}/schedule/${idx}`);
export const replaceSchedules   = (courseId, list)  => API.put(`/courses/${courseId}/schedule`, { schedules: list });

// ── Sessions ──────────────────────────────────────────────────────────────────
export const startSession     = (data)      => API.post("/startSession", data);
export const endSession       = (sessionId) => API.post(`/endSession/${sessionId}`);
export const getActiveSession = (courseId)  => API.get(`/activeSession?course_id=${courseId}`);

// ── QR ────────────────────────────────────────────────────────────────────────
export const getQR    = (sessionId) => API.get(`/getQR/${sessionId}`);
export const decodeQR = (qr)        => API.get(`/decodeQR?qr=${qr}`);

// ── Attendance ────────────────────────────────────────────────────────────────
export const getAttendance        = (sessionId) => API.get(`/attendance/${sessionId}`);
export const markAttendance       = (data)      => API.post("/markAttendance", data);
export const manualAttendance     = (data)      => API.post("/manualAttendance", data);
export const manualAttendanceBulk = (data)      => API.post("/manualAttendance/bulk", data);

// ── Analytics ─────────────────────────────────────────────────────────────────
export const getAdminStats           = ()                    => API.get("/admin/stats");
export const getAdminAnalytics       = ()                    => API.get("/analytics/admin");
export const getCourseAnalytics      = (courseId)            => API.get(`/analytics/course/${courseId}`);
export const getCourseStudentStats   = (courseId)            => API.get(`/analytics/course/${courseId}/students`);
export const getProfAnalytics        = (profId)              => API.get(`/analytics/prof/${profId}`);
export const getStudentCourseHistory = (studentId, courseId) => API.get(`/student/${studentId}/history/${courseId}`);
export const getAtRiskStudents       = (profId)              => API.get(`/analytics/at-risk/${profId}`);
export const getAdminStudentAnalytics = (studentId)          => API.get(`/admin/student/${studentId}/analytics`);

// ── Admin – Users ─────────────────────────────────────────────────────────────
export const getAllUsers       = ()       => API.get("/admin/users");
export const createProfessor   = (data)  => API.post("/admin/professors", data);
export const deleteProfessor   = (id)    => API.delete(`/admin/professors/${id}`);
export const createStudent     = (data)  => API.post("/admin/students", data);
export const deleteStudent     = (id)    => API.delete(`/admin/students/${id}`);

// ── Admin – Enrollment ────────────────────────────────────────────────────────
export const enrollStudent     = (data)  => API.post("/admin/enroll", data);
export const enrollBulk        = (data)  => API.post("/admin/enroll/bulk", data);
export const unenrollStudent   = (data)  => API.post("/admin/unenroll", data);
export const getCourseEnrolled = (cId)   => API.get(`/admin/enrollments/${cId}`);

// ── Beacon ────────────────────────────────────────────────────────────────────
export const getMinor       = (major)        => API.get(`/getMinor?major=${major}`);
export const validateBeacon = (major, minor) => API.get(`/validate?major=${major}&minor=${minor}`);

export default API;