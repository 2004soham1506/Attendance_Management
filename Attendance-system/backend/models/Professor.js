const mongoose = require('mongoose');

const ProfessorSchema = new mongoose.Schema({
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
  password: {
    type: String,
    required: true
  },
  email: {
    type: String,
    unique: true,
    required: true
  },
  department: {
    type: String,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

module.exports = mongoose.model('Professor', ProfessorSchema);
