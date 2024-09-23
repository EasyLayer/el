export type LightBlock = {
  height: number;
  hash: string;
  previousblockhash: string;
  tx: string[];
};

export class Chain {
  block!: LightBlock;
  next: Chain | null = null;
  prev: Chain | null = null;
}

/**
 * Restores the chain links (next and prev) for the blockchain.
 * @param currentNode The starting node of the chain to restore links for.
 */
export function restoreChainLinks(currentNode: Chain | null): void {
  while (currentNode) {
    // Restore the prototype for the current Chain node
    Object.setPrototypeOf(currentNode, Chain.prototype);

    // If there is a next node, restore its prototype
    if (currentNode.next) {
      Object.setPrototypeOf(currentNode.next, Chain.prototype);
    }

    // If there is a previous node, restore its prototype
    if (currentNode.prev) {
      Object.setPrototypeOf(currentNode.prev, Chain.prototype);
    }

    // Move to the next node
    currentNode = currentNode.next;
  }
}

/**
 * Blockchain class representing a doubly linked list of blocks.
 * Each block contains a height, hash, previous hash and tx ids. The blockchain has a fixed maximum size,
 * and automatically removes the oldest blocks when new blocks are added beyond this size.
 */
export class Blockchain {
  private _head: Chain | null = null;
  private _tail: Chain | null = null;
  private _size: number = 0;
  // NOTE: _maxSize - Maximum number of blocks allowed in the blockchain at any given time.
  private _maxSize: number;

  constructor({ maxSize = 100 }: { maxSize?: number }) {
    this._maxSize = maxSize;
  }

  get head() {
    return this._head;
  }

  get tail() {
    return this._tail;
  }

  // Gets the hash of the first block in the chain.
  // Complexity: O(1)
  get firstBlockHash(): string {
    return this._head ? this._head.block.hash : '';
  }

  get lastBlock(): LightBlock | undefined {
    if (this._tail) {
      return this._tail.block;
    }
  }

  /**
   * Gets the previous hash of the last block in the chain.
   * @returns {string} The previous hash of the last block, or an empty string if the chain is empty.
   * Complexity: O(1)
   */
  get lastPrevBlockHash(): string {
    if (this._tail) {
      return this._tail.block.previousblockhash;
    } else {
      return '';
    }
  }

  /**
   * Gets the hash of the last block in the chain.
   * @returns {string} The hash of the last block, or an empty string if the chain is empty.
   * Complexity: O(1)
   */
  get lastBlockHash(): string {
    if (this._tail) {
      return this._tail.block.hash;
    } else {
      return '';
    }
  }

  /**
   * Gets the height of the last block in the chain.
   * @returns {number} The height of the last block, or -1 if the chain is empty.
   * Complexity: O(1)
   */
  get lastBlockHeight(): number {
    if (this._tail) {
      return this._tail.block.height;
    } else {
      // IMPORTANT: the blockchain starts from block 0,
      // so if there are no blocks at all, we use -1
      return -1;
    }
  }

  /**
   * Gets the size of the blockchain.
   * @returns {number} The number of blocks in the chain.
   * Complexity: O(1)
   */
  get size(): number {
    return this._size;
  }

  /**
   * Adds a block to the end of the chain.
   * @param {string | number} height - The height of the new block.
   * @param {string} hash - The hash of the new block.
   * @param {string} previousblockhash - The hash of the previous block.
   * @returns {boolean} True if the block was added successfully, false otherwise.
   * Complexity: O(1)
   */
  public addBlock(height: number, hash: string, previousblockhash: string, tx: string[]): boolean {
    // Before adding a block, we validate it
    if (!this.validateNextBlock(height, previousblockhash)) {
      return false;
    }

    const newBlock: LightBlock = { height, hash, previousblockhash, tx };
    const newNode: Chain = { block: newBlock, next: null, prev: this._tail };

    if (this._tail) {
      this._tail.next = newNode;
    }
    this._tail = newNode;

    if (!this._head) {
      this._head = newNode;
    }

    this._size++;

    // Remove the oldest block if the chain size exceeds the maximum allowed size
    if (this._size > this._maxSize) {
      this.removeOldestChain();
    }

    return true;
  }

