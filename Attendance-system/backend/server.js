require('dotenv').config();
const express    = require('express');
const mongoose   = require('mongoose');
const cors       = require('cors');
const helmet     = require('helmet');
const rateLimit  = require('express-rate-limit');

const authRoutes          = require('./routes/auth');
const courseRoutes        = require('./routes/courses');
const sessionRoutes       = require('./routes/sessions');
const attendanceRoutes    = require('./routes/attendance');
const analyticsRoutes     = require('./routes/analytics');
const adminRoutes         = require('./routes/admin');
const microserviceRoutes  = require('./routes/microservices'); // BLE + QR proxy
const qrRoutes            = require('./routes/qr');            // toy QR fallback (kept)
const studentRoutes       = require('./routes/student');

const { startAllJobs } = require('./jobs');

const app = express();

app.set('trust proxy', 1);

// ── Security ──────────────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || '*' }));
app.use(express.json());

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20,
  message: { error: 'Too many login attempts' } });
app.use('/login', authLimiter);

const limiter = rateLimit({ windowMs: 60 * 1000, max: 300,
  standardHeaders: true, legacyHeaders: false });
app.use(limiter);

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/',          authRoutes);
app.use('/',          courseRoutes);
app.use('/',          sessionRoutes);
app.use('/',          attendanceRoutes);
app.use('/analytics', analyticsRoutes);
app.use('/admin',     adminRoutes);
app.use('/',          microserviceRoutes); // /getMinor, /ble/validate, /getQR/:id, /qr/validate, /validate
app.use('/',          qrRoutes);           // toy /decodeQR fallback
app.use('/student',   studentRoutes);

// ── Health ────────────────────────────────────────────────────────────────────
app.get('/health', (_, res) => res.json({
  status: 'ok', ts: new Date(),
  services: {
    ble: process.env.BLE_SERVICE_URL || 'http://localhost:8000',
    qr:  process.env.QR_SERVICE_URL  || 'http://localhost:8000',
  },
}));

// ── Error handler ─────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    return res.status(409).json({ error: `Duplicate value for ${field}` });
  }
  if (err.name === 'ValidationError') {
    return res.status(400).json({ error: err.message });
  }
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

// ── DB + Boot ─────────────────────────────────────────────────────────────────
mongoose
  // .connect(process.env.MONGO_URI || 'mongodb://localhost:27017/attendance', {
  //   maxPoolSize: 50,
  //   serverSelectionTimeoutMS: 5000,
  //   socketTimeoutMS: 45000,
  // })
  .connect(process.env.MONGO_URI || 'mongodb+srv://admin:H1nvgEoQ2gul5YDG@cluster0.ksheidh.mongodb.net/attendance=Cluster0', {
    maxPoolSize: 50,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  })
  .then(() => {
    console.log('MongoDB connected');
    startAllJobs();
    const PORT = process.env.PORT || 4040;
    app.listen(PORT, () => console.log(`Server on :${PORT}`));
  })
  .catch(err => { console.error('DB error', err); process.exit(1); });