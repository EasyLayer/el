import { Inject } from '@nestjs/common';
import { EventsHandler, IEventHandler } from '@easylayer/components/cqrs';
import { RuntimeTracker } from '@easylayer/components/logger';
import { Transactional, QueryFailedError } from '@easylayer/components/views-rdbms-db';
import { BlocksQueueService } from '@easylayer/components/bitcoin-blocks-queue';
import { NetworkProviderService } from '@easylayer/components/bitcoin-network-provider';
import { BitcoinLoaderInitializedEvent } from '@easylayer/common/domain-cqrs-components/bitcoin-loader';
import { ViewsWriteRepositoryService } from '../../infrastructure-layer/services';
import { ILoaderMapper } from '../../protocol';
import { System } from '../../infrastructure-layer/view-models';

@EventsHandler(BitcoinLoaderInitializedEvent)
export class BitcoinLoaderInitializedEventHandler implements IEventHandler<BitcoinLoaderInitializedEvent> {
  constructor(
    private readonly viewsWriteRepository: ViewsWriteRepositoryService,
    private readonly networkProviderService: NetworkProviderService,
    @Inject('BlocksQueueService') private readonly blocksQueueService: BlocksQueueService,
    @Inject('LoaderMapper') private readonly loaderMapper: ILoaderMapper
  ) {}

  @Transactional({ connectionName: 'loader-views' })
  @RuntimeTracker({ showMemory: false })
  async handle({ payload }: BitcoinLoaderInitializedEvent) {
    try {
      const { restoreBlocks, indexedHeight } = payload;

      if (Array.isArray(restoreBlocks) && restoreBlocks.length > 0) {
        // Fetch blocks from provider
        const blocks = await this.networkProviderService.getManyBlocksByHashes(restoreBlocks, 2);

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
}
