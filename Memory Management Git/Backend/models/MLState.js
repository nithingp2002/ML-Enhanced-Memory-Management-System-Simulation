const mongoose = require('mongoose');

const MLStateSchema = new mongoose.Schema({
  modelType: {
    type: String,
    enum: ['random_forest', 'xgboost', 'lstm'],
    required: true,
    unique: true
  },

  // Generic state container for Python ML models (serialized JSON)
  modelState: {
    type: Object,
    default: {}
  },

  // Training statistics
  trainedSequences: {
    type: Number,
    default: 0
  },
  totalTrainedAccesses: {
    type: Number,
    default: 0
  },
  accuracy: {
    type: Number,
    default: 0
  },
  lastTrainedAt: {
    type: Date,
    default: Date.now
  },

  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update timestamp on save
MLStateSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('MLState', MLStateSchema);
