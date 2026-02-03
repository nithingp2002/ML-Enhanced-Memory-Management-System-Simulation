/**
 * FIFO (First-In-First-Out) Page Replacement Algorithm
 * Uses a Queue data structure
 */

class FIFOAlgorithm {
  constructor(frameCount) {
    this.frameCount = frameCount;
    this.queue = []; // Queue to track order of page arrivals
    this.frames = new Array(frameCount).fill(null);
    this.pageFaults = 0;
    this.pageHits = 0;
    this.history = [];
  }

  /**
   * Access a page - either hit or fault
   * @param {string} processId - Process identifier
   * @param {number} pageNumber - Page number to access
   * @returns {Object} - Result of the access operation
   */
  accessPage(processId, pageNumber) {
    const pageKey = `${processId}-${pageNumber}`;
    const frameIndex = this.findPage(pageKey);

    if (frameIndex !== -1) {
      // Page Hit
      this.pageHits++;
      this.history.push({
        processId,
        pageNumber,
        action: 'hit',
        frameIndex,
        timestamp: new Date()
      });
      return {
        hit: true,
        frameIndex,
        pageFault: false,
        replaced: null
      };
    }

    // Page Fault
    this.pageFaults++;
    let replacedPage = null;
    let targetFrame;

    // Find free frame or replace using FIFO
    const freeFrame = this.frames.findIndex(f => f === null);
    
    if (freeFrame !== -1) {
      // Free frame available
      targetFrame = freeFrame;
      this.frames[targetFrame] = pageKey;
      this.queue.push(targetFrame);
    } else {
      // No free frame - FIFO replacement
      targetFrame = this.queue.shift(); // Remove oldest
      replacedPage = this.frames[targetFrame];
      this.frames[targetFrame] = pageKey;
      this.queue.push(targetFrame);
    }

    this.history.push({
      processId,
      pageNumber,
      action: 'fault',
      frameIndex: targetFrame,
      replaced: replacedPage,
      timestamp: new Date()
    });

    return {
      hit: false,
      frameIndex: targetFrame,
      pageFault: true,
      replaced: replacedPage
    };
  }

  /**
   * Find a page in frames
   * @param {string} pageKey - Page identifier
   * @returns {number} - Frame index or -1 if not found
   */
  findPage(pageKey) {
    return this.frames.findIndex(f => f === pageKey);
  }

  /**
   * Get current state of memory
   */
  getState() {
    return {
      frames: [...this.frames],
      queue: [...this.queue],
      pageFaults: this.pageFaults,
      pageHits: this.pageHits,
      hitRatio: this.pageHits / (this.pageHits + this.pageFaults) || 0,
      history: this.history
    };
  }

  /**
   * Reset the algorithm state
   */
  reset() {
    this.queue = [];
    this.frames = new Array(this.frameCount).fill(null);
    this.pageFaults = 0;
    this.pageHits = 0;
    this.history = [];
  }

  /**
   * Remove a process from memory
   */
  removeProcess(processId) {
    this.frames = this.frames.map(f => {
      if (f && f.startsWith(processId)) {
        return null;
      }
      return f;
    });
    this.queue = this.queue.filter(frameIndex => 
      this.frames[frameIndex] !== null
    );
  }
}

module.exports = FIFOAlgorithm;
