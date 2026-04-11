const jwt = require('jsonwebtoken');

const SECRET = process.env.JWT_SECRET || 'changeme-secret';

/**
 * Attaches req.user from JWT.
 */
function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  const token = header.slice(7);
  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Factory: only allow specific roles.
 * Usage: authorize('admin')  or  authorize('prof', 'admin')
 */
function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthenticated' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    next();
  };
}

/**
 * A professor or TA may only act on courses they teach / are TA for.
 * Admins bypass this check.
 *
 * Sets req.course and req.isTa on the request for downstream use.
 */
async function ownsCourse(req, res, next) {
  if (req.user.role === 'admin') return next();
  const Course = require('../models/Course');
  const courseId = req.params.courseId || req.body.course_id;
  if (!courseId) return res.status(400).json({ error: 'course_id required' });

  const course = await Course.findById(courseId).lean();
  if (!course) return res.status(404).json({ error: 'Course not found' });

  const uid     = req.user.user_id;
  const isInstr = course.instructors.includes(uid);
  const isTa    = Array.isArray(course.tas) && course.tas.includes(uid);

  if (!isInstr && !isTa) {
    return res.status(403).json({ error: 'You are not an instructor or TA for this course' });
  }

  req.course = course;
  req.isTa   = isTa && !isInstr;
  next();
}

/**
 * Requires instructor role specifically (not just TA).
 * Call after ownsCourse.
 */
function requireInstructor(req, res, next) {
  if (req.user.role === 'admin') return next();
  if (req.isTa) return res.status(403).json({ error: 'TAs cannot perform this action' });
  next();
}

module.exports = { authenticate, authorize, ownsCourse, requireInstructor };