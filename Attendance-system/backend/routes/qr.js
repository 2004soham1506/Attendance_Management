/**
 * qr.js — Toy QR fallback (decodeQR only)
 *
 * The real QR service endpoints (/getQR/:sessionId and /qr/validate) are
 * handled by microservices.js which proxies to the QR microservice and only
 * falls back to local HMAC logic when the service is unavailable.
 *
 * This file now exposes ONLY /decodeQR — a convenience endpoint that lets
 * any client verify a QR token locally (useful for debugging / mobile fallback)
 * without going through the microservice.
 *
 * DO NOT add /getQR here — doing so creates a duplicate route that would
 * shadow the microservice proxy registered earlier in server.js.
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

// ── GET /decodeQR?qr=... ──────────────────────────────────────────────────────
// Validates a scanned QR token and returns session info.
// Used as a local fallback when the QR microservice is unavailable.
router.get('/decodeQR', authenticate, async (req, res, next) => {
  try {
    const { qr } = req.query;
    if (!qr) return res.status(400).json({ error: 'qr parameter required' });

    const sessionId = verifyToken(qr);
    if (!sessionId) return res.status(400).json({ error: 'Invalid or expired QR code' });

    const session = await Session.findOne({ sessionUID: sessionId }).lean();
    if (!session) return res.status(404).json({ error: 'Session not found' });

    // Check session is still active
    if (!session.active) return res.status(410).json({ error: 'Session has ended' });

    res.json({ valid: true, sessionId, courseId: session.course, method: 'QRCode' });
  } catch (err) { next(err); }
});

module.exports = router;