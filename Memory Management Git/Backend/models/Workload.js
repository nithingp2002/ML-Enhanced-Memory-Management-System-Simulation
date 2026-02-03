const mongoose = require('mongoose');

const WorkloadSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['random', 'sequential', 'locality', 'loop', 'working-set', 'custom'],
    required: true
  },
  sequence: [{
    processId: String,
    pageNumber: Number
  }],
  length: {
    type: Number,
    required: true
  },
  uniquePages: {
    type: Number,
    default: 8
  },
  localityFactor: {
    type: Number,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Workload', WorkloadSchema);
