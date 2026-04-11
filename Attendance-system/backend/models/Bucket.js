const mongoose = require('mongoose');

// This is the cache for the attendance records for each student across all their courses and lectures.

const BucketSchema = new mongoose.Schema({
  studentUID: {
    type: String,
    required: true,
    unique: true
  },
  courses: [{
    courseUID: String,
    lectures: [{
      lectureUID: String,
      attendance: {
        type: Map,
        of: String,
        default: {}
      }
    }]
  }],
  lastUpdated: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Bucket', BucketSchema);
