const mongoose = require('mongoose');

const processSchema = new mongoose.Schema({
  processId: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  size: {
    type: Number,
    required: true
  },
  pages: [{
    pageNumber: Number,
    frameNumber: Number,
    inMemory: Boolean,
    lastAccessed: Date,
    accessCount: Number
  }],
  status: {
    type: String,
    enum: ['active', 'waiting', 'terminated'],
    default: 'active'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Process', processSchema);
