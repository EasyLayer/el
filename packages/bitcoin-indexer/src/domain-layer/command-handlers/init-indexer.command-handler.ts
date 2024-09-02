import { CommandHandler, ICommandHandler } from '@el/components/cqrs';
import { Transactional, EventStoreRepository } from '@el/components/eventstore';
import { InitIndexerCommand } from '@el/common/domain-cqrs-components/bitcoin-indexer';
import { AppLogger, RuntimeTracker } from '@el/components/logger';
import { Indexer } from '../models/indexer.model';
import { IndexerModelFactoryService } from '../services';

@CommandHandler(InitIndexerCommand)
export class InitIndexerCommandHandler implements ICommandHandler<InitIndexerCommand> {
  constructor(
    private readonly log: AppLogger,
    private readonly eventStore: EventStoreRepository,
    private readonly indexerModelFactory: IndexerModelFactoryService
  ) {}

  @Transactional({ connectionName: 'indexer-eventstore' })
  @RuntimeTracker({ showMemory: true })
  async execute({ payload }: InitIndexerCommand) {
    try {
      const { requestId, lastReadStateHeight } = payload;

      const restoreBlocks: string[] = [];

      this.log.info('Init Indexer Aggregate...', null, this.constructor.name);

      const indexerModel: Indexer = await this.indexerModelFactory.initModel();

      this.log.info('Indexer Aggregate successfully initialized.', null, this.constructor.name);

      if (indexerModel.status === 'awaiting' && lastReadStateHeight !== undefined) {
        const restoreBlocksCount = indexerModel.chain.lastBlockHeight - lastReadStateHeight;

        this.log.info(
          'Synchronization of blocks between write and read states starting...',
          { restoreBlocksCount },
          this.constructor.name
        );

        // NOTE: We want to restore events one block more than the difference between write and read state.
        const blocks = indexerModel.chain.getLastNBlocks(restoreBlocksCount + 1);

        this.log.info(
          'Synchronization of blocks between write and read states was finished',
          null,
          this.constructor.name
        );

        // For restore block in read state we publish indexer with blocks hashes
        blocks.forEach((item) => restoreBlocks.push(item.hash));
      }

      if (indexerModel.status === 'reorganisation') {
        this.log.info('Reorganisation of blocks was started...', null, this.constructor.name);
        // Publish last indexer event to process reorganisation
        await this.indexerModelFactory.publishLastEvent();

        this.log.info('Reorganisation of blocks was finished.', null, this.constructor.name);
      }

      await indexerModel.init({
        requestId,
        restoreBlocks,
      });

      await this.eventStore.save(indexerModel);
      await indexerModel.commit();

      this.log.info('Aggregates successfull init', null, this.constructor.name);
    } catch (error) {
      this.log.error('execute()', error, this.constructor.name);
      throw error;
    }
  }
}
