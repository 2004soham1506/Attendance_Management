const express   = require('express');
const bcrypt    = require('bcryptjs');
const jwt       = require('jsonwebtoken');
const Admin     = require('../models/Admin');
const Professor = require('../models/Professor');
const Student   = require('../models/Student');
const Course    = require('../models/Course');

const router = express.Router();
const SECRET = process.env.JWT_SECRET || 'changeme-secret';

/**
 * POST /login
 * Body: { email, password }
 *
 * TAs are Students who are assigned as TAs on at least one course.
 * They log in with student credentials but get role='ta' if they're a TA,
 * which grants them the same course-level access as professors for those courses.
 */
router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password required' });
    }

    let user = null;
    let role = null;

    // 1. Admin
    user = await Admin.findOne({ email }).lean();
    if (user) role = 'admin';

    // 2. Professor
    if (!user) {
      user = await Professor.findOne({ email }).lean();
      if (user) role = 'prof';
    }

    // 3. Student (possibly a TA)
    if (!user) {
      const student = await Student.findOne({ email }).lean();
      if (student) {
        user = student;
        // Check if this student is a TA on any course
        const taCount = await Course.countDocuments({ tas: student._id });
        role = taCount > 0 ? 'ta' : 'student';
      }
    }

    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    const payload = { user_id: user._id, role, email: user.email };
    const token   = jwt.sign(payload, SECRET, { expiresIn: '12h' });

    res.json({
      token,
      user_id: user._id,
      role,
      name:    user.name || user._id,
      email:   user.email,
    });
  } catch (err) { next(err); }
});

module.exports = router;