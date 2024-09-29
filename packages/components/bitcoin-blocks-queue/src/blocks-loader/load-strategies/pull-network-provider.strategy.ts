import { Mutex } from 'async-mutex';
import { NetworkProviderService } from '@easylayer/components/bitcoin-network-provider';
import { AppLogger, RuntimeTracker } from '@easylayer/components/logger';
import { BlocksLoadingStrategy, StrategyNames } from './load-strategy.interface';
import { Block } from '../../interfaces';
import { BlocksQueue } from '../../blocks-queue';

export class PullNetworkProviderStrategy implements BlocksLoadingStrategy {
  readonly name: StrategyNames = StrategyNames.PULL_NETWORL_PROVIDER;
  private _batchLength!: number;
  private _concurrency!: number;
  private _missedHeights: number[] = [];
  private _loadedBlocks: Block[] = [];
  private _isLoading: boolean = false;
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

  public async load(currentNetworkHeight: number): Promise<void> {
    if (this._isLoading) {
      return;
    }

    this._isLoading = true;
    this._missedHeights = [];
    this._loadedBlocks = [];

    while (this._isLoading) {
      if (this.queue.isMaxHeightReached) {
        throw new Error(`Reached max block height, ${this.queue.lastHeight}`);
      }

      // Check if we have reached the current network height
      if (this.queue.lastHeight >= currentNetworkHeight) {
        throw new Error(`Reached current network height, ${this.queue.lastHeight}`);
      }

      // Check if the queue is full
      if (this.queue.isQueueFull) {
        throw new Error(`Queue is full, ${this.queue.lastHeight}`);
      }

      await this.loadAndEnqueueBlocks(currentNetworkHeight);
    }
  }

  public async stop(): Promise<void> {
    this._isLoading = false;
    this._missedHeights = [];
    this._loadedBlocks = [];
  }

  @RuntimeTracker({ showMemory: false, warningThresholdMs: 800, errorThresholdMs: 10000 })
  private async loadAndEnqueueBlocks(currentNetworkHeight: number): Promise<void> {
    const activeTasks: Promise<void>[] = [];

    // Process missed heights at first
    while (this._missedHeights.length > 0) {
      // We take the oldest height
      const height = this._missedHeights.shift();

      if (height) {
        this.log.debug('Re-attempting missed height.', { height }, this.constructor.name);
        const taskPromise = this.assignWorker(height, this._batchLength);
        activeTasks.push(taskPromise);
      }
    }

    // Only if the activeTasks is empty after missed heights have been processed, then we can move on to new ones
    if (activeTasks.length === 0) {
      for (let i = 0; i < this._concurrency; i++) {
        const nextStartHeight = this.queue.lastHeight + 1 + i * this._batchLength;

        if (currentNetworkHeight >= nextStartHeight) {
          if (!this._missedHeights.includes(nextStartHeight)) {
            const taskPromise = this.assignWorker(nextStartHeight, this._batchLength);
            activeTasks.push(taskPromise);
          }
        }
      }
    }

    await Promise.all(activeTasks);

    // Only after all requests have been processed, we try to insert blocks into the queue.
    if (this._loadedBlocks.length > 0) {
      await this.enqueueBlocks();
    }
  }

  private async assignWorker(startHeight: number, length: number): Promise<void> {
    try {
      const heights: number[] = [];

      for (let i = 0; i < length; i++) {
        heights.push(startHeight + i);
      }

      const blocksBatch: Block[] = await this.networkProvider.getManyBlocksByHeights(heights, 2);

      // Use mutex to synchronize access to _loadedBlocks
      await this._mutex.runExclusive(async () => {
        this._loadedBlocks.push(...blocksBatch);
      });
    } catch (error) {
      this.log.debug(
        'Fetch blocks error, save missed heights',
        { error, missedHeight: startHeight, missedHeightsLength: this._missedHeights.length },
        this.constructor.name
      );

      await this._mutex.runExclusive(async () => {
        if (!this._missedHeights.includes(startHeight)) {
          this._missedHeights.push(startHeight);
        }
      });
    }
  }

  private async enqueueBlocks(): Promise<void> {
    // Sort blocks by height in descending order
    this._loadedBlocks.sort((a, b) => {
      if (a.height < b.height) return 1;
      if (a.height > b.height) return -1;
      return 0;
    });

    // fix the current length of the array with blocks
    const initialLength = this._loadedBlocks.length;

    for (let i = 0; i < initialLength; i++) {
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

        try {
          await this.queue.enqueue(block);
        } catch (error) {
          this._loadedBlocks.push(block);
          this.log.debug(
            'Could not enqueue block. Returning block back to loadedBlocks.',
            error,
            this.constructor.name
          );
          // We exit the loop, because if the first block didn't pass,
          // then the rest definitely won't pass
          break;
        }
      }
    }

    this.log.debug(
      'Blocks enqueued to queue',
      { blocksLength: initialLength - this._loadedBlocks.length },
      this.constructor.name
    );
  }
}
