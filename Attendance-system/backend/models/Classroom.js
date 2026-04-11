const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const ClassroomSchema = new mongoose.Schema({
  _id: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  capacity: Number,
  createdAt: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

module.exports = mongoose.model('Classroom', ClassroomSchema);
