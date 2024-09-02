import { Inject } from '@nestjs/common';
import { EventsHandler, IEventHandler } from '@el/components/cqrs';
import { RuntimeTracker } from '@el/components/logger';
import { BlocksQueueService } from '@el/components/bitcoin-blocks-queue';
import { Transactional, QueryFailedError } from '@el/components/views-rdbms-db';
import { BitcoinLoaderBlocksIndexedEvent } from '@el/common/domain-cqrs-components/bitcoin-loader';
import { ViewsWriteRepositoryService } from '../../infrastructure-layer/services';
import { ILoaderMapper } from '../../protocol';
import { System } from '../../infrastructure-layer/view-models';

@EventsHandler(BitcoinLoaderBlocksIndexedEvent)
export class BitcoinLoaderBlocksIndexedEventHandler implements IEventHandler<BitcoinLoaderBlocksIndexedEvent> {
  constructor(
    private readonly viewsWriteRepository: ViewsWriteRepositoryService,
    @Inject('BlocksQueueService')
    private readonly blocksQueueService: BlocksQueueService,
    @Inject('LoaderMapper')
    private readonly loaderMapper: ILoaderMapper
  ) {}

  @Transactional({ connectionName: 'loader-views' })
  @RuntimeTracker({ showMemory: true })
  async handle({ payload }: BitcoinLoaderBlocksIndexedEvent) {
    try {
      const { blocks } = payload;

      const confirmedBlocks = await this.blocksQueueService.confirmIndexBatch(blocks.map((block: any) => block.hash));

      for (const block of confirmedBlocks) {
        const results = await this.loaderMapper.load(block);
        const models = Array.isArray(results) ? results : [results];

        this.viewsWriteRepository.process(models);
      }

      // Update System entity
      const lastBlockHeight: number = confirmedBlocks[confirmedBlocks.length - 1]?.height;
      await this.viewsWriteRepository.update('System', {
        values: new System({ last_block_height: lastBlockHeight }),
        conditions: { id: 1 },
      });

      await this.viewsWriteRepository.commit();
    } catch (error) {
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
