import { CommandHandler, ICommandHandler } from '@el/components/cqrs';
import { Transactional, EventStoreRepository } from '@el/components/eventstore';
import { ProcessReorganisationCommand } from '@el/common/domain-cqrs-components/bitcoin-loader';
import { AppLogger, RuntimeTracker } from '@el/components/logger';
import { Loader } from '../models/loader.model';
import { LoaderModelFactoryService } from '../services';

@CommandHandler(ProcessReorganisationCommand)
export class ProcessReorganisationCommandHandler implements ICommandHandler<ProcessReorganisationCommand> {
  constructor(
    private readonly log: AppLogger,
    private readonly loaderModelFactory: LoaderModelFactoryService,
    private readonly eventStore: EventStoreRepository
  ) {}

  @Transactional({ connectionName: 'loader-eventstore' })
  @RuntimeTracker({ showMemory: true })
  async execute({ payload }: ProcessReorganisationCommand) {
    try {
      // NOTE: blocks - need to be reorganised (from IndexerModel),
      // height - is height of reorganisation(the last height where the blocks matched)
      const { blocks, height, requestId } = payload;

      const loaderModel: Loader = await this.loaderModelFactory.initModel();

      // NOTE: We could not store transactions in the aggregator, but get them here from the provider,
      // but this will increase the cost, so we store them for now

      await loaderModel.processReorganisation({
        blocks,
        height,
        requestId,
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
