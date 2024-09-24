import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { AppLogger } from '@easylayer/components/logger';
import { NetworkProviderService, WebhookStreamService } from '@easylayer/components/bitcoin-network-provider';
import { exponentialIntervalAsync } from '@easylayer/common/exponential-interval-async';
import { BlocksQueue } from '../blocks-queue';
import { Block } from '../interfaces';
import {
  WebhookStreamStrategy,
  PullNetworkProviderStrategy,
  BlocksLoadingStrategy,
  StrategyNames,
} from './load-strategies';

@Injectable()
export class BlocksQueueLoaderService implements OnModuleDestroy {
  private _queue!: BlocksQueue<Block>;
  private _isLoading: boolean = false;
  private _loadingStrategy: BlocksLoadingStrategy | null = null;
  private _currentNetworkHeight: number = -1;
  private _isTransportMode: boolean;

  constructor(
    private readonly log: AppLogger,
    private readonly networkProviderService: NetworkProviderService,
    private readonly webhookStreamService: WebhookStreamService,
    private readonly config: any
  ) {
    this._isTransportMode = this.config.isTransportMode;
  }

  get isLoading(): boolean {
    return this._isLoading;
  }

  async onModuleDestroy() {
    this.destroyStrategy();
    this._isLoading = false;
  }

  public async startBlocksLoading(queue: BlocksQueue<Block>): Promise<void> {
    this.log.info('Setup blocks loading from height', { indexedHeight: queue.lastHeight }, this.constructor.name);

    // NOTE: We use this to make sure that
    // method startQueueIterating() is executed only once in its entire life.
    if (this._isLoading) {
      return;
    }

    this._isLoading = true;

    // TODO: think where put this
    this._queue = queue;

    await exponentialIntervalAsync(
      async (resetInterval) => {
        if (this._queue.lastHeight >= this._queue.maxBlockHeight) {
          this.log.info('Reached max block height', { lastQueueHeight: this._queue.lastHeight }, this.constructor.name);
          return;
        }

        // Setup the strategy
        await this.setupStrategy();

        try {
          await this._loadingStrategy?.load(this._currentNetworkHeight);
        } catch (error) {
          this.log.error('Load blocks strategy error', error, this.constructor.name);

          resetInterval();

          // IMPORTANT: In case of an error, we are obliged to restart the strategy
          await this.destroyStrategy();
        }

        this.log.debug(
          'Load blocks waiting...',
          { queueHeight: this._queue.lastHeight, queueLegth: this._queue.length },
          this.constructor.name
        );
      },
      {
        interval: this.config.queueLoaderIntervalMs,
        maxInterval: this.config.queueLoaderMaxIntervalMs,
        multiplier: this.config.queueLoaderMaxIntervalMultiplier,
      }
    );
  }

  public async handleBlockFromStream(block: Block): Promise<void> {
    if (!this._queue.enqueue(block)) {
      // NOTE: For now, we will get here only from the strategy of streaming via webhooks,
      // in the future it will be possible to expand.
      if (this._loadingStrategy?.name === StrategyNames.WEBHOOK_STREAM) {
        await this._loadingStrategy.destroy();
      }
    }
  }

  private async setupStrategy(): Promise<void> {
    this.log.debug('Setup blocks loading strategy...', {}, this.constructor.name);
    // IMPORTANT: If a strategy is selected in which the .load() method completes immediately,
    // then this provider method will be called many times at first
    // (until the intervals become longer).
    // This is expected behavior.
    if (this._isTransportMode) {
      // this._currentNetworkHeight = await this.networkProviderService.getCurrentBlockHeight();
    } else {
      this._currentNetworkHeight = await this.networkProviderService.getCurrentBlockHeight();
    }

    if (this._loadingStrategy) {
      return;
    }

    this._loadingStrategy = this.createStrategy();
  }

  public async destroyStrategy() {
    await this._loadingStrategy?.destroy();
    this._loadingStrategy = null;
  }

  private createStrategy(): BlocksLoadingStrategy {
    const name = this.config.queueLoaderStrategyName;

    switch (name) {
      case StrategyNames.WEBHOOK_STREAM:
        return new WebhookStreamStrategy(this.webhookStreamService, this._queue);
      case StrategyNames.PULL_NETWORL_PROVIDER:
        return new PullNetworkProviderStrategy(this.log, this.networkProviderService, this._queue, {
          concurrency: this.config.queueLoaderConcurrencyNum,
          batchLength: this.config.queueLoaderBlocksBatchLength,
        });
      // case StrategyNames.PULL_BLOCKS_BY_NETWORK_TRANSPORT:
      //   return new PullNetworkProviderStrategy({}, this._queue, options);
      default:
        throw new Error(`Unknown strategy: ${name}`);
    }
  }
}
