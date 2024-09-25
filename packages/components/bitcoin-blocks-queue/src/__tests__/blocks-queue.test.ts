import { BlocksQueue } from '../blocks-queue';
import { Block, Transaction } from '../interfaces';

/**
 * A test implementation of the Block interface for testing purposes.
 */
class TestBlock implements Block {
  height: number;
  hash: string;
  tx: Transaction[];
  __size: number; // Mandatory property

  constructor(height: number, tx: Transaction[] = []) {
    this.height = height;
    this.hash = `hash${height}`;
    this.tx = tx;
    this.__size = 0; // Initialize __size
  }
}

/**
 * Helper function to create a transaction with all required properties.
 *
 * @param hexSize - The size of the hex string in bytes.
 * @returns A Transaction object with all required properties.
 */
function createTransaction(hexSize: number): Transaction {
  return {
    txid: `txid${hexSize}`, // Mock txid
    hash: `hash${hexSize}`, // Mock hash
    vin: [], // Mock vin array; populate with mock data if necessary
    vout: [], // Mock vout array; populate with mock data if necessary
    hex: 'a'.repeat(hexSize * 2), // Each byte is represented by two hex characters
    // Add other properties if necessary
  };
}

describe('BlocksQueue', () => {
  let queue: BlocksQueue<TestBlock>;

  beforeEach(() => {
    queue = new BlocksQueue<TestBlock>(-1);
  });

  describe('Initialization', () => {
    it('should initialize with empty queue', () => {
      expect(queue.length).toBe(0);
      expect(queue.lastHeight).toBe(-1);
      expect(queue.currentSize).toBe(0);
      expect(queue.isQueueFull).toBe(false);
      expect(queue.isMaxHeightReached).toBe(false);
    });
  });

  describe('Enqueue Operation', () => {
    it('should enqueue block with correct height and valid transactions', async () => {
      const tx = [createTransaction(100)]; // 100 bytes
      const block = new TestBlock(0, tx);
      await queue.enqueue(block);

      expect(queue.length).toBe(1);
      expect(queue.lastHeight).toBe(0);
      expect(queue.currentSize).toBe(100);
      expect(queue.isQueueFull).toBe(false);
      expect(queue.isMaxHeightReached).toBe(false);
    });

    it('should throw error when enqueueing block with incorrect height', async () => {
      const tx = [createTransaction(100)];
      const block = new TestBlock(1, tx); // Incorrect height; should be 0

      await expect(queue.enqueue(block)).rejects.toThrow(`Can't enqueue block. Block height: 1, Queue last height: -1`);

      expect(queue.length).toBe(0);
      expect(queue.lastHeight).toBe(-1);
      expect(queue.currentSize).toBe(0);
    });

    it('should enqueue multiple blocks with correct heights and valid transactions', async () => {
      const block1 = new TestBlock(0, [createTransaction(100)]);
      const block2 = new TestBlock(1, [createTransaction(150)]);
      const block3 = new TestBlock(2, [createTransaction(200)]);

      await queue.enqueue(block1);
      await queue.enqueue(block2);
      await queue.enqueue(block3);

      expect(queue.length).toBe(3);
      expect(queue.lastHeight).toBe(2);
      expect(queue.currentSize).toBe(450);
      expect(queue.isQueueFull).toBe(false);
      expect(queue.isMaxHeightReached).toBe(false);
    });

    it('should throw error when enqueueing block if maxBlockHeight is reached', async () => {
      // Set maxBlockHeight to 1
      queue.maxBlockHeight = 1;

      const block1 = new TestBlock(0, [createTransaction(100)]);
      const block2 = new TestBlock(1, [createTransaction(150)]);
      const block3 = new TestBlock(2, [createTransaction(100)]); // Exceeds maxBlockHeight

      await queue.enqueue(block1);
      await queue.enqueue(block2);

      // Attempt to enqueue block3 which exceeds maxBlockHeight
      await expect(queue.enqueue(block3)).rejects.toThrow(
        `Can't enqueue block. isQueueFull: false, isMaxHeightReached: true, Current size + block size: 350`
      );

      expect(queue.length).toBe(2);
      expect(queue.lastHeight).toBe(1);
      expect(queue.currentSize).toBe(250);
      expect(queue.isQueueFull).toBe(false);
      expect(queue.isMaxHeightReached).toBe(true);
    });

    it('should throw error when enqueueing block that exceeds maxQueueSize', async () => {
      // Set maxQueueSize to 500 bytes
      queue.maxQueueSize = 500;

      const block1 = new TestBlock(0, [createTransaction(300)]); // 300 bytes
      const block2 = new TestBlock(1, [createTransaction(250)]); // 250 bytes

      await queue.enqueue(block1);

      // Attempt to enqueue block2 which would make total size 550 > 500
      await expect(queue.enqueue(block2)).rejects.toThrow(
        `Can't enqueue block. isQueueFull: false, isMaxHeightReached: false, Current size + block size: 550`
      );

      expect(queue.length).toBe(1);
      expect(queue.lastHeight).toBe(0);
      expect(queue.currentSize).toBe(300);
      expect(queue.isQueueFull).toBe(false);
      expect(queue.isMaxHeightReached).toBe(false);
    });
  });

  describe('Dequeue Operation', () => {
    it('should dequeue block correctly and update queue state', async () => {
      const block1 = new TestBlock(0, [createTransaction(100)]);
      const block2 = new TestBlock(1, [createTransaction(150)]);

      await queue.enqueue(block1);
      await queue.enqueue(block2);

      const dequeuedBlock1 = await queue.dequeue();
      expect(dequeuedBlock1).toEqual({
        height: 0,
        hash: 'hash0',
        tx: [
          {
            txid: 'txid100',
            hash: 'hash100',
            vin: [],
            vout: [],
            // hex was removed
          },
        ],
        __size: 100, // Expected __size value
      });
      expect(queue.length).toBe(1);
      expect(queue.lastHeight).toBe(1);
      expect(queue.currentSize).toBe(150);
      expect(queue.isQueueFull).toBe(false);
      expect(queue.isMaxHeightReached).toBe(false);

      const dequeuedBlock2 = await queue.dequeue();
      expect(dequeuedBlock2).toEqual({
        height: 1,
        hash: 'hash1',
        tx: [
          {
            txid: 'txid150',
            hash: 'hash150',
            vin: [],
            vout: [],
            // hex was removed
          },
        ],
        __size: 150, // Expected __size value
      });
      expect(queue.length).toBe(0);
      expect(queue.lastHeight).toBe(1); // Last height remains unchanged after dequeuing
      expect(queue.currentSize).toBe(0);
      expect(queue.isQueueFull).toBe(false);
      expect(queue.isMaxHeightReached).toBe(false);
    });

    it('should return undefined when dequeuing from empty queue', async () => {
      const dequeuedBlock = await queue.dequeue();
      expect(dequeuedBlock).toBeUndefined();
      expect(queue.length).toBe(0);
      expect(queue.lastHeight).toBe(-1);
      expect(queue.currentSize).toBe(0);
      expect(queue.isQueueFull).toBe(false);
      expect(queue.isMaxHeightReached).toBe(false);
    });
  });

  describe('Peek Operation', () => {
    it('should peek at the first block without removing it', async () => {
      const tx = [createTransaction(100)];
      const block1 = new TestBlock(0, tx);
      await queue.enqueue(block1);

      const firstBlock = await queue.peekFirstBlock();
      expect(firstBlock?.height).toBe(0);
      expect(queue.length).toBe(1); // Ensure the block is not removed
      expect(queue.currentSize).toBe(100);
    });

    it('should return null when peeking an empty queue', async () => {
      const firstBlock = await queue.peekFirstBlock();
      expect(firstBlock).toBeNull();
      expect(queue.length).toBe(0);
      expect(queue.currentSize).toBe(0);
    });
  });

  describe('Clear Operation', () => {
    it('should clear the queue correctly', async () => {
      const block1 = new TestBlock(0, [createTransaction(100)]);
      const block2 = new TestBlock(1, [createTransaction(150)]);

      await queue.enqueue(block1);
      await queue.enqueue(block2);

      queue.clear();

      expect(queue.length).toBe(0);
      expect(queue.currentSize).toBe(0);
      expect(queue.lastHeight).toBe(1); // Last height remains as per implementation
      expect(queue.isQueueFull).toBe(false);
      expect(queue.isMaxHeightReached).toBe(false);
    });
  });

  describe('Reorganize Operation', () => {
    it('should reorganize the queue correctly', async () => {
      const block1 = new TestBlock(0, [createTransaction(100)]);
      const block2 = new TestBlock(1, [createTransaction(150)]);
      await queue.enqueue(block1);
      await queue.enqueue(block2);

      queue.reorganize(0);

      expect(queue.length).toBe(0);
      expect(queue.lastHeight).toBe(0);
      expect(queue.currentSize).toBe(0);
      expect(queue.isQueueFull).toBe(false);
      expect(queue.isMaxHeightReached).toBe(false);
    });
  });

  describe('Fetch Block by Height', () => {
    it('should fetch a block by height from inStack using binary search', async () => {
      const block1 = new TestBlock(0, [createTransaction(100)]);
      const block2 = new TestBlock(1, [createTransaction(150)]);

      await queue.enqueue(block1);
      await queue.enqueue(block2);

      const fetchedBlock = queue.fetchBlockFromInStack(0);
      expect(fetchedBlock).toEqual({
        height: 0,
        hash: 'hash0',
        tx: [
          {
            txid: 'txid100',
            hash: 'hash100',
            vin: [],
            vout: [],
            // hex was removed
          },
        ],
        __size: 100,
      });
    });

    it('should return undefined if block is not found in inStack using binary search', async () => {
      const block = new TestBlock(0, [createTransaction(100)]);
      await queue.enqueue(block);

      const result = queue.fetchBlockFromInStack(1);
      expect(result).toBeUndefined();
    });

    it('should fetch a block by height from outStack using binary search', async () => {
      const block1 = new TestBlock(0, [createTransaction(100)]);
      const block2 = new TestBlock(1, [createTransaction(150)]);

      await queue.enqueue(block1);
      await queue.enqueue(block2);

      const result = queue.fetchBlockFromOutStack(0);
      expect(result).toEqual({
        height: 0,
        hash: 'hash0',
        tx: [
          {
            txid: 'txid100',
            hash: 'hash100',
            vin: [],
            vout: [],
            // hex was removed
          },
        ],
        __size: 100,
      });
    });

    it('should return undefined if block is not found in outStack using binary search', async () => {
      const block = new TestBlock(0, [createTransaction(100)]);
      await queue.enqueue(block);
      await queue.dequeue(); // Transfer items to outStack

      const result = queue.fetchBlockFromOutStack(1);
      expect(result).toBeUndefined();
    });
  });

  describe('Find Blocks by Hash', () => {
    it('should find blocks by hash correctly', async () => {
      const block1 = new TestBlock(0, [createTransaction(100)]);
      const block2 = new TestBlock(1, [createTransaction(150)]);
      const block3 = new TestBlock(2, [createTransaction(200)]);

      await queue.enqueue(block1);
      await queue.enqueue(block2);
      await queue.enqueue(block3);

      const foundBlocks = queue.findBlocks(new Set(['hash0', 'hash2']));
      expect(foundBlocks).toContainEqual({
        height: 0,
        hash: 'hash0',
        tx: [
          {
            txid: 'txid100',
            hash: 'hash100',
            vin: [],
            vout: [],
            // hex was removed
          },
        ],
        __size: 100,
      });
      expect(foundBlocks).toContainEqual({
        height: 2,
        hash: 'hash2',
        tx: [
          {
            txid: 'txid200',
            hash: 'hash200',
            vin: [],
            vout: [],
            // hex was removed
          },
        ],
        __size: 200,
      });
      expect(foundBlocks.length).toBe(2);
    });

    it('should return an empty array when finding blocks with non-existent hashes', async () => {
      const block1 = new TestBlock(0, [createTransaction(100)]);
      await queue.enqueue(block1);

      const foundBlocks = queue.findBlocks(new Set(['hash1']));
      expect(foundBlocks).toEqual([]);
    });
  });

  describe('Peek Previous Blocks Generator', () => {
    it('should handle peekPrevBlock generator correctly', async () => {
      const block1 = new TestBlock(0, [createTransaction(100)]);
      const block2 = new TestBlock(1, [createTransaction(150)]);
      const block3 = new TestBlock(2, [createTransaction(200)]);

      await queue.enqueue(block1);
      await queue.enqueue(block2);
      await queue.enqueue(block3);

      const generator = queue.peekPrevBlock();
      const firstYield = generator.next().value;
      const secondYield = generator.next().value;
      const thirdYield = generator.next().value;

      expect(firstYield).toEqual({
        height: 0,
        hash: 'hash0',
        tx: [
          {
            txid: 'txid100',
            hash: 'hash100',
            vin: [],
            vout: [],
            // hex was removed
          },
        ],
        __size: 100,
      });
      expect(secondYield).toEqual({
        height: 1,
        hash: 'hash1',
        tx: [
          {
            txid: 'txid150',
            hash: 'hash150',
            vin: [],
            vout: [],
            // hex was removed
          },
        ],
        __size: 150,
      });
      expect(thirdYield).toEqual({
        height: 2,
        hash: 'hash2',
        tx: [
          {
            txid: 'txid200',
            hash: 'hash200',
            vin: [],
            vout: [],
            // hex was removed
          },
        ],
        __size: 200,
      });
      expect(generator.next().done).toBe(true);
    });

    it('should return no yields when queue is empty', () => {
      const generator = queue.peekPrevBlock();
      const result = generator.next();
      expect(result.done).toBe(true);
      expect(result.value).toBeUndefined();
    });
  });

  describe('Get Batch Up To Size', () => {
    it('should throw error when first block exceeds maxSize in getBatchUpToSize', async () => {
      // Set maxQueueSize to 500 bytes
      queue.maxQueueSize = 500;

      // Attempt to enqueue a block that exceeds maxQueueSize
      const oversizedBlock = new TestBlock(0, [createTransaction(600)]); // 600 bytes

      // Enqueue should throw an error because block size > maxQueueSize
      await expect(queue.enqueue(oversizedBlock)).rejects.toThrow(
        `Can't enqueue block. isQueueFull: false, isMaxHeightReached: false, Current size + block size: 600`
      );

      expect(queue.length).toBe(0);
      expect(queue.currentSize).toBe(0);

      // Enqueue a valid block
      const validBlock = new TestBlock(0, [createTransaction(400)]); // 400 bytes
      await queue.enqueue(validBlock);

      // Attempt to get batch with maxSize 300, which is less than validBlock's size
      await expect(queue.getBatchUpToSize(300)).rejects.toThrow('Block size exceeds the maximum batch size');
    });

    it('should return an empty array when queue is empty', async () => {
      const batch = await queue.getBatchUpToSize(500);
      expect(batch).toEqual([]);
    });

    it('should return correct batch when multiple blocks fit within maxSize', async () => {
      const block1 = new TestBlock(0, [createTransaction(100)]); // 100 bytes
      const block2 = new TestBlock(1, [createTransaction(150)]); // 150 bytes
      const block3 = new TestBlock(2, [createTransaction(200)]); // 200 bytes

      await queue.enqueue(block1);
      await queue.enqueue(block2);
      await queue.enqueue(block3);

      const batch = await queue.getBatchUpToSize(300); // Should include block1 and block2
      expect(batch).toContainEqual({
        height: 0,
        hash: 'hash0',
        tx: [
          {
            txid: 'txid100',
            hash: 'hash100',
            vin: [],
            vout: [],
            // hex was removed
          },
        ],
        __size: 100,
      });
      expect(batch).toContainEqual({
        height: 1,
        hash: 'hash1',
        tx: [
          {
            txid: 'txid150',
            hash: 'hash150',
            vin: [],
            vout: [],
            // hex was removed
          },
        ],
        __size: 150,
      });
      expect(batch.length).toBe(2);
      expect(batch).not.toContainEqual({
        height: 2,
        hash: 'hash2',
        tx: [
          {
            txid: 'txid200',
            hash: 'hash200',
            vin: [],
            vout: [],
            // hex was removed
          },
        ],
        __size: 200,
      });
    });

    it('should include a single block if it exactly matches maxSize', async () => {
      const block1 = new TestBlock(0, [createTransaction(300)]); // 300 bytes

      await queue.enqueue(block1);

      const batch = await queue.getBatchUpToSize(300); // Should include block1
      expect(batch).toContainEqual({
        height: 0,
        hash: 'hash0',
        tx: [
          {
            txid: 'txid300',
            hash: 'hash300',
            vin: [],
            vout: [],
            // hex was removed
          },
        ],
        __size: 300,
      });
      expect(batch.length).toBe(1);
    });
  });
});
