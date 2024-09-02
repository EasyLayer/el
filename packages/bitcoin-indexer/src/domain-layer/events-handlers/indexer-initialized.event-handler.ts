import { Inject } from '@nestjs/common';
import { EventsHandler, IEventHandler } from '@el/components/cqrs';
import { RuntimeTracker } from '@el/components/logger';
import { BlocksQueueService } from '@el/components/bitcoin-blocks-queue';
import { KeyManagementService, NetworkProviderService } from '@el/components/bitcoin-network-provider';
import { BitcoinIndexerInitializedEvent } from '@el/common/domain-cqrs-components/bitcoin-indexer';
import { BusinessConfig } from '../../config/business.config';

@EventsHandler(BitcoinIndexerInitializedEvent)
export class BitcoinIndexerInitializedEventHandler implements IEventHandler<BitcoinIndexerInitializedEvent> {
  constructor(
    private readonly businessConfig: BusinessConfig,
    private readonly keyManagementService: KeyManagementService,
    private readonly networkProviderService: NetworkProviderService,
    @Inject('BlocksQueueService') private readonly blocksQueueService: BlocksQueueService
  ) {}

  // @Transactional({ connectionName: 'balances-indexer-views' })
  @RuntimeTracker({ showMemory: true })
  async handle({ payload }: BitcoinIndexerInitializedEvent) {
    try {
      const { restoreBlocks, indexedHeight } = payload;
      console.log(restoreBlocks);
      // IMPORTANT: We will only start loading to the blocks queue after the restoration of the Read State
      // TODO: move it from here
      this.blocksQueueService.start(indexedHeight);
    } catch (error) {
      throw error;
    }
  }
}
