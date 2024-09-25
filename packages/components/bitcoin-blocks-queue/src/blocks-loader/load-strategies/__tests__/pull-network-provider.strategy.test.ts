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
  let config: { concurrency: number; batchLength: number };

  beforeEach(() => {
    // Mock the AppLogger
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    } as any;

    // Mock the NetworkProviderService
    mockNetworkProvider = {
      getManyBlocksByHeights: jest.fn(),
    } as any;

    // Mock the BlocksQueue
    mockQueue = {
      lastHeight: 0,
      maxQueueLength: 100,
      enqueue: jest.fn(),
    } as any;

    // Configuration for the strategy
    config = { concurrency: 2, batchLength: 5 };

    // Instantiate the strategy with mocks
    strategy = new PullNetworkProviderStrategy(mockLogger, mockNetworkProvider, mockQueue, config);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should not start loading if already loading', async () => {
    // Set the _isLoading flag to true
    (strategy as any)._isLoading = true;

    await strategy.load(10);

    // The network provider should not be called since loading is already in progress
    expect(mockNetworkProvider.getManyBlocksByHeights).not.toHaveBeenCalled();
  });

  it('should stop loading when current network height is reached', async () => {
    const currentNetworkHeight = 5;

    // Mock the queue's lastHeight to simulate progress
    let lastHeight = 0;
    Object.defineProperty(mockQueue, 'lastHeight', {
      get: () => lastHeight,
      set: (value) => {
        lastHeight = value;
      },
    });

    mockNetworkProvider.getManyBlocksByHeights.mockImplementation(async (heights: (string | number)[]) => {
      const blocks = heights.map((height) => ({
        height: Number(height),
        hash: `hash${height}`,
        tx: [],
      })) as Block[];
      lastHeight = Math.max(lastHeight, ...heights.map(Number));
      return blocks;
    });

    mockQueue.enqueue.mockImplementation(() => Promise.resolve());

    await strategy.load(currentNetworkHeight);

    // Ensure the lastHeight has reached or exceeded the current network height
    expect(mockQueue.lastHeight).toBeGreaterThanOrEqual(currentNetworkHeight);
  });
});
