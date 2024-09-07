import { EventsHandler, IEventHandler } from '@easylayer/components/cqrs';
import { RuntimeTracker } from '@easylayer/components/logger';
import { Transactional, QueryFailedError } from '@easylayer/components/views-rdbms-db';
import { BitcoinLoaderReorganisationProcessedEvent } from '@easylayer/common/domain-cqrs-components/bitcoin-loader';
// import { BlocksReadService } from '../services';

@EventsHandler(BitcoinLoaderReorganisationProcessedEvent)
export class BitcoinLoaderReorganisationProcessedEventHandler
  implements IEventHandler<BitcoinLoaderReorganisationProcessedEvent>
{
  // constructor(private readonly blocksReadService: BlocksReadService) {}

  @Transactional({ connectionName: 'loader-views' })
  @RuntimeTracker({ showMemory: true })
  async handle({ payload }: BitcoinLoaderReorganisationProcessedEvent) {
    try {
      const { blocks } = payload;

      const blocksHashes: string[] = [];
      const txids: string[] = [];

      blocks.forEach((block: any) => {
        const { tx, hash } = block;
        if (Array.isArray(tx)) {
          tx.forEach((t) => txids.push(t));
        }

        blocksHashes.push(hash);
      });

      // NOTE: At the moment we do not delete reorganized blocks, but flag its as suspended
      // await this.blocksReadService.updateWithBuilder({ hash: blocksHashes }, { is_suspended: true });
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
