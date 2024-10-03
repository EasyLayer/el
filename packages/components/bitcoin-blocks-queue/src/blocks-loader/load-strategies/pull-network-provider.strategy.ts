import { NetworkProviderService } from '@easylayer/components/bitcoin-network-provider';
import { AppLogger, RuntimeTracker } from '@easylayer/components/logger';
import { BlocksLoadingStrategy, StrategyNames } from './load-strategy.interface';
import { Block } from '../../interfaces';
import { BlocksQueue } from '../../blocks-queue';

export class PullNetworkProviderStrategy implements BlocksLoadingStrategy {
  readonly name: StrategyNames = StrategyNames.PULL_NETWORL_PROVIDER;
  private _maxRequestBlocksBatchSize: number = 10 * 1024 * 1024; // Batch size in bytes
  private _hashes: string[] = [];
  private isTest: boolean = false;

  /**
   * Creates an instance of PullNetworkProviderStrategy.
   * @param log - The application logger.
   * @param networkProvider - The network provider service.
   * @param queue - The blocks queue.
   * @param config - Configuration object containing maxRequestBlocksBatchSize.
   */
  constructor(
    private readonly log: AppLogger,
    private readonly networkProvider: NetworkProviderService,
    private readonly queue: BlocksQueue<Block>,
    config: {
      maxRequestBlocksBatchSize: number;
      isTest: boolean;
    }
  ) {
    this._maxRequestBlocksBatchSize = config.maxRequestBlocksBatchSize;
    this.isTest = config.isTest;
  }

  /**
   * Loads blocks up to the current network height.
   * @param currentNetworkHeight - The current height of the network.
   * @throws Will throw an error if the maximum block height or current network height is reached,
   *         or if the queue is full.
   */
  public async load(currentNetworkHeight: number): Promise<void> {
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

    if (this._hashes.length === 0) {
      await this.preloadHashes(currentNetworkHeight);
    }

    if (this._hashes.length > 0) {
      await this.loadAndEnqueueBlocks();
    }
  }

  /**
   * Stops the loading process by clearing the hashes.
   */
  public async stop(): Promise<void> {
    this._hashes = [];
  }

  @RuntimeTracker({ showMemory: false, warningThresholdMs: 800, errorThresholdMs: 10000 })
  /**
   * Loads and enqueues blocks into the queue.
   * Retries fetching blocks up to a maximum number of retries in case of failures.
   * @throws Will throw an error if fetching blocks fails after maximum retries.
   */
  private async loadAndEnqueueBlocks(): Promise<void> {
    const blocks: Block[] = await this.retryFetchBlocks(this._hashes, 3);

    for (const block of blocks) {
      await this.queue.enqueue(block);
    }

    this.log.debug('Blocks enqueued to queue', { blocksLength: blocks.length }, this.constructor.name);

    this._hashes = [];
  }

  @RuntimeTracker({ showMemory: false, warningThresholdMs: 800, errorThresholdMs: 10000 })
  /**
   * Preloads block hashes up to the maximum batch size or the current network height.
   * @param currentNetworkHeight - The current height of the network.
   */
  private async preloadHashes(currentNetworkHeight: number): Promise<void> {
    let lastHeight: number = this.queue.lastHeight;
    let lastSize: number = 0;
    let lastCount: number = 0;
    const maxSize = this.isTest ? 1 : 1000; // Keep this value as is
    const maxRequestBlocksBatchSize = this._maxRequestBlocksBatchSize;
    // Load as many blocks as possible until reaching the size limit or the current network height
    while (lastCount <= maxSize && lastSize <= maxRequestBlocksBatchSize && lastHeight <= currentNetworkHeight) {
      const heights: number[] = [];
      const batchSize = this.isTest ? 1 : 100; // Keep it here; we don't want to fetch more than 100 at a time

      for (let i = 0; i < batchSize; i++) {
        heights.push(lastHeight + 1 + i);
      }

      const blocksStats = await this.networkProvider.getManyBlocksStatsByHeights(heights);

      for (const { blockhash, total_size, height } of blocksStats) {
        // if (!blockhash || !total_size || !height) {
        //   throw new Error('Block stats params is missed');
        // }

        this._hashes.push(blockhash);
        lastSize += Number(total_size);
        lastHeight = Number(height);
        lastCount += 1;

        if (lastCount >= maxSize) {
          break;
        }

        if (lastHeight >= currentNetworkHeight) {
          break;
        }

        if (lastSize + total_size >= Number(maxRequestBlocksBatchSize)) {
          break; // Reached the maximum request size
        }
      }
    }
  }

  /**
   * Fetches blocks in batches with retry logic.
   * @param batch - Array of block hashes.
   * @param maxRetries - Maximum number of retry attempts.
   * @returns Array of fetched blocks.
   * @throws Will throw an error if fetching blocks fails after maximum retries.
   */
  private async retryFetchBlocks(batch: string[], maxRetries: number): Promise<Block[]> {
    let attempt = 0;
    while (attempt < maxRetries) {
      try {
        const blocks: Block[] = await this.networkProvider.getManyBlocksByHashes(batch, 2); // verbosity=2
        return blocks;
      } catch (error) {
        attempt++;
        if (attempt >= maxRetries) {
          this.log.warn(
            'Exceeded max retries for fetching blocks batch.',
            { batchLength: batch.length },
            this.constructor.name
          );
          throw error;
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
    throw new Error('Failed to fetch blocks batch after maximum retries.');
  }
}
