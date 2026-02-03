const Memory = require('../models/Memory');
const { FIFOAlgorithm, LRUAlgorithm, LFUAlgorithm } = require('../algorithms');

// In-memory state for simulation
let memoryState = {
  totalFrames: 16,
  frameSize: 4, // KB
  algorithm: 'FIFO',
  fifo: new FIFOAlgorithm(16),
  lru: new LRUAlgorithm(16),
  lfu: new LFUAlgorithm(16)
};

// Get current algorithm instance
const getCurrentAlgorithm = () => {
  switch (memoryState.algorithm) {
    case 'LRU': return memoryState.lru;
    case 'LFU': return memoryState.lfu;
    default: return memoryState.fifo;
  }
};

// @desc    Initialize memory
// @route   POST /api/memory/initialize
exports.initializeMemory = async (req, res) => {
  try {
    const { totalFrames = 16, frameSize = 4, algorithm = 'FIFO' } = req.body;

    memoryState = {
      totalFrames,
      frameSize,
      algorithm,
      fifo: new FIFOAlgorithm(totalFrames),
      lru: new LRUAlgorithm(totalFrames),
      lfu: new LFUAlgorithm(totalFrames)
    };

    // Save to database
    await Memory.findOneAndUpdate(
      {},
      {
        totalFrames,
        frameSize,
        frames: Array(totalFrames).fill(null).map((_, i) => ({
          frameNumber: i,
          processId: null,
          pageNumber: null,
          isOccupied: false
        })),
        pageFaults: 0,
        pageHits: 0,
        replacementAlgorithm: algorithm,
        accessHistory: []
      },
      { upsert: true, new: true }
    );

    res.json({
      success: true,
      message: 'Memory initialized successfully',
      config: {
        totalFrames,
        frameSize,
        totalMemory: `${totalFrames * frameSize} KB`,
        algorithm
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// @desc    Get memory state
// @route   GET /api/memory/state
exports.getMemoryState = async (req, res) => {
  try {
    const algo = getCurrentAlgorithm();
    const state = algo.getState();

    res.json({
      success: true,
      config: {
        totalFrames: memoryState.totalFrames,
        frameSize: memoryState.frameSize,
        algorithm: memoryState.algorithm
      },
      memory: state
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// @desc    Access a page
// @route   POST /api/memory/access
exports.accessPage = async (req, res) => {
  try {
    const { processId, pageNumber } = req.body;

    if (!processId || pageNumber === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Process ID and page number are required'
      });
    }

    const algo = getCurrentAlgorithm();
    const result = algo.accessPage(processId, pageNumber);
    const state = algo.getState();

    res.json({
      success: true,
      result,
      state
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// @desc    Access multiple pages (sequence)
// @route   POST /api/memory/access-sequence
exports.accessSequence = async (req, res) => {
  try {
    const { sequence } = req.body; // Array of { processId, pageNumber }

    if (!sequence || !Array.isArray(sequence)) {
      return res.status(400).json({
        success: false,
        error: 'Sequence array is required'
      });
    }

    const algo = getCurrentAlgorithm();
    const results = [];

    for (const { processId, pageNumber } of sequence) {
      const result = algo.accessPage(processId, pageNumber);
      results.push({
        processId,
        pageNumber,
        ...result
      });
    }

    const state = algo.getState();

    res.json({
      success: true,
      results,
      state
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// @desc    Set replacement algorithm
// @route   POST /api/memory/algorithm
exports.setAlgorithm = async (req, res) => {
  try {
    const { algorithm } = req.body;

    if (!['FIFO', 'LRU', 'LFU'].includes(algorithm)) {
      return res.status(400).json({
        success: false,
        error: 'Algorithm must be FIFO, LRU, or LFU'
      });
    }

    memoryState.algorithm = algorithm;

    res.json({
      success: true,
      message: `Algorithm changed to ${algorithm}`,
      algorithm
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// @desc    Reset memory
// @route   POST /api/memory/reset
exports.resetMemory = async (req, res) => {
  try {
    memoryState.fifo.reset();
    memoryState.lru.reset();
    memoryState.lfu.reset();

    res.json({
      success: true,
      message: 'Memory reset successfully'
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// @desc    Get memory statistics
// @route   GET /api/memory/stats
exports.getStatistics = async (req, res) => {
  try {
    const fifoState = memoryState.fifo.getState();
    const lruState = memoryState.lru.getState();
    const lfuState = memoryState.lfu.getState();

    res.json({
      success: true,
      currentAlgorithm: memoryState.algorithm,
      comparison: {
        FIFO: {
          pageFaults: fifoState.pageFaults,
          pageHits: fifoState.pageHits,
          hitRatio: fifoState.hitRatio
        },
        LRU: {
          pageFaults: lruState.pageFaults,
          pageHits: lruState.pageHits,
          hitRatio: lruState.hitRatio
        },
        LFU: {
          pageFaults: lfuState.pageFaults,
          pageHits: lfuState.pageHits,
          hitRatio: lfuState.hitRatio
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// @desc    Deallocate a process from memory
// @route   DELETE /api/memory/deallocate/:processId
exports.deallocateProcess = async (req, res) => {
  try {
    const { processId } = req.params;

    memoryState.fifo.removeProcess(processId);
    memoryState.lru.removeProcess(processId);
    memoryState.lfu.removeProcess(processId);

    res.json({
      success: true,
      message: `Process ${processId} deallocated from memory`
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
