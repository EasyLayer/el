import { Inject } from '@nestjs/common';
import { EventsHandler, IEventHandler } from '@el/components/cqrs';
import { RuntimeTracker } from '@el/components/logger';
import { Transactional, QueryFailedError } from '@el/components/views-rdbms-db';
import { BlocksQueueService } from '@el/components/bitcoin-blocks-queue';
import { NetworkProviderService } from '@el/components/bitcoin-network-provider';
import { BitcoinLoaderInitializedEvent } from '@el/common/domain-cqrs-components/bitcoin-loader';
// import { BlocksReadService, TransactionsReadService } from '../services';

@EventsHandler(BitcoinLoaderInitializedEvent)
export class BitcoinLoaderInitializedEventHandler implements IEventHandler<BitcoinLoaderInitializedEvent> {
  constructor(
    // private readonly blocksReadService: BlocksReadService,
    // private readonly transactionsReadService: TransactionsReadService,
    private readonly networkProviderService: NetworkProviderService,
    @Inject('BlocksQueueService') private readonly blocksQueueService: BlocksQueueService
  ) {}

  @Transactional({ connectionName: 'loader-views' })
  @RuntimeTracker({ showMemory: true })
  async handle({ payload }: BitcoinLoaderInitializedEvent) {
    try {
      const { restoreBlocks, indexedHeight } = payload;

      const processedBlocks: any[] = [];
      const processedTx = new Map<string, any[]>();

      for (const hash of restoreBlocks) {
        // Fetch block with tx from provider
        const block = await this.networkProviderService.getOneBlockByHash(hash, 2);

        const { tx, ...blockWithoutTx } = block;

        if (!tx || tx.length === 0) {
          throw new Error(`Tx length = 0`);
        }

        tx.forEach((t: any) => {
          if (!processedTx.has(hash)) {
            processedTx.set(hash, []);
          }

          processedTx.get(hash)!.push(t);
        });

        processedBlocks.push(blockWithoutTx);
      }

      // if (processedBlocks.length > 0) {
      //   await this.blocksReadService.createMany(processedBlocks);

      //   if (processedTx.size > 0) {
      //     await this.transactionsReadService.createMany(processedTx);
      //   }
      // }

      // IMPORTANT: We will only start loading to the blocks queue after the restoration of the Read State
      // TODO: move it from here
      this.blocksQueueService.start(indexedHeight);
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
