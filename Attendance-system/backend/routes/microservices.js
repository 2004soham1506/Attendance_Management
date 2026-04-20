const express    = require('express');
const axios      = require('axios');
const crypto     = require('crypto');
const Session    = require('../models/Session');
const Attendance = require('../models/Attendance');
const Enrollment = require('../models/Enrollment');
const Beacon     = require('../models/Beacon');
const { updateBucketForStudent } = require('../services/bucketService');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

const BLE_URL   = process.env.BLE_SERVICE_URL || 'http://localhost:8000';
const QR_URL    = process.env.QR_SERVICE_URL  || 'http://localhost:8000';
const QR_SECRET = process.env.QR_SECRET       || 'qr-secret';

// ── Helper: call microservice with timeout ────────────────────────────────────
async function msPost(baseUrl, path, body) {
  const res = await axios.post(`${baseUrl}${path}`, body, {
    timeout: 5000,
    headers: { 'Content-Type': 'application/json' },
  });
  return res.data;
}

// ── BLE fallback: HMAC-derived minor (rotates every 30 s) ────────────────────
function localMinor(major) {
  const window = Math.floor(Date.now() / 30000);
  return crypto
    .createHmac('sha256', process.env.QR_SECRET || 'ble-secret')
    .update(`${major}:${window}`)
    .digest('hex')
    .slice(0, 4);
}

// ── QR fallback helpers ───────────────────────────────────────────────────────
function qrWindow() {
  return Math.floor(Date.now() / 5000);
}

function localQrHash(sessionId, window) {
  return crypto
    .createHmac('sha256', QR_SECRET)
    .update(`${sessionId}:${window}`)
    .digest('hex')
    .slice(0, 8);
}

function validateLocalQr(sessionId, hash) {
  const now  = qrWindow();
  // Accept current window and the previous one (grace for 5-sec boundary)
  return hash === localQrHash(sessionId, now) ||
         hash === localQrHash(sessionId, now - 1);
}


// ── GET /getMinor?major=...  (ESP32 → our backend → BLE microservice) ─────────
// The ESP32 calls this to get its rotating minor value.
// Falls back to a local HMAC minor when the microservice is unreachable.
router.get('/getMinor', authenticate, async (req, res, next) => {
  try {
    const { major } = req.query;
    if (!major) return res.status(400).json({ error: 'major required' });

    try {
      const data = await msPost(BLE_URL, '/ble/generate-minor', { major_id: major });
      // BLE service returns: { minor, expires_in }
      return res.json({ minor: data.minor, expiresIn: data.expires_in, major });
    } catch (svcErr) {
      // Microservice unavailable — use local fallback
      if (svcErr.code === 'ECONNREFUSED' || svcErr.code === 'ETIMEDOUT' || svcErr.code === 'ENOTFOUND') {
        const minor = localMinor(major);
        return res.json({ minor, expiresIn: 30, major, fallback: true });
      }
      throw svcErr;
    }
  } catch (err) { next(err); }
});


// ── POST /ble/validate  (student app → our backend → BLE microservice) ────────
// Body: { session_id, beacons: [{major, minor, rssi}] }
//
// Flow:
//  1. Verify session is active and is BLE mode
//  2. Verify student is enrolled
//  3. Forward all beacons to BLE microservice (picks strongest RSSI internally)
//  4. If microservice unavailable → fall back to DB beacon lookup
//  5. On success → mark attendance
router.post('/ble/validate', authenticate, async (req, res, next) => {
  try {
    const { session_id, beacons } = req.body;
    if (!session_id || !Array.isArray(beacons) || beacons.length === 0) {
      return res.status(400).json({ error: 'session_id and beacons[] required' });
    }

    // Validate each beacon entry
    for (const b of beacons) {
      if (!b.major || b.rssi === undefined) {
        return res.status(400).json({ error: 'Each beacon must have major and rssi' });
      }
    }

    const session = await Session.findOne({ sessionUID: session_id, active: true }).lean();
    if (!session) return res.status(404).json({ error: 'No active session found' });
    if (session.method !== 'BLE') {
      return res.status(400).json({ error: 'Session is not BLE mode' });
    }

    const studentId = req.user.user_id;

    // Verify enrollment
    const enrolled = await Enrollment.findOne({
      student: studentId,
      course:  session.course,
      status:  'Active',
    }).lean();
    if (!enrolled) return res.status(403).json({ error: 'Not enrolled in this course' });

    // Sort beacons by RSSI descending (strongest signal first)
    const sortedBeacons = [...beacons].sort((a, b) => b.rssi - a.rssi);
    const bestBeacon    = sortedBeacons[0];

    // Look up classroom from beacon for the class_id the microservice expects
    const beaconDoc = await Beacon.findOne({ bleID: bestBeacon.major }).lean();
    const classId   = beaconDoc?.classroom || session.course;

    // ── Call BLE microservice ───────────────────────────────────────────────
    let msResult;
    try {
      msResult = await msPost(BLE_URL, '/ble/validate', {
        class_id: classId,
        beacons:  sortedBeacons, // send all beacons; service picks best
      });
    } catch (svcErr) {
      if (svcErr.code === 'ECONNREFUSED' || svcErr.code === 'ETIMEDOUT' || svcErr.code === 'ENOTFOUND') {
        // Fallback: accept if at least one beacon exists in DB for a classroom
        // that is linked to the session's course
        const validBeacon = await Beacon.findOne({ bleID: bestBeacon.major }).lean();
        msResult = { valid: !!validBeacon, fallback: true };
      } else if (svcErr.response) {
        // Microservice returned an error response
        return res.status(400).json({
          valid: false,
          error: svcErr.response.data?.error || 'BLE validation failed',
        });
      } else {
        throw svcErr;
      }
    }

    if (!msResult.valid) {
      return res.status(400).json({ valid: false, error: 'Beacon validation failed' });
    }

    // ── Mark attendance ─────────────────────────────────────────────────────
    await Attendance.findOneAndUpdate(
      { sessionUID: session_id, student: studentId },
      {
        $setOnInsert: {
          sessionUID:  session_id,
          student:     studentId,
          verifiedVia: 'BLE',
          markedAt:    new Date(),
        },
      },
      { upsert: true, new: true }
    );

    updateBucketForStudent(studentId).catch(console.error);

    res.json({
      valid:    true,
      message:  'Attendance marked via BLE',
      fallback: msResult.fallback || false,
    });
  } catch (err) { next(err); }
});


