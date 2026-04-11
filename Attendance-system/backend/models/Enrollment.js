const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const EnrollmentSchema = new mongoose.Schema({
  student: {
    type: String,
    required: true,
    ref: 'Student'
  },
  course: {
    type: String,
    required: true,
    ref: 'Course'
  },
  enrollmentDate: {
    type: Date,
    default: Date.now
  },
  status: {
    type: String,
    enum: ['Active', 'Completed', 'Dropped'],
    default: 'Active'
  }
});

EnrollmentSchema.index(
  { student: 1, course: 1 },
  { unique: true }
);
module.exports = mongoose.model('Enrollment', EnrollmentSchema);
