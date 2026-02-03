const mongoose = require('mongoose');

const memorySchema = new mongoose.Schema({
  totalFrames: {
    type: Number,
    default: 16
  },
  frameSize: {
    type: Number,
    default: 4 // 4KB per frame
  },
  frames: [{
    frameNumber: Number,
    processId: String,
    pageNumber: Number,
    isOccupied: Boolean,
    loadedAt: Date,
    lastAccessed: Date,
    accessCount: Number
  }],
  pageTable: {
    type: Map,
    of: Object
  },
  pageFaults: {
    type: Number,
    default: 0
  },
  pageHits: {
    type: Number,
    default: 0
  },
  replacementAlgorithm: {
    type: String,
    enum: ['FIFO', 'LRU', 'LFU'],
    default: 'FIFO'
  },
  accessHistory: [{
    processId: String,
    pageNumber: Number,
    timestamp: Date,
    wasFault: Boolean,
    replacedFrame: Number
  }]
});

module.exports = mongoose.model('Memory', memorySchema);
