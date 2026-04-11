const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const BeaconSchema = new mongoose.Schema({
  bleID: {
    type: String,
    required: true,
    unique: true
  },
  classroom: {
    type: String,
    required: true,
    ref: 'Classroom'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});


module.exports = mongoose.model('Beacon', BeaconSchema);
