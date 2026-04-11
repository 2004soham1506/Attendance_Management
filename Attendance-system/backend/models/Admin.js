const mongoose = require('mongoose');

const AdminSchema = new mongoose.Schema({
  _id: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  password: {
    type: String,
    required: true
  },
  email: {
    type: String,
    unique: true,
    sparse: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, { _id: false });

module.exports = mongoose.model('Admin', AdminSchema);
