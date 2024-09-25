import { BlocksQueue } from '../blocks-queue';
import { Block, Transaction } from '../interfaces';

class TestBlock implements Block {
  height: number;
  hash: string;
  tx: Transaction[];

  constructor(height: number) {
    this.height = height;
    this.hash = '';
    this.tx = [];
  }
}

describe('BlocksQueue', () => {
  let queue: BlocksQueue<TestBlock>;

  beforeEach(() => {
    queue = new BlocksQueue<TestBlock>(-1);
  });

  it('should initialize with empty queue', () => {
    expect(queue.length).toBe(0);
    expect(queue.lastHeight).toBe(-1);
  });

  it('should enqueue block with correct height', async () => {
    const block = new TestBlock(0);
    await queue.enqueue(block);
    expect(queue.length).toBe(1);
    expect(queue.lastHeight).toBe(0);
  });

  it('should not enqueue block with incorrect height', async () => {
    const block = new TestBlock(1); // Incorrect height; should be 0
    await queue.enqueue(block);
    expect(queue.length).toBe(0);
    expect(queue.lastHeight).toBe(-1);
  });

  it('should enqueue multiple blocks with correct heights', async () => {
    const block1 = new TestBlock(0);
    const block2 = new TestBlock(1);
    const block3 = new TestBlock(2);

    await queue.enqueue(block1);
    await queue.enqueue(block2);
    await queue.enqueue(block3);

    expect(queue.length).toBe(3);
    expect(queue.lastHeight).toBe(2);
  });

  it('should dequeue block correctly', async () => {
    const block1 = new TestBlock(0);
    const block2 = new TestBlock(1);

    await queue.enqueue(block1);
    await queue.enqueue(block2);

    const dequeuedBlock1 = await queue.dequeue();
    expect(dequeuedBlock1).toBe(block1);
    expect(queue.length).toBe(1);
    expect(queue.lastHeight).toBe(1);

    const dequeuedBlock2 = await queue.dequeue();
    expect(dequeuedBlock2).toBe(block2);
    expect(queue.length).toBe(0);
    expect(queue.lastHeight).toBe(1); // Last height remains unchanged after dequeuing
  });

  it('should update length correctly after multiple dequeues', async () => {
    const block1 = new TestBlock(0);
    const block2 = new TestBlock(1);
    const block3 = new TestBlock(2);

    await queue.enqueue(block1);
    await queue.enqueue(block2);
    await queue.enqueue(block3);

    expect(queue.length).toBe(3);

    const dequeued1 = await queue.dequeue();
    expect(dequeued1).toBe(block1);
    expect(queue.length).toBe(2);

    const dequeued2 = await queue.dequeue();
    expect(dequeued2).toBe(block2);
    expect(queue.length).toBe(1);

    const dequeued3 = await queue.dequeue();
    expect(dequeued3).toBe(block3);
    expect(queue.length).toBe(0);
  });

  it('should peek at the first block without removing it', async () => {
    const block1 = new TestBlock(0);
    await queue.enqueue(block1);

    const firstBlock = await queue.peekFirstBlock();
    expect(firstBlock?.height).toBe(0);
    expect(queue.length).toBe(1); // Ensure the block is not removed
  });

  it('should clear the queue correctly', async () => {
    const block1 = new TestBlock(0);
    const block2 = new TestBlock(1);

    await queue.enqueue(block1);
    await queue.enqueue(block2);

    queue.clear();

    expect(queue.length).toBe(0);
    expect(queue.lastHeight).toBe(1); // Last height remains as per implementation
  });

  it('should handle multiple enqueues correctly', async () => {
    const blocks = [new TestBlock(0), new TestBlock(1), new TestBlock(2)];
    for (const block of blocks) {
      await queue.enqueue(block);
    }

    expect(queue.length).toBe(3);
    expect(queue.lastHeight).toBe(2);
  });

  it('should return undefined when dequeuing from empty queue', async () => {
    const dequeuedBlock = await queue.dequeue();
    expect(dequeuedBlock).toBeUndefined();
    expect(queue.length).toBe(0);
    expect(queue.lastHeight).toBe(-1);
  });

  it('should fetch a block by height from inStack using binary search', async () => {
    const block1 = new TestBlock(0);
    const block2 = new TestBlock(1);

    await queue.enqueue(block1);
    await queue.enqueue(block2);

    const fetchedBlock = queue.fetchBlockFromInStack(0);
    expect(fetchedBlock).toBe(block1);
  });

  it('should return undefined if block is not found in inStack using binary search', async () => {
    const block = new TestBlock(0);
    await queue.enqueue(block);

    const result = queue.fetchBlockFromInStack(1);
    expect(result).toBeUndefined();
  });

  it('should fetch a block by height from outStack using binary search', async () => {
    const block1 = new TestBlock(0);
    const block2 = new TestBlock(1);

    await queue.enqueue(block1);
    await queue.enqueue(block2);

    const result = queue.fetchBlockFromOutStack(0);
    expect(result).toBe(block1);
  });

  it('should return undefined if block is not found in outStack using binary search', async () => {
    const block = new TestBlock(0);
    await queue.enqueue(block);
    await queue.dequeue(); // Transfer items to outStack

    const result = queue.fetchBlockFromOutStack(1);
    expect(result).toBeUndefined();
  });

  it('should maintain order after transferItems', async () => {
    const block1 = new TestBlock(0);
    const block2 = new TestBlock(1);

    await queue.enqueue(block1);
    await queue.enqueue(block2);
    queue['transferItems'](); // Manually trigger transferItems

    expect(queue['outStack'][0]).toBe(block2);
    expect(queue['outStack'][1]).toBe(block1);
  });

  it('should fetch blocks correctly after transferItems', async () => {
    const block1 = new TestBlock(0);
    const block2 = new TestBlock(1);

    await queue.enqueue(block1);
    await queue.enqueue(block2);
    queue['transferItems'](); // Manually trigger transferItems

    const resultInStack = queue.fetchBlockFromInStack(0);
    const resultOutStack = queue.fetchBlockFromOutStack(0);

    expect(resultInStack).toBeUndefined();
    expect(resultOutStack).toBe(block1);
  });

  it('should not enqueue block if queue is full', async () => {
    queue.maxQueueLength = 2; // Set max queue length for testing
    const block1 = new TestBlock(0);
    const block2 = new TestBlock(1);
    const block3 = new TestBlock(2);

    await queue.enqueue(block1);
    await queue.enqueue(block2);

    await queue.enqueue(block3); // Attempt to enqueue when full

    expect(queue.length).toBe(2);
    expect(queue.lastHeight).toBe(1);
  });

  it('should not enqueue block if max block height is reached', async () => {
    queue.maxBlockHeight = 1; // Set max block height for testing
    const block1 = new TestBlock(0);
    const block2 = new TestBlock(1);
    const block3 = new TestBlock(2);

    await queue.enqueue(block1);
    await queue.enqueue(block2);

    await queue.enqueue(block3); // Attempt to enqueue beyond max height

    expect(queue.length).toBe(2);
    expect(queue.lastHeight).toBe(1);
  });

  it('should find blocks by hash correctly', async () => {
    const block1 = new TestBlock(0);
    block1.hash = 'hash1';
    const block2 = new TestBlock(1);
    block2.hash = 'hash2';
    const block3 = new TestBlock(2);
    block3.hash = 'hash3';

    await queue.enqueue(block1);
    await queue.enqueue(block2);
    await queue.enqueue(block3);

    const foundBlocks = queue.findBlocks(new Set(['hash1', 'hash3']));
    expect(foundBlocks).toContain(block1);
    expect(foundBlocks).toContain(block3);
    expect(foundBlocks.length).toBe(2);
  });

  it('should return an empty array when finding blocks with non-existent hashes', async () => {
    const block1 = new TestBlock(0);
    block1.hash = 'hash1';

    await queue.enqueue(block1);

    const foundBlocks = queue.findBlocks(new Set(['hash2']));
    expect(foundBlocks).toEqual([]);
  });

  it('should handle peekPrevBlock generator correctly', async () => {
    const block1 = new TestBlock(0);
    const block2 = new TestBlock(1);
    const block3 = new TestBlock(2);

    await queue.enqueue(block1);
    await queue.enqueue(block2);
    await queue.enqueue(block3);

    const generator = queue.peekPrevBlock();
    const firstYield = generator.next().value;
    const secondYield = generator.next().value;
    const thirdYield = generator.next().value;

    expect(firstYield).toEqual(block1);
    expect(secondYield).toEqual(block2);
    expect(thirdYield).toEqual(block3);
    expect(generator.next().done).toBe(true);
  });

  it('should reorganize the queue correctly', async () => {
    const block1 = new TestBlock(0);
    const block2 = new TestBlock(1);
    await queue.enqueue(block1);
    await queue.enqueue(block2);

    queue.reorganize(0);

    expect(queue.length).toBe(0);
    expect(queue.lastHeight).toBe(0);
  });
});
