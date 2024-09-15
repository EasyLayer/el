import { resolve } from 'node:path';
import { config } from 'dotenv';
import { bootstrap } from '@easylayer/bitcoin-loader';
import { BitcoinLoaderInitializedEvent } from '@easylayer/common/domain-cqrs-components/bitcoin-loader';
import { NetworkProviderService } from '@easylayer/components/bitcoin-network-provider';
import { SQLiteService } from '../+helpers/sqlite/sqlite.service';
import { cleanDataFolder } from '../+helpers/clean-data-folder';
import { BlockSchema } from './blocks';
import { BlocksMapper } from './mapper';
import { mockLoaderEvent } from './mocks/events';
import { mockBlocks } from './mocks/blocks';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
jest.spyOn(NetworkProviderService.prototype, 'getManyBlocksByHashes').mockImplementation(async (hashes, verbosity) => {
  return mockBlocks;
});

describe('/Bitcoin Loader: Synchronization of Read and Write Databases', () => {
  let dbService!: SQLiteService;

  afterAll(async () => {
    if (dbService) {
      try {
        await dbService.close();
      } catch (error) {
        console.error(error);
      }
    }
  });

  beforeAll(async () => {
    jest.useFakeTimers({ advanceTimers: true });

    // Clear the database
    await cleanDataFolder('data');

    // Load environment variables
    config({ path: resolve(process.cwd(), 'src/synchronization-read-write-db-flow/.env') });

    // We want to prepare a write database
    dbService = new SQLiteService({ path: resolve(process.cwd(), 'data/loader-eventstore.db') });
    await dbService.initializeDatabase(resolve(process.cwd(), 'src/+dumps/events-table.sql'));

    for (const event of mockLoaderEvent) {
      const { aggregateId, extra, version, requestId, type, payload } = event;

      const eventValues = [
        `'${aggregateId}'`,
        extra ? `'${extra}'` : 'NULL',
        version,
        requestId ? `'${requestId}'` : 'NULL',
        `'${type}'`,
        `'${payload}'`,
      ];

      const query = `INSERT INTO events (aggregateId, extra, version, requestId, type, payload) VALUES (${eventValues.join(
        ', ',
      )});`;

      await dbService.exec(query);
    }

    await dbService.close();

    await bootstrap({
      schemas: [BlockSchema],
      mapper: BlocksMapper,
      testing: {
        handlerEventsToWait: [
          {
            eventType: BitcoinLoaderInitializedEvent,
            count: 1,
          },
        ],
      },
    });
  });

  it('should save missed data into views db', async () => {
    dbService = new SQLiteService({ path: resolve(process.cwd(), 'data/loader-views.db') });
    await dbService.connect();

    const blocksWithTransactions = await dbService.all(`
      SELECT
        b.hash AS blockHash, 
        b.height AS blockHeight,
        b.previousblockhash AS previousBlockHash,
        b.is_suspended AS blockSuspended,
        b.tx AS blockTransactions
      FROM 
        blocks b
    `);

    // Check that the block data matches mockLoaderEvent
    mockLoaderEvent.forEach((event) => {
      const parsedPayload = JSON.parse(event.payload);
      if (parsedPayload.blocks) {
        parsedPayload.blocks.forEach((expectedBlock: any) => {
          const savedBlock = blocksWithTransactions.find((b: any) => b.blockHash === expectedBlock.hash);

          expect(savedBlock).toBeDefined();
          expect(savedBlock.blockHeight).toEqual(expectedBlock.height);
          if (expectedBlock.height !== 0) {
            expect(savedBlock.previousBlockHash).toEqual(expectedBlock.previousblockhash);
          }
          expect(savedBlock.blockSuspended).toBeFalsy();
          expect(JSON.parse(savedBlock.blockTransactions)).toEqual(expectedBlock.tx.map((tx: any) => tx.txid));
        });
      }
    });
  });

  it('should have the correct last block height in the system table', async () => {
    dbService = new SQLiteService({ path: resolve(process.cwd(), 'data/loader-views.db') });
    await dbService.connect();

    const systemRecords = await dbService.all(`
      SELECT 
        s.last_block_height AS lastBlockHeight
      FROM 
        system s
      WHERE 
        s.id = 1
    `);

    expect(systemRecords).toHaveLength(1);
    const systemRecord = systemRecords[0];

    const expectedLastBlockHeight = mockLoaderEvent[mockLoaderEvent.length - 1].payload
      ? JSON.parse(mockLoaderEvent[mockLoaderEvent.length - 1].payload).blocks.slice(-1)[0].height
      : -1;

    // Check that the height of the last block matches the expected one
    expect(systemRecord.lastBlockHeight).toEqual(expectedLastBlockHeight);
  });
});
