import axios from "axios";

const API = axios.create({
  baseURL: localStorage.getItem("api_url") || "http://localhost:4040",
  timeout: 8000,
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
export const getCourseStudents = (courseId) => API.get(`/course/${courseId}/students`);

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
export const getAdminStats      = ()         => API.get("/admin/stats");
export const getCourseAnalytics = (courseId) => API.get(`/analytics/course/${courseId}`);
export const getProfAnalytics   = (profId)   => API.get(`/analytics/prof/${profId}`);

// ── Beacon ────────────────────────────────────────────────────────────────────
export const getMinor       = (major)        => API.get(`/getMinor?major=${major}`);
export const validateBeacon = (major, minor) => API.get(`/validate?major=${major}&minor=${minor}`);

export default API;