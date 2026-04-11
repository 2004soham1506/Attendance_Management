const express  = require('express');
const Beacon   = require('../models/Beacon');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// ── GET /getMinor?major=... ───────────────────────────────────────────────────
// Returns the minor (classroom) associated with a BLE major ID
router.get('/getMinor', authenticate, async (req, res, next) => {
  try {
    const { major } = req.query;
    if (!major) return res.status(400).json({ error: 'major required' });

    const beacon = await Beacon.findOne({ bleID: major }).lean();
    if (!beacon) return res.status(404).json({ error: 'Beacon not found' });

    res.json({ minor: beacon.classroom, beacon });
  } catch (err) { next(err); }
});

// ── GET /validate?major=...&minor=... ─────────────────────────────────────────
router.get('/validate', authenticate, async (req, res, next) => {
  try {
    const { major, minor } = req.query;
    if (!major || !minor) return res.status(400).json({ error: 'major and minor required' });

    const beacon = await Beacon.findOne({ bleID: major, classroom: minor }).lean();
    res.json({ valid: !!beacon, beacon: beacon || null });
  } catch (err) { next(err); }
});

// ── POST /admin/beacons  (admin) ──────────────────────────────────────────────
router.post('/admin/beacons', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const beacon = await Beacon.create(req.body);
    res.status(201).json(beacon);
  } catch (err) { next(err); }
});

router.get('/admin/beacons', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    res.json(await Beacon.find().lean());
  } catch (err) { next(err); }
});

module.exports = router;