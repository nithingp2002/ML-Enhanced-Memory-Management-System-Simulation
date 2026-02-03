/**
 * Python ML Service Routes
 * Routes that proxy to the Python ML microservice
 */
const express = require('express');
const router = express.Router();
const { pythonMLClient } = require('../services/pythonMLClient');

// @desc    Health check for Python ML service
// @route   GET /api/python-ml/health
router.get('/health', async (req, res) => {
  try {
    const result = await pythonMLClient.healthCheck();
    res.json({
      success: result.available,
      service: 'Python ML Microservice',
      ...result
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// @desc    Get prediction from specific model
// @route   POST /api/python-ml/predict
router.post('/predict', async (req, res) => {
  try {
    const { model = 'markov' } = req.body;
    const result = await pythonMLClient.predict(model);

    if (result.success) {
      res.json({ success: true, ...result.data });
    } else {
      res.status(500).json({ success: false, error: result.error });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// @desc    Access page with specific ML model
// @route   POST /api/python-ml/access
router.post('/access', async (req, res) => {
  try {
    const { model = 'markov', processId, pageNumber } = req.body;

    if (processId === undefined || pageNumber === undefined) {
      return res.status(400).json({
        success: false,
        error: 'processId and pageNumber are required'
      });
    }

    const result = await pythonMLClient.accessPage(model, processId, pageNumber);

    if (result.success) {
      res.json({ success: true, ...result.data });
    } else {
      res.status(500).json({ success: false, error: result.error });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// @desc    Access page with ALL ML models
// @route   POST /api/python-ml/access-all
router.post('/access-all', async (req, res) => {
  try {
    const { processId, pageNumber } = req.body;

    if (processId === undefined || pageNumber === undefined) {
      return res.status(400).json({
        success: false,
        error: 'processId and pageNumber are required'
      });
    }

    const result = await pythonMLClient.accessPageAll(processId, pageNumber);

    if (result.success) {
      res.json({ success: true, ...result.data });
    } else {
      res.status(500).json({ success: false, error: result.error });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// @desc    Get stats for all models
// @route   GET /api/python-ml/stats
router.get('/stats', async (req, res) => {
  try {
    const result = await pythonMLClient.getStats();

    if (result.success) {
      res.json({ success: true, stats: result.data });
    } else {
      res.status(500).json({ success: false, error: result.error });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// @desc    Train all models with sequences
// @route   POST /api/python-ml/train-all
router.post('/train-all', async (req, res) => {
  try {
    const { sequences } = req.body;

    if (!sequences || !Array.isArray(sequences) || sequences.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'sequences array is required'
      });
    }

    const result = await pythonMLClient.trainAll(sequences);

    if (result.success) {
      res.json({ success: true, ...result.data });
    } else {
      res.status(500).json({ success: false, error: result.error });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// @desc    Get stats for specific model
// @route   GET /api/python-ml/stats/:model
router.get('/stats/:model', async (req, res) => {
  try {
    const { model } = req.params;
    const result = await pythonMLClient.getModelStats(model);

    if (result.success) {
      res.json({ success: true, ...result.data });
    } else {
      res.status(500).json({ success: false, error: result.error });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// @desc    Reset all models
// @route   POST /api/python-ml/reset
router.post('/reset', async (req, res) => {
  try {
    const { frameCount = 4 } = req.body;
    const result = await pythonMLClient.resetAll(frameCount);

    if (result.success) {
      res.json({ success: true, ...result.data });
    } else {
      res.status(500).json({ success: false, error: result.error });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// @desc    Reset specific model
// @route   POST /api/python-ml/reset/:model
router.post('/reset/:model', async (req, res) => {
  try {
    const { model } = req.params;
    const { frameCount = 4 } = req.body;
    const result = await pythonMLClient.resetModel(model, frameCount);

    if (result.success) {
      res.json({ success: true, ...result.data });
    } else {
      res.status(500).json({ success: false, error: result.error });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// @desc    Configure models
// @route   POST /api/python-ml/configure
router.post('/configure', async (req, res) => {
  try {
    const { frameCount = 4 } = req.body;
    const result = await pythonMLClient.configure(frameCount);

    if (result.success) {
      res.json({ success: true, ...result.data });
    } else {
      res.status(500).json({ success: false, error: result.error });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// @desc    Compare all ML models with sequence
// @route   POST /api/python-ml/compare
router.post('/compare', async (req, res) => {
  try {
    const { sequence, frameCount = 4 } = req.body;

    if (!sequence || !Array.isArray(sequence) || sequence.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'sequence array is required'
      });
    }

    const result = await pythonMLClient.compareModels(sequence, frameCount);

    if (result.success) {
      res.json({ success: true, ...result.data });
    } else {
      res.status(500).json({ success: false, error: result.error });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// @desc    Get formal ML evaluation metrics
// @route   POST /api/python-ml/evaluation
router.post('/evaluation', async (req, res) => {
  try {
    const { sequence, frameCount = 4 } = req.body;

    if (!sequence || !Array.isArray(sequence) || sequence.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'sequence array is required'
      });
    }

    const result = await pythonMLClient.getMLEvaluation(sequence, frameCount);

    if (result.success) {
      res.json({ success: true, ...result.data });
    } else {
      res.status(500).json({ success: false, error: result.error });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// @desc    Run sequence through Python ML models
// @route   POST /api/python-ml/run
router.post('/run', async (req, res) => {
  try {
    const { sequence, frameCount = 4 } = req.body;

    if (!sequence || !Array.isArray(sequence) || sequence.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'sequence array is required'
      });
    }

    // Reset models first
    await pythonMLClient.resetAll(frameCount);

    // Run sequence through all models
    const results = {};

    for (const access of sequence) {
      const processId = access.processId || 'P1';
      const pageNumber = access.pageNumber !== undefined ? access.pageNumber : access;

      const allResult = await pythonMLClient.accessPageAll(processId, pageNumber);

      if (allResult.success) {
        // Dynamically handle whatever models satisfy the request
        for (const model of Object.keys(allResult.data)) {
          if (!results[model]) {
            results[model] = [];
          }
          results[model].push(allResult.data[model].result);
        }
      }
    }

    // Get final stats
    const statsResult = await pythonMLClient.getStats();

    res.json({
      success: true,
      sequenceLength: sequence.length,
      frameCount,
      results,
      finalStats: statsResult.success ? statsResult.data : {}
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
