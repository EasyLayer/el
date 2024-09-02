// import { v4 as uuidv4 } from 'uuid';
import { CommandHandler, ICommandHandler } from '@el/components/cqrs';
import { Transactional, EventStoreRepository } from '@el/components/eventstore';
import { HandleBatchCommand } from '@el/common/domain-cqrs-components/bitcoin-listener';
import { AppLogger, RuntimeTracker } from '@el/components/logger';
import { NetworkProviderService } from '@el/components/bitcoin-network-provider';
import { Listener } from '../models/listener.model';
import { ListenerModelFactoryService } from '../services';

@CommandHandler(HandleBatchCommand)
export class HandleBatchCommandHandler implements ICommandHandler<HandleBatchCommand> {
  constructor(
    private readonly log: AppLogger,
    private readonly listenerModelFactory: ListenerModelFactoryService,
    private readonly networkProviderService: NetworkProviderService,
    private readonly eventStore: EventStoreRepository
  ) {}

  @Transactional({ connectionName: 'listener-eventstore' })
  @RuntimeTracker({ showMemory: true })
  async execute({ payload }: HandleBatchCommand) {
    try {
      const { batch, requestId } = payload;

      const listenerModel: Listener = await this.listenerModelFactory.initModel();

      await listenerModel.addBlocks({
        requestId,
        blocks: batch,
        service: this.networkProviderService,
        logger: this.log,
      });

      await this.eventStore.save(listenerModel);

      this.listenerModelFactory.updateCache(listenerModel);

      await listenerModel.commit();
    } catch (error) {
      this.log.error('execute()', error, this.constructor.name);
      this.listenerModelFactory.clearCache();
      throw error;
    }
  }
}
