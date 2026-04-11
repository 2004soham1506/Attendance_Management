const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const Session = require('./Session');

const CourseSchema = new mongoose.Schema({
  _id: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  name: {
    type: String,
    required: true
    // trim: true
  },
  department: {
    type: String,
    required: true
  },
  slot: {
    type: String,
    required: true,
    enum: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'P', 'Q', 'R', 'S', 'W', 'X', 'Y', 'Z']
  },
  venue: {
    type: String,
    required: true,
    ref: 'Classroom'
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  instructors: [{ type: String, ref: 'Professor' }],
  tas: [{ type: String, ref: 'Student' }],
  lectures: [{
    lectureUID: {
      type: String,
      required: true,
    },
    scheduledTime: {
      type: Date,
      required: true
    },
    cancelled: {
      type: Boolean,
      default: false
    }
  }],
  schedules: [{
    scheduledDay: {
      type: String,
      enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
      required: true
    },
    startTime: {
      type: String,
      required: true
    },
    endTime: {
      type: String,
      required: true
    },
    method : {
      type: String,
      enum: ['BLE', 'QRCode', 'Manual'],
      default: 'BLE'
    }, 
    switch: {
      type: Boolean,
      default: false
    }
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

CourseSchema.index(
  { _id: 1, "lectures.lectureUID": 1 },
  { unique: true }
);
module.exports = mongoose.model('Course', CourseSchema);
