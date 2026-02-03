const mongoose = require('mongoose');

const segmentSchema = new mongoose.Schema({
  processId: {
    type: String,
    required: true
  },
  segments: [{
    segmentId: Number,
    segmentName: String,
    base: Number,
    limit: Number,
    type: {
      type: String,
      enum: ['code', 'data', 'stack', 'heap']
    }
  }],
  segmentTable: {
    type: Map,
    of: Object
  }
});

module.exports = mongoose.model('Segment', segmentSchema);
