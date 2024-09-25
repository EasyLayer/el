import _ from 'lodash';
import { Mutex } from 'async-mutex';
import { Block } from './interfaces';

/**
 * Represents a queue specifically designed for managing blocks in a blockchain context.
 * Maintains a FIFO (First-In-First-Out) structure to ensure the integrity and order of blocks.
 *
 * @template T - The type of block that extends the {@link Block} interface.
 */
export class BlocksQueue<T extends Block> {
  private inStack: T[] = [];
  private outStack: T[] = [];
  private _lastHeight: number;
  private _maxQueueSize: number = 10 * 1024 * 1024; // Bytes
  private _size: number = 0; // Bytes

  private _maxBlockHeight: number = Number.MAX_SAFE_INTEGER;
  private readonly mutex = new Mutex();

  /**
   * Creates an instance of {@link BlocksQueue}.
   *
   * @param lastHeight - The height of the last block in the queue.
   */
  constructor(lastHeight: number) {
    this._lastHeight = lastHeight;
  }

  /**
   * Determines whether the queue has reached its maximum allowed size.
   * @returns `true` if the current size is greater than or equal to the maximum queue size; otherwise, `false`.
   * @complexity O(1)
   */
  get isQueueFull(): boolean {
    return this._size >= this._maxQueueSize;
  }

  /**
   * Determines whether the queue has reached the maximum allowed block height.
   * @returns `true` if the last block's height is greater than or equal to the maximum block height; otherwise, `false`.
   * @complexity O(1)
   */
  get isMaxHeightReached(): boolean {
    return this._lastHeight >= this._maxBlockHeight;
  }

  /**
   * Gets the maximum block height that the queue can hold.
   * @returns The maximum block height as a number.
   * @complexity O(1)
   */
  public get maxBlockHeight(): number {
    return this._maxBlockHeight;
  }

  /**
   * Sets the maximum block height that the queue can hold.
   * @param height - The new maximum block height.
   * @complexity O(1)
   */
  public set maxBlockHeight(height: number) {
    this._maxBlockHeight = height;
  }

  /**
   * Gets the maximum queue size in bytes.
   * @returns The maximum queue size in bytes as a number.
   * @complexity O(1)
   */
  public get maxQueueSize(): number {
    return this._maxQueueSize;
  }

  /**
   * Sets the maximum queue size in bytes.
   * @param length - The new maximum queue size in bytes.
   * @complexity O(1)
   */
  public set maxQueueSize(length: number) {
    this._maxQueueSize = length;
  }

  /**
   * Retrieves the current size of the queue in bytes.
   * @returns The total size of the queue in bytes.
   * @complexity O(1)
   */
  public get currentSize(): number {
    return this._size;
  }

  /**
   * Retrieves the current number of blocks in the queue.
   * @returns The total number of blocks in the queue.
   * @complexity O(1)
   */
  public get length() {
    return this.inStack.length + this.outStack.length;
  }

  /**
   * Retrieves the height of the last block in the queue.
   * @returns The height of the last block as a number.
   * @complexity O(1)
   */
  public get lastHeight(): number {
    return this._lastHeight;
  }

  /**
   * Retrieves the first block in the queue without removing it.
   * @returns A promise that resolves to the first block in the queue or `undefined` if the queue is empty.
   * @complexity O(1)
   */
  public async firstBlock(): Promise<T | undefined> {
    return this.mutex.runExclusive(async () => {
      if (this.outStack.length === 0) {
        this.transferItems();
      }
      return this.outStack[this.outStack.length - 1];
    });
  }

  /**
   * Fetches a block by its height from the `inStack` using binary search.
   * @param height - The height of the block to retrieve.
   * @returns The block with the specified height or `undefined` if not found.
   * @complexity O(log n)
   */
  public fetchBlockFromInStack(height: number): T | undefined {
    return this.binarySearch(this.inStack, height, true);
  }

  /**
   * Fetches a block by its height from the `outStack` using binary search.
   * @param height - The height of the block to retrieve.
   * @returns The block with the specified height or `undefined` if not found.
   * @complexity O(log n)
   */
  public fetchBlockFromOutStack(height: number): T | undefined {
    this.transferItems();
    return this.binarySearch(this.outStack, height, false);
  }

  /**
   * Enqueues a block to the queue if it meets the following conditions:
   * - Its height is exactly one more than the height of the last block in the queue.
   * - Adding it does not exceed the maximum queue size.
   * - The queue has not reached the maximum block height.
   * @param block - The block to be added to the queue.
   * @throws Will throw an error if the queue is full, the maximum block height is reached, or the block's height is incorrect.
   * @complexity O(1)
   */
  public async enqueue(block: T): Promise<void> {
    await this.mutex.runExclusive(async () => {
      const blockSize = this.calculateBlockSize(block);

      if (this.isQueueFull || this.isMaxHeightReached || this._size + blockSize > this._maxQueueSize) {
        throw new Error(
          `Can't enqueue block. isQueueFull: ${this.isQueueFull}, isMaxHeightReached: ${this.isMaxHeightReached}`
        );
      }

      if (Number(block.height) !== this._lastHeight + 1) {
        throw new Error(`Can't enqueue block. Block height: ${block.height}, Queue last height: ${this._lastHeight}`);
      }

      this.inStack.push(block);
      this._lastHeight = Number(block.height);
      this._size += blockSize;
    });
  }

  /**
   * Dequeues the first block from the queue.
   * @returns A promise that resolves to the dequeued block or `undefined` if the queue is empty.
   * @complexity O(1)
   */
  public async dequeue(): Promise<T | undefined> {
    return this.mutex.runExclusive(async () => {
      if (this.outStack.length === 0) {
        this.transferItems();
      }

      const block = this.outStack.pop();
      if (block) {
        const blockSize = this.calculateBlockSize(block);
        this._size -= blockSize;
      }
      return block;
    });
  }

