const express = require('express');
const router = express.Router();
const {
  compareAlgorithms,
  runFIFO,
  runLRU,
  runLFU,
  generateWorkload,
  getMLStats,
  resetMLModels
} = require('../controllers/algorithmController');

// Existing routes
router.post('/compare', compareAlgorithms);
router.post('/fifo', runFIFO);
router.post('/lru', runLRU);
router.post('/lfu', runLFU);

// Helper routes
router.get('/ml/stats', getMLStats);
router.post('/ml/reset', resetMLModels);
router.post('/generate-workload', generateWorkload);

module.exports = router;
