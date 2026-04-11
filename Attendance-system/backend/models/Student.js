const mongoose = require('mongoose');

const StudentSchema = new mongoose.Schema({
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
  imageURL: {
    type: String,
    required: true
    // default: null
  },
  email: {
    type: String,
    unique: true,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

module.exports = mongoose.model('Student', StudentSchema);
