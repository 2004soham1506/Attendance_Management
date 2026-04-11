const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const AttendanceSchema = new mongoose.Schema({
  sessionUID: {
  type: String,
  required: true
  },
  student: {
    type: String,
    required: true,
    ref: 'Student'
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  markedAt: Date,
  verifiedVia: {
    type: String,
    required: true,
    enum: ['BLE', 'QRCode', 'Manual'],
  }
});

AttendanceSchema.index(
  { sessionUID: 1, student: 1 },
  { unique: true }
);
module.exports = mongoose.model('Attendance', AttendanceSchema);
