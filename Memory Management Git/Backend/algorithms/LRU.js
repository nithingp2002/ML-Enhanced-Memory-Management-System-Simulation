/**
 * LRU (Least Recently Used) Page Replacement Algorithm
 * Uses a Doubly Linked List + Hash Map for O(1) operations
 */

class LRUNode {
  constructor(pageKey, frameIndex) {
    this.pageKey = pageKey;
    this.frameIndex = frameIndex;
    this.prev = null;
    this.next = null;
  }
}

class LRUAlgorithm {
  constructor(frameCount) {
    this.frameCount = frameCount;
    this.frames = new Array(frameCount).fill(null);
    this.pageMap = new Map(); // Hash Map for O(1) lookup
    
    // Doubly Linked List with dummy head and tail
    this.head = new LRUNode(null, -1); // Most recently used
    this.tail = new LRUNode(null, -1); // Least recently used
    this.head.next = this.tail;
    this.tail.prev = this.head;
    
    this.pageFaults = 0;
    this.pageHits = 0;
    this.history = [];
  }

  /**
   * Add node right after head (most recently used position)
   */
  addToHead(node) {
    node.prev = this.head;
    node.next = this.head.next;
    this.head.next.prev = node;
    this.head.next = node;
  }

  /**
   * Remove a node from the linked list
   */
  removeNode(node) {
    node.prev.next = node.next;
    node.next.prev = node.prev;
  }

  /**
   * Move existing node to head (mark as most recently used)
   */
  moveToHead(node) {
    this.removeNode(node);
    this.addToHead(node);
  }

  /**
   * Remove and return the tail node (least recently used)
   */
  removeTail() {
    const node = this.tail.prev;
    this.removeNode(node);
    return node;
  }

  /**
   * Access a page - either hit or fault
   */
  accessPage(processId, pageNumber) {
    const pageKey = `${processId}-${pageNumber}`;

    if (this.pageMap.has(pageKey)) {
      // Page Hit - move to head (most recently used)
      const node = this.pageMap.get(pageKey);
      this.moveToHead(node);
      this.pageHits++;

      this.history.push({
        processId,
        pageNumber,
        action: 'hit',
        frameIndex: node.frameIndex,
        timestamp: new Date()
      });

      return {
        hit: true,
        frameIndex: node.frameIndex,
        pageFault: false,
        replaced: null
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
      // No free frame - LRU replacement
      const lruNode = this.removeTail();
      replacedPage = lruNode.pageKey;
      targetFrame = lruNode.frameIndex;
      this.pageMap.delete(lruNode.pageKey);
    }

    // Add new page
    this.frames[targetFrame] = pageKey;
    const newNode = new LRUNode(pageKey, targetFrame);
    this.addToHead(newNode);
    this.pageMap.set(pageKey, newNode);

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
   * Get current state
   */
  getState() {
    // Get order from most to least recently used
    const lruOrder = [];
    let current = this.head.next;
    while (current !== this.tail) {
      lruOrder.push(current.pageKey);
      current = current.next;
    }

    return {
      frames: [...this.frames],
      lruOrder,
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
    this.pageMap.clear();
    this.head.next = this.tail;
    this.tail.prev = this.head;
    this.pageFaults = 0;
    this.pageHits = 0;
    this.history = [];
  }

  /**
   * Remove a process from memory
   */
  removeProcess(processId) {
    const keysToRemove = [];
    for (const [key, node] of this.pageMap) {
      if (key.startsWith(processId)) {
        keysToRemove.push(key);
        this.removeNode(node);
        this.frames[node.frameIndex] = null;
      }
    }
    keysToRemove.forEach(key => this.pageMap.delete(key));
  }
}

module.exports = LRUAlgorithm;
