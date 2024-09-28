import { Inject } from '@nestjs/common';
import { EventsHandler, IEventHandler } from '@easylayer/components/cqrs';
import { AppLogger, RuntimeTracker } from '@easylayer/components/logger';
import { BlocksQueueService } from '@easylayer/components/bitcoin-blocks-queue';
import { Transactional, QueryFailedError } from '@easylayer/components/views-rdbms-db';
import { BitcoinLoaderBlocksIndexedEvent } from '@easylayer/common/domain-cqrs-components/bitcoin-loader';
import { ViewsWriteRepositoryService } from '../../infrastructure-layer/services';
import { ILoaderMapper } from '../../protocol';
import { System } from '../../infrastructure-layer/view-models';

@EventsHandler(BitcoinLoaderBlocksIndexedEvent)
export class BitcoinLoaderBlocksIndexedEventHandler implements IEventHandler<BitcoinLoaderBlocksIndexedEvent> {
  constructor(
    private readonly log: AppLogger,
    private readonly viewsWriteRepository: ViewsWriteRepositoryService,
    @Inject('BlocksQueueService')
    private readonly blocksQueueService: BlocksQueueService,
    @Inject('LoaderMapper')
    private readonly loaderMapper: ILoaderMapper
  ) {}

  @Transactional({ connectionName: 'loader-views' })
  @RuntimeTracker({ showMemory: false, warningThresholdMs: 10, errorThresholdMs: 1000 })
  async handle({ payload }: BitcoinLoaderBlocksIndexedEvent) {
    try {
      // console.timeEnd('CqrsTransportTime');
      const { blocks } = payload;

      const confirmedBlocks = await this.blocksQueueService.confirmProcessedBatch(
        blocks.map((block: any) => block.hash)
      );

      console.time('onLoad');
      for (const block of confirmedBlocks) {
        const results = await this.loaderMapper.onLoad(block);
        const models = Array.isArray(results) ? results : [results];

        this.viewsWriteRepository.process(models);
      }
      console.timeEnd('onLoad');
      // Update System entity
      const lastBlockHeight: number = confirmedBlocks[confirmedBlocks.length - 1]?.height;
      await this.viewsWriteRepository.update('system', {
        values: new System({ last_block_height: lastBlockHeight }),
      });

      await this.viewsWriteRepository.commit();

      this.log.info(
        'Blocks successfull loaded',
        {
          blocksHeight: lastBlockHeight,
          blocksLength: confirmedBlocks.length,
          txLength: confirmedBlocks.reduce((result: number, item: any) => result + item.tx.length, 0),
        },
        this.constructor.name
      );
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
