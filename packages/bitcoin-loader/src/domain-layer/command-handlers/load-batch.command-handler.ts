// import { v4 as uuidv4 } from 'uuid';
import { CommandHandler, ICommandHandler } from '@el/components/cqrs';
import { Transactional, EventStoreRepository } from '@el/components/eventstore';
import { LoadBatchCommand } from '@el/common/domain-cqrs-components/bitcoin-loader';
import { AppLogger, RuntimeTracker } from '@el/components/logger';
import { NetworkProviderService } from '@el/components/bitcoin-network-provider';
import { Loader } from '../models/loader.model';
import { LoaderModelFactoryService } from '../services';

@CommandHandler(LoadBatchCommand)
export class LoadBatchCommandHandler implements ICommandHandler<LoadBatchCommand> {
  constructor(
    private readonly log: AppLogger,
    private readonly loaderModelFactory: LoaderModelFactoryService,
    private readonly networkProviderService: NetworkProviderService,
    private readonly eventStore: EventStoreRepository
  ) {}

  @Transactional({ connectionName: 'loader-eventstore' })
  @RuntimeTracker({ showMemory: true })
  async execute({ payload }: LoadBatchCommand) {
    try {
      const { batch, requestId } = payload;

      const loaderModel: Loader = await this.loaderModelFactory.initModel();

      await loaderModel.addBlocks({
        requestId,
        blocks: batch,
        service: this.networkProviderService,
        logger: this.log,
      });

      await this.eventStore.save(loaderModel);

      this.loaderModelFactory.updateCache(loaderModel);

      await loaderModel.commit();
    } catch (error) {
      this.log.error('execute()', error, this.constructor.name);
      this.loaderModelFactory.clearCache();
      throw error;
    }
  }
}
