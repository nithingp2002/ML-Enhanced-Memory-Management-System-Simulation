/**
 * LFU (Least Frequently Used) Page Replacement Algorithm
 * Uses a Min Heap for efficient minimum frequency lookup
 */

class MinHeap {
  constructor() {
    this.heap = [];
    this.indexMap = new Map(); // Track positions for updates
  }

  getParentIndex(i) { return Math.floor((i - 1) / 2); }
  getLeftChildIndex(i) { return 2 * i + 1; }
  getRightChildIndex(i) { return 2 * i + 2; }

  swap(i, j) {
    const temp = this.heap[i];
    this.heap[i] = this.heap[j];
    this.heap[j] = temp;
    
    this.indexMap.set(this.heap[i].pageKey, i);
    this.indexMap.set(this.heap[j].pageKey, j);
  }

  insert(item) {
    this.heap.push(item);
    const index = this.heap.length - 1;
    this.indexMap.set(item.pageKey, index);
    this.heapifyUp(index);
  }

  heapifyUp(index) {
    while (index > 0) {
      const parentIndex = this.getParentIndex(index);
      if (this.compare(this.heap[index], this.heap[parentIndex]) < 0) {
        this.swap(index, parentIndex);
        index = parentIndex;
      } else {
        break;
      }
    }
  }

  heapifyDown(index) {
    const length = this.heap.length;
    while (true) {
      let smallest = index;
      const left = this.getLeftChildIndex(index);
      const right = this.getRightChildIndex(index);

      if (left < length && this.compare(this.heap[left], this.heap[smallest]) < 0) {
        smallest = left;
      }
      if (right < length && this.compare(this.heap[right], this.heap[smallest]) < 0) {
        smallest = right;
      }

      if (smallest !== index) {
        this.swap(index, smallest);
        index = smallest;
      } else {
        break;
      }
    }
  }

  // Compare by frequency, then by timestamp (FIFO for ties)
  compare(a, b) {
    if (a.frequency !== b.frequency) {
      return a.frequency - b.frequency;
    }
    return a.timestamp - b.timestamp;
  }

  extractMin() {
    if (this.heap.length === 0) return null;
    if (this.heap.length === 1) {
      const min = this.heap.pop();
      this.indexMap.delete(min.pageKey);
      return min;
    }

    const min = this.heap[0];
    this.indexMap.delete(min.pageKey);
    
    this.heap[0] = this.heap.pop();
    if (this.heap.length > 0) {
      this.indexMap.set(this.heap[0].pageKey, 0);
      this.heapifyDown(0);
    }
    
    return min;
  }

  updateFrequency(pageKey) {
    const index = this.indexMap.get(pageKey);
    if (index === undefined) return false;

    this.heap[index].frequency++;
    this.heap[index].timestamp = Date.now();
    
    // Re-heapify (frequency increased, so move down)
    this.heapifyDown(index);
    return true;
  }

  contains(pageKey) {
    return this.indexMap.has(pageKey);
  }

  get(pageKey) {
    const index = this.indexMap.get(pageKey);
    return index !== undefined ? this.heap[index] : null;
  }

  remove(pageKey) {
    const index = this.indexMap.get(pageKey);
    if (index === undefined) return;

    // Move to end and pop
    this.swap(index, this.heap.length - 1);
    this.heap.pop();
    this.indexMap.delete(pageKey);

    if (index < this.heap.length) {
      this.heapifyUp(index);
      this.heapifyDown(index);
    }
  }

  size() {
    return this.heap.length;
  }
}

class LFUAlgorithm {
  constructor(frameCount) {
    this.frameCount = frameCount;
    this.frames = new Array(frameCount).fill(null);
    this.minHeap = new MinHeap();
    this.pageToFrame = new Map();
    
    this.pageFaults = 0;
    this.pageHits = 0;
    this.history = [];
  }

  /**
   * Access a page - either hit or fault
   */
  accessPage(processId, pageNumber) {
    const pageKey = `${processId}-${pageNumber}`;

    if (this.minHeap.contains(pageKey)) {
      // Page Hit - increase frequency
      this.minHeap.updateFrequency(pageKey);
      const item = this.minHeap.get(pageKey);
      this.pageHits++;

      this.history.push({
        processId,
        pageNumber,
        action: 'hit',
        frameIndex: item.frameIndex,
        frequency: item.frequency,
        timestamp: new Date()
      });

      return {
        hit: true,
        frameIndex: item.frameIndex,
        pageFault: false,
        replaced: null,
        frequency: item.frequency
      };
    }

    // Page Fault
    this.pageFaults++;
    let replacedPage = null;
    let targetFrame;

    // Find free frame
    const freeFrame = this.frames.findIndex(f => f === null);

    if (freeFrame !== -1) {
      // Free frame available
      targetFrame = freeFrame;
    } else {
      // No free frame - LFU replacement
      const lfuItem = this.minHeap.extractMin();
      replacedPage = lfuItem.pageKey;
      targetFrame = lfuItem.frameIndex;
      this.pageToFrame.delete(lfuItem.pageKey);
    }

    // Add new page
    this.frames[targetFrame] = pageKey;
    const newItem = {
      pageKey,
      frameIndex: targetFrame,
      frequency: 1,
      timestamp: Date.now()
    };
    this.minHeap.insert(newItem);
    this.pageToFrame.set(pageKey, targetFrame);

    this.history.push({
      processId,
      pageNumber,
      action: 'fault',
      frameIndex: targetFrame,
      replaced: replacedPage,
      frequency: 1,
      timestamp: new Date()
    });

    return {
      hit: false,
      frameIndex: targetFrame,
      pageFault: true,
      replaced: replacedPage,
      frequency: 1
    };
  }

  /**
   * Get current state
   */
  getState() {
    const frequencyMap = {};
    for (const item of this.minHeap.heap) {
      frequencyMap[item.pageKey] = item.frequency;
    }

    return {
      frames: [...this.frames],
      frequencies: frequencyMap,
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
    this.frames = new Array(this.frameCount).fill(null);
    this.minHeap = new MinHeap();
    this.pageToFrame = new Map();
    this.pageFaults = 0;
    this.pageHits = 0;
    this.history = [];
  }

  /**
   * Remove a process from memory
   */
  removeProcess(processId) {
    const keysToRemove = [];
    for (const item of this.minHeap.heap) {
      if (item.pageKey.startsWith(processId)) {
        keysToRemove.push(item.pageKey);
        this.frames[item.frameIndex] = null;
      }
    }
    keysToRemove.forEach(key => {
      this.minHeap.remove(key);
      this.pageToFrame.delete(key);
    });
  }
}

module.exports = LFUAlgorithm;