  /**
   * Adds an array of blocks to the chain.
   * @param {Array<LightBlock>} blocks - Array of blocks to add.
   * @returns {boolean} True if the blocks were added successfully, false otherwise.
   * Complexity: O(n), where n - is the number of blocks in the array
   */
  public addBlocks(blocks: LightBlock[]): boolean {
    // Before adding a block, we validate it
    if (!this.validateNextBlocks(blocks)) {
      return false;
    }

    for (const block of blocks) {
      const newNode: Chain = { block, next: null, prev: this._tail };

      if (this._tail) {
        this._tail.next = newNode;
      }

      this._tail = newNode;

      if (!this._head) {
        this._head = newNode;
      }

      this._size++;

      // Remove the oldest block if the chain size exceeds the maximum allowed size
      if (this._size > this._maxSize) {
        this.removeOldestChain();
      }
    }

    return true;
  }

  /**
   * Gets the last block without deleting it.
   * @returns {LightBlock | null} The last block in the chain, or null if the chain is empty.
   * Complexity: O(1)
   */
  public peekLast(): LightBlock | null {
    return this._tail ? this._tail.block : null;
  }

  /**
   * Validates the next block to be added to the chain.
   * @param {string | number} height - The height of the new block.
   * @param {string} previousblockhash - The hash of the previous block.
   * @returns {boolean} True if the block is valid, false otherwise.
   * Complexity: O(1)
   */
  public validateNextBlock(height: number, previousblockhash: string): boolean {
    if (!this._tail) {
      // If there's no blocks in the chain, we assume this is the first block.
      return true;
    }

    // Check if the given height is exactly one more than the last block's height.
    if (this._tail.block.height + 1 !== height) {
      return false;
    }

    // Check if the given previous hash matches the last block's hash.
    if (this._tail.block.hash !== previousblockhash) {
      return false;
    }

    return true;
  }

  /**
   * Validates an array of blocks to be added to the chain.
   * Ensures that the blocks are in the correct order and can be added sequentially.
   * @param {Array<any>} blocks - Array of blocks to validate.
   * @returns {boolean} True if all blocks are valid and in the correct order, false otherwise.
   * Complexity: O(n), where n - is the number of blocks in the array
   */
  public validateNextBlocks(blocks: any): boolean {
    if (blocks.length === 0) {
      return false; // Empty array is invalid
    }

    // Check if the first block in the array can be added to the current chain
    const firstBlock = blocks[0];
    if (!this.validateNextBlock(Number(firstBlock.height), firstBlock.previousblockhash)) {
      return false; // First block doesn't fit into the current chain
    }

    // Now validate the rest of the blocks in the array to ensure they form a proper sequence
    for (let i = 1; i < blocks.length; i++) {
      const prevBlock = blocks[i - 1];
      const currentBlock = blocks[i];

      if (
        Number(currentBlock.height) !== Number(prevBlock.height) + 1 ||
        (currentBlock.previousblockhash && currentBlock.previousblockhash !== prevBlock.hash)
      ) {
        return false; // Sequence or hash mismatch within the provided blocks
      }
    }

    return true; // All blocks are valid and in the correct order
  }

  /**
   * Validates the entire blockchain.
   * @returns {boolean} True if the blockchain is valid, false otherwise.
   * Complexity: O(n), where n - is the number of blocks in the chain
   */
  public validateChain(): boolean {
    let current = this._head;

    if (!current) {
      // An empty chain is considered valid
      return true;
    }

    while (current && current.next) {
      // First check if the block heights increment by 1
      if (current.next.block.height !== current.block.height + 1) {
        return false; // Height mismatch
      }
      // Then check if the hashes match
      if (current.next.block.previousblockhash !== current.block.hash) {
        return false; // Hash mismatch
      }
      current = current.next;
    }

    // If the loop has finished and current points to the last block (this._tail)
    return current === this._tail;
  }

  /**
   * Validates that the provided block data matches the last block in the chain.
   * @param {number} height - The expected height of the last block.
   * @param {string} hash - The expected hash of the last block.
   * @param {string} previousblockhash - The expected previous hash of the last block.
   * @returns {boolean} True if the provided data matches the last block, false otherwise.
   * NOTE: This method is needed for the case when we confirm the indexing of a block
   * in another command to make sure that the block we are passing exactly matches the chain
   * Complexity: O(1)
   */
  public validateLastBlock(height: number, hash: string, previousblockhash: string): boolean {
    if (!this._tail) {
      // If there's no blocks in the chain, we assume this is the first block.
      return true;
    }

    // Check that the height of the last block matches the passed height.
    if (this._tail.block.height !== height) {
      return false;
    }

    // Check that the hash of the last block matches the passed hash
    if (this._tail.block.hash !== hash) {
      return false; // Hash mismatch
    }

    // Check that the previous hash of the last block matches the previous hash passed in.
    if (this._tail.block.previousblockhash !== previousblockhash) {
      return false;
    }

    return true;
  }

