const { FIFOAlgorithm, LRUAlgorithm, LFUAlgorithm } = require('../algorithms');
const Workload = require('../models/Workload');
const MLState = require('../models/MLState');

/**
 * Load persisted ML state from database
 */
async function loadMLState(modelType) {
  try {
    return await MLState.findOne({ modelType });
  } catch (error) {
    console.error(`Error loading ${modelType} state:`, error);
    return null;
  }
}

/**
 * Save ML state to database (increments training counts)
 */
async function saveMLState(modelType, state, newSequences = 0, newAccesses = 0) {
  try {
    // First get existing state to increment counts
    const existing = await MLState.findOne({ modelType });
    const trainedSequences = (existing?.trainedSequences || 0) + newSequences;
    const totalTrainedAccesses = (existing?.totalTrainedAccesses || 0) + newAccesses;

    await MLState.findOneAndUpdate(
      { modelType },
      {
        ...state,
        modelType,
        trainedSequences,
        totalTrainedAccesses,
        lastTrainedAt: Date.now()
      },
      { upsert: true, new: true }
    );
  } catch (error) {
    console.error(`Error saving ${modelType} state:`, error);
  }
}

// @desc    Compare all algorithms with same sequence
// @route   POST /api/algorithms/compare
exports.compareAlgorithms = async (req, res) => {
  try {
    const { sequence, frameCount = 4 } = req.body;

    if (!sequence || !Array.isArray(sequence) || sequence.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Reference sequence array is required'
      });
    }

    // Initialize fresh algorithms
    const fifo = new FIFOAlgorithm(frameCount);
    const lru = new LRUAlgorithm(frameCount);
    const lfu = new LFUAlgorithm(frameCount);

    const fifoResults = [];
    const lruResults = [];
    const lfuResults = [];

    // Run sequence through all algorithms
    for (const { processId, pageNumber } of sequence) {
      fifoResults.push({
        page: `${processId}-${pageNumber}`,
        ...fifo.accessPage(processId, pageNumber),
        frames: [...fifo.frames]
      });

      lruResults.push({
        page: `${processId}-${pageNumber}`,
        ...lru.accessPage(processId, pageNumber),
        frames: [...lru.frames]
      });

      lfuResults.push({
        page: `${processId}-${pageNumber}`,
        ...lfu.accessPage(processId, pageNumber),
        frames: [...lfu.frames]
      });
    }

    const fifoState = fifo.getState();
    const lruState = lru.getState();
    const lfuState = lfu.getState();

    res.json({
      success: true,
      frameCount,
      sequenceLength: sequence.length,
      comparison: {
        FIFO: {
          pageFaults: fifoState.pageFaults,
          pageHits: fifoState.pageHits,
          hitRatio: (fifoState.hitRatio * 100).toFixed(2) + '%',
          steps: fifoResults
        },
        LRU: {
          pageFaults: lruState.pageFaults,
          pageHits: lruState.pageHits,
          hitRatio: (lruState.hitRatio * 100).toFixed(2) + '%',
          steps: lruResults
        },
        LFU: {
          pageFaults: lfuState.pageFaults,
          pageHits: lfuState.pageHits,
          hitRatio: (lfuState.hitRatio * 100).toFixed(2) + '%',
          steps: lfuResults
        }
      },
      winner: determineWinner(fifoState, lruState, lfuState)
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// @desc    Run FIFO algorithm
// @route   POST /api/algorithms/fifo
exports.runFIFO = async (req, res) => {
  try {
    const { sequence, frameCount = 4 } = req.body;

    if (!sequence || !Array.isArray(sequence)) {
      return res.status(400).json({
        success: false,
        error: 'Sequence array is required'
      });
    }

    const fifo = new FIFOAlgorithm(frameCount);
    const steps = [];

    for (const { processId, pageNumber } of sequence) {
      const result = fifo.accessPage(processId, pageNumber);
      steps.push({
        page: `${processId}-${pageNumber}`,
        ...result,
        frames: [...fifo.frames],
        queue: [...fifo.queue]
      });
    }

    const state = fifo.getState();

    res.json({
      success: true,
      algorithm: 'FIFO',
      frameCount,
      steps,
      summary: {
        pageFaults: state.pageFaults,
        pageHits: state.pageHits,
        hitRatio: (state.hitRatio * 100).toFixed(2) + '%'
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// @desc    Run LRU algorithm
// @route   POST /api/algorithms/lru
exports.runLRU = async (req, res) => {
  try {
    const { sequence, frameCount = 4 } = req.body;

    if (!sequence || !Array.isArray(sequence)) {
      return res.status(400).json({
        success: false,
        error: 'Sequence array is required'
      });
    }

    const lru = new LRUAlgorithm(frameCount);
    const steps = [];

    for (const { processId, pageNumber } of sequence) {
      const result = lru.accessPage(processId, pageNumber);
      const state = lru.getState();
      steps.push({
        page: `${processId}-${pageNumber}`,
        ...result,
        frames: [...lru.frames],
        lruOrder: state.lruOrder
      });
    }

    const state = lru.getState();

    res.json({
      success: true,
      algorithm: 'LRU',
      frameCount,
      steps,
      summary: {
        pageFaults: state.pageFaults,
        pageHits: state.pageHits,
        hitRatio: (state.hitRatio * 100).toFixed(2) + '%'
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// @desc    Run LFU algorithm
// @route   POST /api/algorithms/lfu
exports.runLFU = async (req, res) => {
  try {
    const { sequence, frameCount = 4 } = req.body;

    if (!sequence || !Array.isArray(sequence)) {
      return res.status(400).json({
        success: false,
        error: 'Sequence array is required'
      });
    }

    const lfu = new LFUAlgorithm(frameCount);
    const steps = [];

    for (const { processId, pageNumber } of sequence) {
      const result = lfu.accessPage(processId, pageNumber);
      const state = lfu.getState();
      steps.push({
        page: `${processId}-${pageNumber}`,
        ...result,
        frames: [...lfu.frames],
        frequencies: { ...state.frequencies }
      });
    }

    const state = lfu.getState();

    res.json({
      success: true,
      algorithm: 'LFU',
      frameCount,
      steps,
      summary: {
        pageFaults: state.pageFaults,
        pageHits: state.pageHits,
        hitRatio: (state.hitRatio * 100).toFixed(2) + '%'
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// Helper function to determine best algorithm
function determineWinner(fifo, lru, lfu) {
  const algorithms = [
    { name: 'FIFO', faults: fifo.pageFaults, hitRatio: fifo.hitRatio },
    { name: 'LRU', faults: lru.pageFaults, hitRatio: lru.hitRatio },
    { name: 'LFU', faults: lfu.pageFaults, hitRatio: lfu.hitRatio }
  ];

  algorithms.sort((a, b) => a.faults - b.faults);

  return {
    best: algorithms[0].name,
    reason: `Lowest page faults (${algorithms[0].faults}) with ${(algorithms[0].hitRatio * 100).toFixed(2)}% hit ratio`
  };
}







// @desc    Generate workload patterns for testing
// @route   POST /api/algorithms/generate-workload
exports.generateWorkload = async (req, res) => {
  try {
    const {
      type = 'random',
      length = 50,
      uniquePages = 8,
      processId = 'P1',
      localityFactor = 0.7
    } = req.body;

    let sequence = [];

    switch (type) {
      case 'random':
        for (let i = 0; i < length; i++) {
          sequence.push({
            processId,
            pageNumber: Math.floor(Math.random() * uniquePages)
          });
        }
        break;

      case 'sequential':
        for (let i = 0; i < length; i++) {
          sequence.push({
            processId,
            pageNumber: i % uniquePages
          });
        }
        break;

      case 'locality':
        // Improved locality - uses working set concept with temporal locality
        const localWorkingSet = Math.max(3, Math.floor(uniquePages * 0.5)); // 50% of pages as working set
        let currentWorkingSet = Array.from({ length: localWorkingSet }, () =>
          Math.floor(Math.random() * uniquePages)
        );

        for (let i = 0; i < length; i++) {
          if (Math.random() < localityFactor) {
            // Pick from current working set
            const page = currentWorkingSet[Math.floor(Math.random() * currentWorkingSet.length)];
            sequence.push({ processId, pageNumber: page });
          } else {
            // Random page (may shift working set)
            const newPage = Math.floor(Math.random() * uniquePages);
            sequence.push({ processId, pageNumber: newPage });
            // Occasionally update working set
            if (Math.random() < 0.3) {
              currentWorkingSet[Math.floor(Math.random() * currentWorkingSet.length)] = newPage;
            }
          }
        }
        break;

      case 'loop':
        const loopSize = Math.min(4, uniquePages);
        for (let i = 0; i < length; i++) {
          sequence.push({
            processId,
            pageNumber: i % loopSize
          });
        }
        break;

      case 'working-set':
        const workingSetSize = Math.ceil(uniquePages * 0.4);
        const workingSet = Array.from({ length: workingSetSize }, (_, i) => i);

        for (let i = 0; i < length; i++) {
          if (Math.random() < 0.8) {
            sequence.push({
              processId,
              pageNumber: workingSet[Math.floor(Math.random() * workingSetSize)]
            });
          } else {
            sequence.push({
              processId,
              pageNumber: workingSetSize + Math.floor(Math.random() * (uniquePages - workingSetSize))
            });
          }
        }
        break;

      default:
        return res.status(400).json({
          success: false,
          error: 'Invalid workload type. Use: random, sequential, locality, loop, working-set'
        });
    }

    // Only save workload if explicitly requested (to prevent DB bloat)
    const { saveWorkload = false } = req.body;
    if (saveWorkload) {
      // Limit to 100 workloads in DB - delete oldest if over limit
      const workloadCount = await Workload.countDocuments();
      if (workloadCount >= 100) {
        await Workload.findOneAndDelete({}, { sort: { createdAt: 1 } });
      }

      const workloadDoc = new Workload({
        type,
        sequence,
        length: sequence.length,
        uniquePages,
        localityFactor: type === 'locality' ? localityFactor : null
      });
      workloadDoc.save().catch(err => console.error('Error saving workload:', err));
    }

    return res.json({
      success: true,
      workload: {
        type,
        length: sequence.length,
        uniquePages,
        localityFactor: type === 'locality' ? localityFactor : null
      },
      sequence
    });
  } catch (error) {
    console.error('generateWorkload error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
};

// @desc    Get ML training statistics
// @route   GET /api/algorithms/ml/stats
exports.getMLStats = async (req, res) => {
  try {
    const mlStates = await MLState.find({});
    const workloadCount = await Workload.countDocuments();
    const totalAccesses = await Workload.aggregate([
      { $group: { _id: null, total: { $sum: '$length' } } }
    ]);

    const modelsStats = {};
    mlStates.forEach(state => {
      modelsStats[state.modelType] = {
        trainedSequences: state.trainedSequences || 0,
        totalTrainedAccesses: state.totalTrainedAccesses || 0,
        lastTrainedAt: state.lastTrainedAt,
        accuracy: state.accuracy || 0,
        trained: (state.trainedSequences > 0)
      };
    });

    res.json({
      success: true,
      stats: {
        totalWorkloads: workloadCount,
        totalAccessesStored: totalAccesses[0]?.total || 0,
        models: modelsStats
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};



// @desc    Reset ML models (clear learned data)
// @route   POST /api/algorithms/ml/reset
exports.resetMLModels = async (req, res) => {
  try {
    await Promise.all([
      MLState.deleteMany({}),
      Workload.deleteMany({})
    ]);

    res.json({
      success: true,
      message: 'ML models and workload history have been reset.'
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};


