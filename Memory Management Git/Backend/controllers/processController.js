const Process = require('../models/Process');
const { v4: uuidv4 } = require('uuid');

// In-memory process store
let processes = new Map();

// @desc    Create a new process
// @route   POST /api/process
exports.createProcess = async (req, res) => {
  try {
    const { name, size, pageSize = 4 } = req.body;

    if (!name || !size) {
      return res.status(400).json({
        success: false,
        error: 'Process name and size are required'
      });
    }

    const processId = `P${Date.now().toString(36).toUpperCase()}`;
    const numPages = Math.ceil(size / pageSize);
    
    // Create pages for the process
    const pages = [];
    for (let i = 0; i < numPages; i++) {
      pages.push({
        pageNumber: i,
        frameNumber: null,
        inMemory: false,
        lastAccessed: null,
        accessCount: 0
      });
    }

    const process = {
      processId,
      name,
      size,
      pageSize,
      numPages,
      pages,
      status: 'active',
      createdAt: new Date()
    };

    processes.set(processId, process);

    // Save to database
    await Process.create({
      processId,
      name,
      size,
      pages,
      status: 'active'
    });

    res.status(201).json({
      success: true,
      message: 'Process created successfully',
      process
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// @desc    Get all processes
// @route   GET /api/process
exports.getAllProcesses = async (req, res) => {
  try {
    const processList = Array.from(processes.values());
    
    res.json({
      success: true,
      count: processList.length,
      processes: processList
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// @desc    Get single process
// @route   GET /api/process/:processId
exports.getProcess = async (req, res) => {
  try {
    const { processId } = req.params;
    const process = processes.get(processId);

    if (!process) {
      return res.status(404).json({
        success: false,
        error: 'Process not found'
      });
    }

    res.json({
      success: true,
      process
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// @desc    Delete/terminate a process
// @route   DELETE /api/process/:processId
exports.deleteProcess = async (req, res) => {
  try {
    const { processId } = req.params;

    if (!processes.has(processId)) {
      return res.status(404).json({
        success: false,
        error: 'Process not found'
      });
    }

    processes.delete(processId);
    await Process.findOneAndDelete({ processId });

    res.json({
      success: true,
      message: `Process ${processId} terminated`
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// @desc    Update process status
// @route   PATCH /api/process/:processId/status
exports.updateProcessStatus = async (req, res) => {
  try {
    const { processId } = req.params;
    const { status } = req.body;

    const process = processes.get(processId);
    if (!process) {
      return res.status(404).json({
        success: false,
        error: 'Process not found'
      });
    }

    if (!['active', 'waiting', 'terminated'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status'
      });
    }

    process.status = status;
    processes.set(processId, process);

    res.json({
      success: true,
      process
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// @desc    Get process page table
// @route   GET /api/process/:processId/page-table
exports.getPageTable = async (req, res) => {
  try {
    const { processId } = req.params;
    const process = processes.get(processId);

    if (!process) {
      return res.status(404).json({
        success: false,
        error: 'Process not found'
      });
    }

    const pageTable = process.pages.map(page => ({
      pageNumber: page.pageNumber,
      frameNumber: page.frameNumber,
      valid: page.inMemory,
      lastAccessed: page.lastAccessed,
      accessCount: page.accessCount
    }));

    res.json({
      success: true,
      processId,
      pageTable
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

// @desc    Clear all processes
// @route   DELETE /api/process/all
exports.clearAllProcesses = async (req, res) => {
  try {
    processes.clear();
    await Process.deleteMany({});

    res.json({
      success: true,
      message: 'All processes cleared'
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