  /**
   * Finds a block by its height.
   * @param {number} height - The height of the block to find.
   * @returns {LightBlock | null} The block, or null if not found.
   * Complexity: O(n), where n - is the number of blocks in the chain
   */
  public findBlockByHeight(height: number): LightBlock | null {
    let currentNode = this._tail;
    while (currentNode) {
      if (currentNode.block.height === height) {
        return currentNode.block;
      }
      currentNode = currentNode.prev;
    }
    return null;
  }

  /**
   * Truncates the blockchain just before a specified block height.
   * @param {number} height - The height before which the chain should be truncated.
   * @returns {boolean} Returns true if truncation was successful, false if the block was not found.
   * Complexity: O(n), where n - is the number of blocks in the chain
   */
  public truncateToBlock(height: number): boolean {
    let currentNode = this._tail;
    let found = false;

    // Iterate backwards from the last block
    // until we find the block immediately before the given height
    while (currentNode && currentNode.prev) {
      if (currentNode.prev.block.height === height - 1) {
        // Update the _tail to the block before the specified height
        this._tail = currentNode.prev;

        // Delete all blocks after the found block
        this._tail.next = null;

        // Update the size
        this._size = this._tail.block.height + 1;

        found = true;
        break;
      }
      currentNode = currentNode.prev;
    }

    // Delete all blocks if the specified height is 1 (cut off the entire chain)
    if (height === 0 && this._head) {
      this._head = null;
      this._tail = null;
      this._size = 0;
      found = true;
    }

    return found;
  }

  /**
   * Removes the first block in the chain.
   * @returns {LightBlock | null} The removed block, or null if the chain is empty.
   * Complexity: O(1)
   */
  private removeOldestChain(): LightBlock | null {
    if (!this._head) return null;

    const block = this._head.block;
    this._head = this._head.next;

    if (this._head) {
      this._head.prev = null;
    } else {
      this._tail = null;
    }

    this._size--;
    return block;
  }

  /**
   * Gets the last N blocks from the blockchain in reverse order.
   * @param {number} n - The number of blocks to retrieve.
   * @returns {LightBlock[]} An array containing the last N blocks in the chain, in reverse order.
   * Complexity: O(n), where n - is the number of blocks to retrieve
   */
  public getLastNBlocks(n: number): LightBlock[] {
    if (n <= 0) {
      return [];
    }

    const blocks: LightBlock[] = [];
    let currentNode = this._tail;
    let count = 0;

    while (currentNode && count < n) {
      blocks.push(currentNode.block);
      currentNode = currentNode.prev;
      count++;
    }

    // Reverse the array to get the correct order
    return blocks.reverse();
  }

  /**
   * Converts the linked list of blocks into an ordered array of LightBlock objects.
   * @returns {LightBlock[]} An array containing all blocks in the blockchain from head to tail.
   * Complexity O(n) - where n is the number of blocks in the blockchain.
   */
  public toArray(): LightBlock[] {
    const blocks: LightBlock[] = [];
    let current = this._head;
    while (current) {
      blocks.push(current.block);
      current = current.next;
    }
    return blocks;
  }

  /**
   * Restores the linked list of blocks from an ordered array of LightBlock objects.
   * This method clears the current blockchain and rebuilds it from the provided array.
   * @param {LightBlock[]} blocks - An array of LightBlock objects to reconstruct the blockchain.
   * @returns {void}
   * Complexity O(n) - where n is the number of blocks in the provided array.
   */
  public fromArray(blocks: LightBlock[]): void {
    this._head = null;
    this._tail = null;
    this._size = 0;

    for (const block of blocks) {
      const newNode: Chain = { block, next: null, prev: this._tail };

      if (this._tail) {
        this._tail.next = newNode;
      }
      this._tail = newNode;

      if (!this._head) {
        this._head = newNode;
      }

      this._size++;

      // Remove the oldest block if the chain size exceeds the maximum allowed size.
      if (this._size > this._maxSize) {
        this.removeOldestChain();
      }
    }
  }
}
