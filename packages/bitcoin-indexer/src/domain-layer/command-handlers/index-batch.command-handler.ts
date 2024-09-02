import { CommandHandler, ICommandHandler } from '@el/components/cqrs';
import { Transactional, EventStoreRepository } from '@el/components/eventstore';
import { NetworkProviderService } from '@el/components/bitcoin-network-provider';
import { IndexBatchCommand } from '@el/common/domain-cqrs-components/bitcoin-indexer';
import { AppLogger, RuntimeTracker } from '@el/components/logger';
import { Indexer } from '../models/indexer.model';
import { IndexerModelFactoryService } from '../services';

@CommandHandler(IndexBatchCommand)
export class IndexBatchCommandHandler implements ICommandHandler<IndexBatchCommand> {
  constructor(
    private readonly log: AppLogger,
    private readonly indexerModelFactory: IndexerModelFactoryService,
    private readonly networkProviderService: NetworkProviderService,
    private readonly eventStore: EventStoreRepository
  ) {}

  @Transactional({ connectionName: 'indexer-eventstore' })
  @RuntimeTracker({ showMemory: true })
  async execute({ payload }: IndexBatchCommand) {
    try {
      const { batch, requestId } = payload;

      const indexerModel: Indexer = await this.indexerModelFactory.initModel();

      await indexerModel.addBlocks({
        requestId,
        blocks: batch,
        service: this.networkProviderService,
        logger: this.log,
      });

      await this.eventStore.save(indexerModel);

      this.indexerModelFactory.updateCache(indexerModel);

      await indexerModel.commit();
    } catch (error) {
      this.log.error('execute()', error, this.constructor.name);
      this.indexerModelFactory.clearCache();
      throw error;
    }
  }
}