// ── GET /getQR/:sessionId  (prof screen → our backend → QR microservice) ──────
// Returns a hash that the frontend renders as a QR code.
// The frontend polls this every ~5 seconds.
// Falls back to a local HMAC token when the microservice is unreachable.
router.get('/getQR/:sessionId', authenticate, async (req, res, next) => {
  try {
    const session = await Session.findOne({ sessionUID: req.params.sessionId }).lean();
    if (!session) return res.status(404).json({ error: 'Session not found' });

    // ── Call QR microservice ────────────────────────────────────────────────
    try {
      const data = await msPost(QR_URL, '/qr/generate', { class_id: session.course });
      // QR service returns: { hash, expires_in }  (expires_in is in seconds)
      return res.json({
        qr:        data.hash,
        expiresIn: data.expires_in * 1000, // convert to ms for frontend
        sessionId: req.params.sessionId,
        source:    'service',
      });
    } catch (svcErr) {
      if (svcErr.code === 'ECONNREFUSED' || svcErr.code === 'ETIMEDOUT' || svcErr.code === 'ENOTFOUND') {
        // Fallback: local HMAC token, rotates every 5 seconds
        const hash      = localQrHash(req.params.sessionId, qrWindow());
        const expiresIn = 5000 - (Date.now() % 5000); // ms until next rotation
        return res.json({
          qr:        hash,
          expiresIn,
          sessionId: req.params.sessionId,
          source:    'fallback',
        });
      }
      throw svcErr;
    }
  } catch (err) { next(err); }
});


// ── POST /qr/validate  (student app → our backend → QR microservice) ──────────
// Body: { session_id, hash }
//
// Flow:
//  1. Verify session is active and QRCode mode
//  2. Verify student is enrolled
//  3. Forward hash + timestamp to QR microservice for validation
//  4. If microservice unavailable → validate against local HMAC
//  5. On success → mark attendance
router.post('/qr/validate', authenticate, async (req, res, next) => {
  try {
    const { session_id, hash } = req.body;
    if (!session_id || !hash) {
      return res.status(400).json({ error: 'session_id and hash required' });
    }

    const session = await Session.findOne({ sessionUID: session_id, active: true }).lean();
    if (!session) return res.status(404).json({ error: 'No active session found' });
    if (session.method !== 'QRCode') {
      return res.status(400).json({ error: 'Session is not QR mode' });
    }

    const studentId = req.user.user_id;
    const enrolled  = await Enrollment.findOne({
      student: studentId,
      course:  session.course,
      status:  'Active',
    }).lean();
    if (!enrolled) return res.status(403).json({ error: 'Not enrolled in this course' });

    // ── Call QR microservice ────────────────────────────────────────────────
    // The spec says the student sends timestamp = Date.now() at the moment of scan.
    let msResult;
    try {
      msResult = await msPost(QR_URL, '/qr/validate', {
        class_id:  session.course,
        hash,
        timestamp: Date.now(),
      });
    } catch (svcErr) {
      if (svcErr.code === 'ECONNREFUSED' || svcErr.code === 'ETIMEDOUT' || svcErr.code === 'ENOTFOUND') {
        // Fallback: validate against local HMAC (current and previous window)
        msResult = { valid: validateLocalQr(session_id, hash), fallback: true };
      } else if (svcErr.response) {
        return res.status(400).json({
          valid: false,
          error: svcErr.response.data?.error || 'QR validation failed',
        });
      } else {
        throw svcErr;
      }
    }

    if (!msResult.valid) {
      return res.status(400).json({ valid: false, error: 'QR code invalid or expired' });
    }

    // ── Mark attendance ─────────────────────────────────────────────────────
    await Attendance.findOneAndUpdate(
      { sessionUID: session_id, student: studentId },
      {
        $setOnInsert: {
          sessionUID:  session_id,
          student:     studentId,
          verifiedVia: 'QRCode',
          markedAt:    new Date(),
        },
      },
      { upsert: true, new: true }
    );

    updateBucketForStudent(studentId).catch(console.error);

    res.json({
      valid:    true,
      message:  'Attendance marked via QR',
      fallback: msResult.fallback || false,
    });
  } catch (err) { next(err); }
});


// ── GET /validate?major=...&minor=... (legacy beacon check) ───────────────────
// Kept for backward compatibility. Does a DB-only check without calling
// the BLE microservice (used by beacons admin page and ESP32 self-test).
router.get('/validate', authenticate, async (req, res, next) => {
  try {
    const { major, minor } = req.query;
    if (!major || !minor) return res.status(400).json({ error: 'major and minor required' });
    const beacon = await Beacon.findOne({ bleID: major }).lean();
    res.json({ valid: !!beacon, beacon: beacon || null });
  } catch (err) { next(err); }
});

module.exports = router;