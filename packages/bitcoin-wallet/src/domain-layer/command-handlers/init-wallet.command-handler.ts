import { CommandHandler, ICommandHandler } from '@el/components/cqrs';
import { Transactional, EventStoreRepository } from '@el/components/eventstore';
import { InitWalletCommand } from '@el/common/domain-cqrs-components/bitcoin-wallet';
import { AppLogger, RuntimeTracker } from '@el/components/logger';
import { Wallet } from '../models/wallet.model';
import { WalletModelFactoryService } from '../services';

@CommandHandler(InitWalletCommand)
export class InitWalletCommandHandler implements ICommandHandler<InitWalletCommand> {
  constructor(
    private readonly log: AppLogger,
    private readonly eventStore: EventStoreRepository,
    private readonly walletModelFactory: WalletModelFactoryService
  ) {}

  @Transactional({ connectionName: 'wallet-eventstore' })
  @RuntimeTracker({ showMemory: true })
  async execute({ payload }: InitWalletCommand) {
    try {
      const { requestId } = payload;

      const walletModel: Wallet = await this.walletModelFactory.initModel();

      this.log.info('Wallet Aggregate successfully initialized.', null, this.constructor.name);

      await walletModel.init({ requestId });

      await this.eventStore.save(walletModel);
      await walletModel.commit();

      this.log.info('Aggregates successfull init', null, this.constructor.name);
    } catch (error) {
      this.log.error('execute()', error, this.constructor.name);
      throw error;
    }
  }
}