  /**
   * Peeks at the first block in the queue without removing it.
   * @returns A promise that resolves to the first block in the queue or `null` if the queue is empty.
   * @complexity O(1)
   */
  public async peekFirstBlock(): Promise<T | null> {
    return this.mutex.runExclusive(async () => {
      if (this.outStack.length === 0) {
        this.transferItems();
      }

      // IMPORTANT: We make sure to clone the block so that modifications to the object
      // later in the process cannot affect the block in the queue.
      return this.outStack.length > 0 ? _.cloneDeep(this.outStack[this.outStack.length - 1]) : null;
    });
  }

  /**
   * Iterates over blocks in reverse order without removing them from the queue.
   * @yields The previous block in the queue.
   * @generator
   * @complexity O(n)
   */
  public *peekPrevBlock(): Generator<T, void, unknown> {
    if (this.outStack.length === 0) {
      this.transferItems();
    }

    for (let i = this.outStack.length - 1; i >= 0; i--) {
      // TODO: think about whether shallow copy is enough for us?
      // yield _.cloneDeep(this.outStack[i]);
      yield { ...this.outStack[i] };
    }
  }

  /**
   * Retrieves a batch of blocks whose cumulative size does not exceed the specified maximum size.
   * @param maxSize - The maximum cumulative size of the batch in bytes.
   * @returns A promise that resolves to an array of blocks fitting within the specified size.
   * @throws Will throw an error if the first block exceeds the maximum batch size.
   * @complexity O(n)
   */
  public async getBatchUpToSize(maxSize: number): Promise<T[]> {
    return this.mutex.runExclusive(async () => {
      if (this.length === 0) {
        return [];
      }

      const batch: T[] = [];
      let accumulatedSize = 0;

      const iterator = this.peekPrevBlock();

      for (const block of iterator) {
        const blockSize = this.calculateBlockSize(block);

        if (accumulatedSize + blockSize > maxSize) {
          if (batch.length === 0) {
            // If the first block exceeds maxSize, throw an error
            throw new Error('Block size exceeds the maximum batch size');
          }
          break;
        }

        batch.push(block);
        accumulatedSize += blockSize;
      }

      return batch;
    });
  }

  /**
   * Clears the entire queue, removing all blocks and resetting the current size.
   * @complexity O(1)
   */
  public clear(): void {
    // Clear the entire queue
    this.inStack = [];
    this.outStack = [];
    this._size = 0;
  }

  /**
   * Reorganizes the queue by clearing all existing blocks and setting a new last height.
   * @param reorganizeHeight - The new last height to set after reorganization.
   * @complexity O(1)
   */
  public reorganize(reorganizeHeight: number): void {
    this.clear();
    this._lastHeight = reorganizeHeight;
  }

  /**
   * Searches for blocks in the `outStack` by a set of hashes, starting from the end.
   * @param hashSet - A set of block hashes to search for.
   * @returns An array of blocks that match the provided hashes.
   * @complexity O(n)
   */
  public findBlocks(hashSet: Set<string>): T[] {
    const blocks: T[] = [];

    this.transferItems();

    // Iterate through the outStack in reverse order, starting from the last element
    for (let i = this.outStack.length - 1; i >= 0; i--) {
      const block = this.outStack[i];
      if (hashSet.has(block.hash)) {
        blocks.push(block);
        if (blocks.length === hashSet.size) {
          // Break the loop if all blocks are found
          break;
        }
      }
    }

    return blocks;
  }

  /**
   * Transfers all items from the `inStack` to the `outStack`.
   * @complexity O(n)
   */
  private transferItems(): void {
    while (this.inStack.length > 0) {
      this.outStack.push(this.inStack.pop()!);
    }
  }

  /**
   * Performs a binary search to find a block by its height within a specified stack.
   * @param stack - The stack (either `inStack` or `outStack`) to search within.
   * @param height - The height of the block to find.
   * @param isInStack - Indicates whether the search is being performed in the `inStack`.
   * @returns The block if found; otherwise, `undefined`.
   * @complexity O(log n)
   */
  private binarySearch(stack: T[], height: number, isInStack: boolean): T | undefined {
    let left = 0;
    let right = stack.length - 1;

    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      const midHeight = stack[mid].height;

      if (midHeight === height) {
        return stack[mid];
      } else if (isInStack) {
        if (midHeight < height) {
          left = mid + 1;
        } else {
          right = mid - 1;
        }
      } else {
        if (midHeight > height) {
          left = mid + 1;
        } else {
          right = mid - 1;
        }
      }
    }

    return undefined;
  }

  /**
   * Calculates the size of a block in bytes based on the length of its transactions' hex representations.
   * @param block - The block for which to calculate the size.
   * @returns The total size of the block in bytes.
   * @throws Will throw an error if the block has no transactions or if any transaction lacks a valid `hex` property.
   * @complexity O(n)
   */
  private calculateBlockSize(block: T): number {
    let totalSize = 0;

    const { tx } = block;

    if (!tx || tx.length === 0) {
      throw new Error('No transactions found in block or transactions are empty');
    }

    // Sum up the sizes of all transactions in the block based on their hex representation
    for (const t of tx) {
      // Check that hex exists and is a string
      if (!t.hex || typeof t.hex !== 'string') {
        throw new Error(`Invalid hex in transaction hex: ${t?.hex}`);
      }

      // Each byte is represented by two characters in hex
      totalSize += t.hex.length / 2;
    }

    return totalSize;
  }
}
