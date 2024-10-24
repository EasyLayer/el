import { Module, DynamicModule } from '@nestjs/common';
import { transformAndValidate } from 'class-transformer-validator';
import { LoggerModule } from '@el/components/logger';
import { ArithmeticService } from '@el/common/arithmetic';
import { EventStoreModule } from '@el/components/eventstore';
import { CqrsModule } from '@el/components/cqrs';
import { CqrsTransportModule } from '@el/components/cqrs-transport';
import { ViewsKeyValueDatabaseModule } from '@el/components/views-keyvalue-db';
import { BlocksQueueModule } from '@el/components/bitcoin-blocks-queue';
import { NetworkProviderModule } from '@el/components/bitcoin-network-provider';
import { IndexerController } from './indexer.controller';
import { IndexerService } from './indexer.service';
import { IndexerSaga } from './application-layer/sagas';
import {
  IndexerCommandFactoryService,
  ReadStateExceptionHandlerService,
  BlocksCommandFactoryService,
  ViewsQueryFactoryService,
} from './application-layer/services';
import { ViewsReadRepositoryService, ViewsWriteRepositoryService } from './infrastructure-layer/services';
import { LastBlockSchema } from './infrastructure-layer/view-models';
import { IndexerModelFactoryService } from './domain-layer/services';
import { CommandHandlers } from './domain-layer/command-handlers';
import { EventsHandlers } from './domain-layer/events-handlers';
import { QueryHandlers } from './infrastructure-layer/query-handlers';
import {
  AppConfig,
  EventStoreConfig,
  ReadDatabaseConfig,
  BusinessConfig,
  BlocksQueueConfig,
  ProvidersConfig,
} from './config';
import { Schema, MapperType } from './protocol';

interface IndexerModuleOptions {
  appName: string;
  schemas: Schema[];
  mapper: MapperType;
  //...
}

