import { Mutex } from 'async-mutex';
import { NetworkProviderService } from '@easylayer/components/bitcoin-network-provider';
import { AppLogger, RuntimeTracker } from '@easylayer/components/logger';
import { BlocksLoadingStrategy, StrategyNames } from './load-strategy.interface';
import { Block } from '../../interfaces';
import { BlocksQueue } from '../../blocks-queue';

export class PullNetworkProviderStrategy implements BlocksLoadingStrategy {
  readonly name: StrategyNames = StrategyNames.PULL_NETWORL_PROVIDER;
  private _isLoading: boolean = false;
  private _batchLength!: number;
  private _concurrency!: number;
  private _missedHeights: number[] = [];
  private _loadedBlocks: Block[] = [];
  private _mutex: Mutex = new Mutex();

  /**
   * Creates an instance of PullNetworkProviderStrategy.
   * @param log - The application logger.
   * @param networkProvider - The network provider service.
   * @param queue - The blocks queue.
   * @param config - Configuration object containing concurrency and batch length.
   */
  constructor(
    private readonly log: AppLogger,
    private readonly networkProvider: NetworkProviderService,
    private readonly queue: BlocksQueue<Block>,
    config: {
      concurrency: number;
      batchLength: number;
    }
  ) {
    this._batchLength = config.batchLength;
    this._concurrency = config.concurrency;
  }

  /**
   * Indicates whether the loading process is currently active.
   * @returns A boolean indicating the loading state.
   */
  get isLoading(): boolean {
    return this._isLoading;
  }

  /**
   * Starts the process of loading blocks up to the current network height.
   * @param currentNetworkHeight - The current height of the blockchain.
   * @returns A promise that resolves when loading is complete.
   */
  public async load(currentNetworkHeight: number): Promise<void> {
    if (this._isLoading) {
      return;
    }

    this._isLoading = true;
    this._missedHeights = [];
    this._loadedBlocks = [];

    while (this._isLoading) {
      // Check if we have reached the current network height
      if (this.queue.lastHeight >= currentNetworkHeight) {
        this.log.debug('Reached current network height.', { lastHeight: this.queue.lastHeight }, this.constructor.name);
        break;
      }

      // Check if the queue is full
      if (this.queue.length >= this.queue.maxQueueLength) {
        // When the queue is full, wait a bit
        this.log.debug('Queue is full. Waiting...', { queueLength: this.queue.length }, this.constructor.name);
        await new Promise((resolve) => setTimeout(resolve, 100));
        continue;
      }

      try {
        await this.execute(currentNetworkHeight);
      } catch (error) {
        await this.stop();
        throw error;
      }
    }

    await this.stop();
  }

  /**
   * Stops the loading process.
   * @returns A promise that resolves when the loading process has stopped.
   */
  private async stop(): Promise<void> {
    if (!this._isLoading) return;
    this._isLoading = false;
  }

  /**
   * Destroys the strategy by stopping the loading process.
   * @returns A promise that resolves when the strategy has been destroyed.
   */
  public async destroy(): Promise<void> {
    await this.stop();
  }

  /**
   * Executes the loading tasks by assigning workers and handling missed heights.
   * @param currentNetworkHeight - The current height of the blockchain.
   * @returns A promise that resolves when execution is complete.
   */
  private async execute(currentNetworkHeight: number): Promise<void> {
    const activeTasks: Promise<void>[] = [];

    for (let i = 0; i < this._concurrency; i++) {
      const nextStartHeight = this.queue.lastHeight + 1 + i * this._batchLength;

      if (currentNetworkHeight >= nextStartHeight) {
        if (!this._missedHeights.includes(nextStartHeight)) {
          const taskPromise = this.assignWorker(nextStartHeight);
          activeTasks.push(taskPromise);
        }
      }
    }

    // Process missed heights
    // IMPORTANT: After assign workers for new heights
    await this._mutex.runExclusive(async () => {
      while (this._missedHeights.length > 0) {
        // We take the oldest height
        const height = this._missedHeights.shift();

        if (height) {
          this.log.debug('Re-attempting missed height.', { height }, this.constructor.name);
          const taskPromise = this.assignWorker(height);
          activeTasks.push(taskPromise);
        }
      }
    });

    await Promise.allSettled(activeTasks);

    await this.enqueueBatches();
  }

  /**
   * Assigns a worker to load a batch of blocks starting from a specific height.
   * @param startHeight - The starting height for the batch.
   * @returns A promise that resolves when the worker has completed its task.
   */
  @RuntimeTracker({ showMemory: true, warningThresholdMs: 100, errorThresholdMs: 3000 })
  private async assignWorker(startHeight: number): Promise<void> {
    try {
      const heights: number[] = [];

      for (let i = 0; i < this._batchLength; i++) {
        heights.push(startHeight + i);
      }

      const blocksBatch: Block[] = await this.networkProvider.getManyBlocksByHeights(heights, 2);

      // Use mutex to synchronize access to _loadedBlocks
      await this._mutex.runExclusive(async () => {
        this._loadedBlocks.push(...blocksBatch);
      });
    } catch (error) {
      await this._mutex.runExclusive(async () => {
        this.log.debug('AssignWorker encountered an error.', { error, startHeight }, this.constructor.name);

        // Check the number of missing heights
        if (this._missedHeights.length >= 100) {
          this._missedHeights = [];
          throw new Error('Missed heights exceed 100. Clearing missed heights.');
        }

        if (!this._missedHeights.includes(startHeight)) {
          this._missedHeights.push(startHeight);
        }
      });
    }
  }

  /**
   * Enqueues loaded blocks into the queue in the correct order.
   * @returns A promise that resolves when all eligible blocks have been enqueued.
   */
  private async enqueueBatches(): Promise<void> {
    // Sort blocks by height in descending order
    this._loadedBlocks.sort((a, b) => {
      if (a.height < b.height) return 1;
      if (a.height > b.height) return -1;
      return 0;
    });

    while (this._loadedBlocks.length > 0) {
      // Extract the last block from the array
      const block = this._loadedBlocks.pop();

      if (block) {
        if (block.height <= this.queue.lastHeight) {
          this.log.debug('Skipping block with height less than or equal to lastHeight', {
            blockHeight: block.height,
            lastHeight: this.queue.lastHeight,
          });
          continue;
        }

        // Attempt to enqueue the block
        if (!this.queue.enqueue(block)) {
          // If unable to enqueue, return the block back to the array
          this._loadedBlocks.push(block);
          this.log.debug(
            'Could not enqueue block. Returning block back to loadedBlocks.',
            { blockHeight: block.height },
            this.constructor.name
          );
          // Exit the loop since subsequent blocks have lower heights
          break;
        }
      }
    }
  }
}
