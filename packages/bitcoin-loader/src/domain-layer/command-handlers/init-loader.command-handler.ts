import { CommandHandler, ICommandHandler } from '@easylayer/components/cqrs';
import { Transactional, EventStoreRepository } from '@easylayer/components/eventstore';
import { InitLoaderCommand } from '@easylayer/common/domain-cqrs-components/bitcoin-loader';
import { AppLogger, RuntimeTracker } from '@easylayer/components/logger';
import { Loader } from '../models/loader.model';
import { LoaderModelFactoryService } from '../services';

@CommandHandler(InitLoaderCommand)
export class InitLoaderCommandHandler implements ICommandHandler<InitLoaderCommand> {
  constructor(
    private readonly log: AppLogger,
    private readonly eventStore: EventStoreRepository,
    private readonly loaderModelFactory: LoaderModelFactoryService
  ) {}

  @Transactional({ connectionName: 'loader-eventstore' })
  @RuntimeTracker({ showMemory: true })
  async execute({ payload }: InitLoaderCommand) {
    try {
      const { requestId, startHeight, lastReadStateHeight } = payload;

      const restoreBlocks: string[] = [];

      this.log.info('Init Loader Aggregate...', null, this.constructor.name);

      const loaderModel: Loader = await this.loaderModelFactory.initModel();

      this.log.info('Loader Aggregate successfully initialized.', null, this.constructor.name);

      if (loaderModel.status === 'awaiting' && loaderModel.chain.lastBlockHeight !== lastReadStateHeight) {
        const restoreBlocksCount = loaderModel.chain.lastBlockHeight - lastReadStateHeight;

        this.log.info(
          'Synchronization of blocks between write and read states starting...',
          { restoreBlocksCount },
          this.constructor.name
        );

        // NOTE: We want to restore events one block more than the difference between write and read state.
        const blocks = loaderModel.chain.getLastNBlocks(restoreBlocksCount + 1);

        this.log.info(
          'Synchronization of blocks between write and read states was finished',
          null,
          this.constructor.name
        );

        // For restore block in read state we publish indexer with blocks hashes
        blocks.forEach((item) => restoreBlocks.push(item.hash));
      }

      if (loaderModel.status === 'reorganisation') {
        this.log.info('Reorganisation of blocks was started...', null, this.constructor.name);
        // Publish last indexer event to process reorganisation
        await this.loaderModelFactory.publishLastEvent();

        this.log.info('Reorganisation of blocks was finished.', null, this.constructor.name);
      }

      await loaderModel.init({
        requestId,
        startHeight,
        restoreBlocks,
      });

      await this.eventStore.save(loaderModel);
      await loaderModel.commit();

      this.log.info('Aggregates successfull init', null, this.constructor.name);
    } catch (error) {
      this.log.error('execute()', error, this.constructor.name);
      throw error;
    }
  }
}
