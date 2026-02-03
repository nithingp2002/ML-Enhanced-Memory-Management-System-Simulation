const express = require('express');
const router = express.Router();
const {
  initializeMemory,
  getMemoryState,
  accessPage,
  accessSequence,
  setAlgorithm,
  resetMemory,
  getStatistics,
  deallocateProcess
} = require('../controllers/memoryController');

router.post('/initialize', initializeMemory);
router.get('/state', getMemoryState);
router.post('/access', accessPage);
router.post('/access-sequence', accessSequence);
router.post('/algorithm', setAlgorithm);
router.post('/reset', resetMemory);
router.get('/stats', getStatistics);
router.delete('/deallocate/:processId', deallocateProcess);

module.exports = router;
