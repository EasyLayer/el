import { NetworkProviderService } from '@easylayer/components/bitcoin-network-provider';
import { AppLogger } from '@easylayer/components/logger';
import { PullNetworkProviderStrategy } from '../pull-network-provider.strategy';
import { BlocksQueue } from '../../../blocks-queue';
import { Block } from '../../../interfaces';

describe('PullNetworkProviderStrategy', () => {
  let strategy: PullNetworkProviderStrategy;
  let mockLogger: jest.Mocked<AppLogger>;
  let mockNetworkProvider: jest.Mocked<NetworkProviderService>;
  let mockQueue: jest.Mocked<BlocksQueue<Block>>;
  let config: { maxRequestBlocksBatchSize: number; isTest: boolean };

  beforeEach(() => {
    // Initialize mock logger with jest.fn() for all methods
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as any;

    // Initialize mock network provider with jest.fn() for getManyBlocksByHeights
    mockNetworkProvider = {
      getManyBlocksByHeights: jest.fn(),
      getManyBlocksStatsByHeights: jest.fn(() => []),
    } as any;

    // Initialize mock queue with necessary properties and methods
    mockQueue = {
      lastHeight: 0,
      maxQueueLength: 100, // Assuming this property exists
      isMaxHeightReached: false, // Assuming this property exists
      isQueueFull: false, // Assuming this property exists
      enqueue: jest.fn(),
      // Add other necessary properties and methods as needed
    } as any;

    config = { maxRequestBlocksBatchSize: 10 * 1024 * 1024, isTest: true }; // 10 MB

    // Instantiate the strategy with mocked dependencies
    strategy = new PullNetworkProviderStrategy(mockLogger, mockNetworkProvider, mockQueue, config);
  });

  afterEach(() => {
    // Clear all mock calls and instances after each test to ensure isolation
    jest.clearAllMocks();
  });

  it('should handle queue being full by throwing an error', async () => {
    const currentNetworkHeight = 15; // Set higher than lastHeight to avoid triggering "Reached current network height"

    // Initialize lastHeight to simulate progress
    let lastHeight = 10; // Set lastHeight to 10, which is less than currentNetworkHeight (15)
    Object.defineProperty(mockQueue, 'lastHeight', {
      get: () => lastHeight,
      set: (value) => {
        lastHeight = value;
      },
    });

    // Mock the getManyBlocksByHeights method to return blocks and update lastHeight accordingly
    mockNetworkProvider.getManyBlocksByHeights.mockImplementation(async (heights: (string | number)[]) => {
      const blocks = heights.map((height) => ({
        height: Number(height),
        hash: `hash${height}`,
        tx: [],
        size: 0,
      })) as Block[];

      // Update lastHeight based on the fetched blocks
      lastHeight = Math.max(lastHeight, ...heights.map(Number));
      return blocks;
    });

    // Mock enqueue to always resolve successfully
    mockQueue.enqueue.mockImplementation(() => Promise.resolve());

    // Set the queue to be full to trigger the queue full condition
    Object.defineProperty(mockQueue, 'isQueueFull', {
      get: () => true,
    });

    // Expect the load method to throw an error when the queue is full
    await expect(strategy.load(currentNetworkHeight)).rejects.toThrow(`Queue is full, ${lastHeight}`);

    // Ensure that lastHeight has NOT reached the current network height
    expect(mockQueue.lastHeight).not.toBeGreaterThanOrEqual(currentNetworkHeight);

    // Verify that enqueue was never called since the queue was full
    expect(mockQueue.enqueue).not.toHaveBeenCalled();
  });
});
