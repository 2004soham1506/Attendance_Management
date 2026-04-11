require('dotenv').config();
const express    = require('express');
const mongoose   = require('mongoose');
const cors       = require('cors');
const helmet     = require('helmet');
const rateLimit  = require('express-rate-limit');

const authRoutes       = require('./routes/auth');
const courseRoutes     = require('./routes/courses');
const sessionRoutes    = require('./routes/sessions');
const attendanceRoutes = require('./routes/attendance');
const analyticsRoutes  = require('./routes/analytics');
const adminRoutes      = require('./routes/admin');
const beaconRoutes     = require('./routes/beacons');
const qrRoutes         = require('./routes/qr');
const studentRoutes    = require('./routes/student');

const { startAllJobs } = require('./jobs');

const app = express();

// ── Security ──────────────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));
app.use(express.json());

// Stricter rate limit for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      20,
  message:  { error: 'Too many login attempts, please try again later' },
});
app.use('/login', authLimiter);

// General limiter
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 min window
  max:      300,            // 300 req/min per IP — supports ~5000 concurrent users
  standardHeaders: true,
  legacyHeaders:   false,
});
app.use(limiter);

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/',          authRoutes);
app.use('/',          courseRoutes);
app.use('/',          sessionRoutes);
app.use('/',          attendanceRoutes);
app.use('/analytics', analyticsRoutes);
app.use('/admin',     adminRoutes);
app.use('/',          beaconRoutes);
app.use('/',          qrRoutes);
app.use('/student',   studentRoutes);

// ── Health ────────────────────────────────────────────────────────────────────
app.get('/health', (_, res) => res.json({ status: 'ok', ts: new Date() }));

// ── Error handler ─────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    return res.status(409).json({ error: `Duplicate value for ${field}` });
  }
  // Mongoose validation
  if (err.name === 'ValidationError') {
    return res.status(400).json({ error: err.message });
  }
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

// ── DB + Boot ─────────────────────────────────────────────────────────────────
mongoose
  .connect(process.env.MONGO_URI || 'mongodb://localhost:27017/attendance', {
    maxPoolSize:       50,   // up to 50 concurrent DB connections
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS:   45000,
  })
  .then(() => {
    console.log('MongoDB connected');
    startAllJobs();
    const PORT = process.env.PORT || 4040;
    app.listen(PORT, () => console.log(`Server listening on :${PORT}`));
  })
  .catch(err => { console.error('DB connection failed', err); process.exit(1); });