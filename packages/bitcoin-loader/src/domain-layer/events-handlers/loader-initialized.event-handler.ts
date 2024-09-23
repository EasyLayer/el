import { Inject } from '@nestjs/common';
import { EventsHandler, IEventHandler } from '@easylayer/components/cqrs';
import { AppLogger, RuntimeTracker } from '@easylayer/components/logger';
import { Transactional, QueryFailedError } from '@easylayer/components/views-rdbms-db';
import { BlocksQueueService } from '@easylayer/components/bitcoin-blocks-queue';
import { NetworkProviderService } from '@easylayer/components/bitcoin-network-provider';
import { BitcoinLoaderInitializedEvent } from '@easylayer/common/domain-cqrs-components/bitcoin-loader';
import { ViewsWriteRepositoryService } from '../../infrastructure-layer/services';
import { ILoaderMapper } from '../../protocol';
import { System } from '../../infrastructure-layer/view-models';
import { BlocksQueueConfig } from '../../config';

@EventsHandler(BitcoinLoaderInitializedEvent)
export class BitcoinLoaderInitializedEventHandler implements IEventHandler<BitcoinLoaderInitializedEvent> {
  constructor(
    private readonly log: AppLogger,
    private readonly viewsWriteRepository: ViewsWriteRepositoryService,
    private readonly networkProviderService: NetworkProviderService,
    private readonly blocksQueueConfig: BlocksQueueConfig,
    @Inject('BlocksQueueService') private readonly blocksQueueService: BlocksQueueService,
    @Inject('LoaderMapper') private readonly loaderMapper: ILoaderMapper
  ) {}

  @Transactional({ connectionName: 'loader-views' })
  @RuntimeTracker({ showMemory: false })
  async handle({ payload }: BitcoinLoaderInitializedEvent) {
    try {
      const { restoreBlocks, indexedHeight } = payload;

      if (Array.isArray(restoreBlocks) && restoreBlocks.length > 0) {
        this.log.info(`Start restoring blocks...`, { length: restoreBlocks.length }, this.constructor.name);

        // Fetch blocks from provider
        const blocks = await this.loadBlocks(restoreBlocks);

        for (const block of blocks) {
          const results = await this.loaderMapper.onLoad(block);
          const models = Array.isArray(results) ? results : [results];

          this.viewsWriteRepository.process(models);
        }

        // Update System entity
        const lastBlockHeight: number = blocks[blocks.length - 1]?.height;
        await this.viewsWriteRepository.update('system', {
          values: new System({ last_block_height: lastBlockHeight }),
        });

        await this.viewsWriteRepository.commit();

        this.log.info(
          'Synchronization of blocks between write and read states was finished',
          null,
          this.constructor.name
        );
      }

      // IMPORTANT: We will only start loading to the blocks queue after the restoration of the Read State
      // TODO: move it from here
      this.blocksQueueService.start(indexedHeight);
    } catch (error) {
      this.viewsWriteRepository.clearOperations();

      if (error instanceof QueryFailedError) {
        const driverError = error.driverError;
        if (driverError.code === 'SQLITE_CONSTRAINT') {
          throw new Error(driverError.message);
        }
        if (driverError.code === '23505') {
          throw new Error(driverError.detail);
        }
      }

      throw error;
    }
  }

  /**
   * Loads blocks in batches, processing each batch sequentially.
   * Retries indefinitely on failure with a delay between attempts.
   * @param hashes Array of block hashes to load
   */
  private async loadBlocks(hashes: string[]): Promise<any> {
    const batchSize = this.blocksQueueConfig.BITCOIN_LOADER_BLOCKS_QUEUE_LOADER_BLOCKS_BATCH_LENGTH;
    const MAX_RETRIES = 5;
    const RETRY_DELAY_MS = 5000;

    const blocks: any[] = [];

    const chunks = this.splitIntoChunks(hashes, batchSize);

    for (const [index, chunk] of chunks.entries()) {
      let attempt = 0;
      let success = false;

      while (!success && attempt < MAX_RETRIES) {
        try {
          const batch = await this.networkProviderService.getManyBlocksByHashes(chunk, 2);

          blocks.push(...batch);

          success = true;
        } catch (error) {
          attempt++;

          this.log.error(`Error processing chunk ${index + 1}`, error, this.constructor.name);

          if (attempt >= MAX_RETRIES) {
            throw new Error(`Failed to load blocks for chunk ${index + 1} after ${MAX_RETRIES} attempts.`);
          }

          this.log.info(
            `Retrying to download chunk ${index + 1} in ${RETRY_DELAY_MS / 1000} seconds...`,
            {},
            this.constructor.name
          );
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
        }
      }
    }

    return blocks;
  }

  /**
   * Splits an array into smaller chunks of a specified size.
   * @param array The array to split
   * @param size The size of each chunk
   * @returns An array of chunks
   */
  private splitIntoChunks<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}
