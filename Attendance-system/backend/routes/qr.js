/**
 * QR Microservice — Toy Implementation
 *
 * Real system would be a separate service. Here we simulate:
 *  - A HMAC-signed token that rotates every 5 seconds (window = Math.floor(ts/5000))
 *  - GET /getQR/:sessionId   → returns the current token (frontend renders as QR)
 *  - GET /decodeQR?qr=...    → validates a scanned token and returns session info
 *
 * The token format: base64( JSON({ sessionId, window, sig: HMAC(sessionId+window) }) )
 */

const express = require('express');
const crypto  = require('crypto');
const Session = require('../models/Session');
const { authenticate } = require('../middleware/auth');

const router = express.Router();
const QR_SECRET = process.env.QR_SECRET || 'qr-toy-secret';

function currentWindow() {
  return Math.floor(Date.now() / 5000);
}

function makeToken(sessionId, window) {
  const payload = `${sessionId}:${window}`;
  const sig     = crypto.createHmac('sha256', QR_SECRET).update(payload).digest('hex').slice(0, 16);
  return Buffer.from(JSON.stringify({ sessionId, window, sig })).toString('base64url');
}

function verifyToken(token) {
  try {
    const { sessionId, window: w, sig } = JSON.parse(Buffer.from(token, 'base64url').toString());
    const now = currentWindow();
    // Accept current window or the one just before (grace for 5-sec boundary)
    if (Math.abs(now - w) > 1) return null;
    const expected = crypto.createHmac('sha256', QR_SECRET)
      .update(`${sessionId}:${w}`).digest('hex').slice(0, 16);
    if (sig !== expected) return null;
    return sessionId;
  } catch {
    return null;
  }
}

// ── GET /getQR/:sessionId ─────────────────────────────────────────────────────
router.get('/getQR/:sessionId', authenticate, async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    const session = await Session.findOne({ sessionUID: sessionId }).lean();
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const token   = makeToken(sessionId, currentWindow());
    const expiresIn = 5000 - (Date.now() % 5000); // ms until next rotation

    res.json({
      qr:        token,
      expiresIn, // frontend uses this to know when to refresh
      sessionId,
    });
  } catch (err) { next(err); }
});

// ── GET /decodeQR?qr=... ──────────────────────────────────────────────────────
router.get('/decodeQR', authenticate, async (req, res, next) => {
  try {
    const { qr } = req.query;
    if (!qr) return res.status(400).json({ error: 'qr parameter required' });

    const sessionId = verifyToken(qr);
    if (!sessionId) return res.status(400).json({ error: 'Invalid or expired QR code' });

    const session = await Session.findOne({ sessionUID: sessionId }).lean();
    if (!session) return res.status(404).json({ error: 'Session not found' });

    // Check session is still active
    const expiresAt = new Date(session.timestamp.getTime() + session.duration * 60000);
    if (Date.now() > expiresAt) return res.status(410).json({ error: 'Session has ended' });

    res.json({ valid: true, sessionId, courseId: session.course, method: 'QRCode' });
  } catch (err) { next(err); }
});

module.exports = router;