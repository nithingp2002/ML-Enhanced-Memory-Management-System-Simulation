const express = require('express');
const router = express.Router();
const {
  createProcess,
  getAllProcesses,
  getProcess,
  deleteProcess,
  updateProcessStatus,
  getPageTable,
  clearAllProcesses
} = require('../controllers/processController');

router.post('/', createProcess);
router.get('/', getAllProcesses);
router.delete('/all', clearAllProcesses);
router.get('/:processId', getProcess);
router.delete('/:processId', deleteProcess);
router.patch('/:processId/status', updateProcessStatus);
router.get('/:processId/page-table', getPageTable);

module.exports = router;