@Module({})
export class BitcoinIndexerModule {
  static async register({ appName, schemas, mapper }: IndexerModuleOptions): Promise<DynamicModule> {
    const eventstoreConfig = await transformAndValidate(EventStoreConfig, process.env, {
      validator: { whitelist: true },
    });
    const readdatabaseConfig = await transformAndValidate(ReadDatabaseConfig, process.env, {
      validator: { whitelist: true },
    });
    const appConfig = await transformAndValidate(AppConfig, process.env, {
      validator: { whitelist: true },
    });
    const businessConfig = await transformAndValidate(BusinessConfig, process.env, {
      validator: { whitelist: true },
    });
    const blocksQueueConfig = await transformAndValidate(BlocksQueueConfig, process.env, {
      validator: { whitelist: true },
    });
    const providersConfig = await transformAndValidate(ProvidersConfig, process.env, {
      validator: { whitelist: true },
    });

    return {
      module: BitcoinIndexerModule,
      controllers: [IndexerController],
      imports: [
        LoggerModule.forRoot({ componentName: 'BitcoinIndexerPlugin' }),
        CqrsTransportModule.forRoot({ isGlobal: true }),
        CqrsModule.forRoot({ isGlobal: true }),
        // IMPORTANT: BitcoinNetworkProviderModule must be global inside one plugin
        NetworkProviderModule.forRootAsync({
          isGlobal: true,
          quickNodesUrls: providersConfig.BITCOIN_INDEXER_NETWORK_PROVIDER_QUICK_NODE_URLS,
          selfNodesUrl: providersConfig.BITCOIN_INDEXER_NETWORK_PROVIDER_SELF_NODE_URL,
        }),
        EventStoreModule.forRoot({
          path: `${appName}/data`,
          type: eventstoreConfig.BITCOIN_INDEXER_EVENTSTORE_DB_TYPE,
          name: 'indexer-eventstore', //eventstoreConfig.BITCOIN_INDEXER_EVENTSTORE_DB_NAME,
          synchronize: eventstoreConfig.BITCOIN_INDEXER_EVENTSTORE_DB_SYNCHRONIZE,
          logging: eventstoreConfig.isLogging(),
          database: 'indexer-eventstore',
          ...(eventstoreConfig.BITCOIN_INDEXER_EVENTSTORE_DB_HOST && {
            host: eventstoreConfig.BITCOIN_INDEXER_EVENTSTORE_DB_HOST,
          }),
          ...(eventstoreConfig.BITCOIN_INDEXER_EVENTSTORE_DB_PORT && {
            port: eventstoreConfig.BITCOIN_INDEXER_EVENTSTORE_DB_PORT,
          }),
          ...(eventstoreConfig.BITCOIN_INDEXER_EVENTSTORE_DB_USERNAME && {
            username: eventstoreConfig.BITCOIN_INDEXER_EVENTSTORE_DB_USERNAME,
          }),
          ...(eventstoreConfig.BITCOIN_INDEXER_EVENTSTORE_DB_PASSWORD && {
            password: eventstoreConfig.BITCOIN_INDEXER_EVENTSTORE_DB_PASSWORD,
          }),
        }),
        BlocksQueueModule.forRootAsync({
          blocksCommandExecutor: BlocksCommandFactoryService,
          isTransportMode: appConfig.BITCOIN_INDEXER_IS_TRANSPORT_MODE,
          maxBlockHeight: businessConfig.BITCOIN_INDEXER_MAX_BLOCK_HEIGHT,
          queueWorkersNum: blocksQueueConfig.BITCOIN_INDEXER_BLOCKS_QUEUE_WORKERS_NUM,
          maxQueueLength: blocksQueueConfig.BITCOIN_INDEXER_BLOCKS_QUEUE_MAX_LENGTH,
          queueLoaderStrategyName: blocksQueueConfig.BITCOIN_INDEXER_BLOCKS_QUEUE_LOADER_STRATEGY_NAME,
          queueLoaderNetworkProviderBatchesLength:
            blocksQueueConfig.BITCOIN_INDEXER_BLOCKS_QUEUE_LOADER_NETWORK_PROVIDER_BATCHES_LENGTH,
          queueLoaderIntervalMs: blocksQueueConfig.BITCOIN_INDEXER_BLOCKS_QUEUE_LOADER_INTERVAL_MS,
          queueLoaderMaxIntervalMs: blocksQueueConfig.BITCOIN_INDEXER_BLOCKS_QUEUE_LOADER_MAX_INTERVAL_MS,
          queueLoaderMaxIntervalMultiplier:
            blocksQueueConfig.BITCOIN_INDEXER_BLOCKS_QUEUE_LOADER_MAX_INTERVAL_MULTIPLIER,
          queueIteratorBlocksBatchSize: blocksQueueConfig.BITCOIN_INDEXER_BLOCKS_QUEUE_ITERATOR_BLOCKS_BATCH_SIZE,
        }),
        ViewsKeyValueDatabaseModule.forRoot({
          path: `${appName}/data`,
          type: 'rocksdb',
          name: 'indexer',
          schemas: [LastBlockSchema, ...schemas],
        }),
      ],
      providers: [
        {
          provide: AppConfig,
          useValue: appConfig,
        },
        {
          provide: BusinessConfig,
          useValue: businessConfig,
        },
        {
          provide: EventStoreConfig,
          useValue: eventstoreConfig,
        },
        {
          provide: ReadDatabaseConfig,
          useValue: readdatabaseConfig,
        },
        {
          provide: 'IndexerMapper',
          useClass: mapper,
        },
        ViewsQueryFactoryService,
        ViewsReadRepositoryService,
        ViewsWriteRepositoryService,
        ArithmeticService,
        IndexerService,
        IndexerModelFactoryService,
        BlocksCommandFactoryService,
        IndexerSaga,
        IndexerCommandFactoryService,
        ReadStateExceptionHandlerService,
        ...CommandHandlers,
        ...EventsHandlers,
        ...QueryHandlers,
      ],
      exports: [],
    };
  }
}
