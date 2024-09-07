import { Module, DynamicModule } from '@nestjs/common';
import { transformAndValidate } from 'class-transformer-validator';
import { CqrsModule } from '@easylayer/components/cqrs';
import { CqrsTransportModule } from '@easylayer/components/cqrs-transport';
import { LoggerModule } from '@easylayer/components/logger';
import { ArithmeticService } from '@easylayer/common/arithmetic';
import { BlocksQueueModule } from '@easylayer/components/bitcoin-blocks-queue';
import { EventStoreModule } from '@easylayer/components/eventstore';
import { ReadDatabaseModule } from '@easylayer/components/views-rdbms-db';
import { NetworkProviderModule } from '@easylayer/components/bitcoin-network-provider';
import { LoaderController } from './loader.controller';
import { LoaderService } from './loader.service';
import { LoaderSaga } from './application-layer/sagas';
import {
  BlocksCommandFactoryService,
  LoaderCommandFactoryService,
  ReadStateExceptionHandlerService,
  ViewsQueryFactoryService,
} from './application-layer/services';
import { LoaderModelFactoryService } from './domain-layer/services';
import { ViewsReadRepositoryService, ViewsWriteRepositoryService } from './infrastructure-layer/services';
import { CommandHandlers } from './domain-layer/command-handlers';
import { EventsHandlers } from './domain-layer/events-handlers';
import { QueryHandlers } from './infrastructure-layer/query-handlers';
import {
  AppConfig,
  BusinessConfig,
  EventStoreConfig,
  ReadDatabaseConfig,
  BlocksQueueConfig,
  ProvidersConfig,
} from './config';
import { MapperType, EntitySchema } from './protocol';
import { System } from './infrastructure-layer/view-models';

interface LoaderModuleOptions {
  appName: string;
  schemas: EntitySchema[];
  mapper: MapperType;
  //...
}

@Module({})
export class BitcoinLoaderModule {
  static async register({ appName, schemas, mapper }: LoaderModuleOptions): Promise<DynamicModule> {
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
      module: BitcoinLoaderModule,
      controllers: [LoaderController],
      imports: [
        LoggerModule.forRoot({ componentName: appName }),
        CqrsTransportModule.forRoot({ isGlobal: true }),
        CqrsModule.forRoot({ isGlobal: true }),
        // IMPORTANT: BitcoinNetworkProviderModule must be global inside one plugin
        NetworkProviderModule.forRootAsync({
          isGlobal: true,
          quickNodesUrls: providersConfig.BITCOIN_LOADER_NETWORK_PROVIDER_QUICK_NODE_URLS,
          selfNodesUrl: providersConfig.BITCOIN_LOADER_NETWORK_PROVIDER_SELF_NODE_URL,
        }),
        EventStoreModule.forRoot({
          path: `${appName}/data`,
          type: eventstoreConfig.BITCOIN_LOADER_EVENTSTORE_DB_TYPE,
          name: 'loader-eventstore', //eventstoreConfig.BITCOIN_INDEXER_EVENTSTORE_DB_NAME,
          logging: eventstoreConfig.isLogging(),
          database: 'loader-eventstore',
          ...(eventstoreConfig.BITCOIN_LOADER_EVENTSTORE_DB_HOST && {
            host: eventstoreConfig.BITCOIN_LOADER_EVENTSTORE_DB_HOST,
          }),
          ...(eventstoreConfig.BITCOIN_LOADER_EVENTSTORE_DB_PORT && {
            port: eventstoreConfig.BITCOIN_LOADER_EVENTSTORE_DB_PORT,
          }),
          ...(eventstoreConfig.BITCOIN_LOADER_EVENTSTORE_DB_USERNAME && {
            username: eventstoreConfig.BITCOIN_LOADER_EVENTSTORE_DB_USERNAME,
          }),
          ...(eventstoreConfig.BITCOIN_LOADER_EVENTSTORE_DB_PASSWORD && {
            password: eventstoreConfig.BITCOIN_LOADER_EVENTSTORE_DB_PASSWORD,
          }),
        }),
        ReadDatabaseModule.forRoot({
          path: `${appName}/data`,
          type: readdatabaseConfig.BITCOIN_LOADER_READ_DB_TYPE,
          name: 'loader-views', //readdatabaseConfig.BITCOIN_LOADER_READ_DB_NAME,
          logging: readdatabaseConfig.isLogging(),
          entities: [System, ...schemas],
          database: 'loader-views',
          ...(readdatabaseConfig.BITCOIN_LOADER_READ_DB_HOST && {
            host: readdatabaseConfig.BITCOIN_LOADER_READ_DB_HOST,
          }),
          ...(readdatabaseConfig.BITCOIN_LOADER_READ_DB_PORT && {
            port: readdatabaseConfig.BITCOIN_LOADER_READ_DB_PORT,
          }),
          ...(readdatabaseConfig.BITCOIN_LOADER_READ_DB_USERNAME && {
            username: readdatabaseConfig.BITCOIN_LOADER_READ_DB_USERNAME,
          }),
          ...(readdatabaseConfig.BITCOIN_LOADER_READ_DB_PASSWORD && {
            password: readdatabaseConfig.BITCOIN_LOADER_READ_DB_PASSWORD,
          }),
        }),
        BlocksQueueModule.forRootAsync({
          blocksCommandExecutor: BlocksCommandFactoryService,
          isTransportMode: false,
          maxBlockHeight: businessConfig.BITCOIN_LOADER_MAX_BLOCK_HEIGHT,
          queueWorkersNum: blocksQueueConfig.BITCOIN_LOADER_BLOCKS_QUEUE_WORKERS_NUM,
          maxQueueLength: blocksQueueConfig.BITCOIN_LOADER_BLOCKS_QUEUE_MAX_LENGTH,
          queueLoaderStrategyName: blocksQueueConfig.BITCOIN_LOADER_BLOCKS_QUEUE_LOADER_STRATEGY_NAME,
          queueLoaderNetworkProviderBatchesLength:
            blocksQueueConfig.BITCOIN_LOADER_BLOCKS_QUEUE_LOADER_NETWORK_PROVIDER_BATCHES_LENGTH,
          queueLoaderIntervalMs: blocksQueueConfig.BITCOIN_LOADER_BLOCKS_QUEUE_LOADER_INTERVAL_MS,
          queueLoaderMaxIntervalMs: blocksQueueConfig.BITCOIN_LOADER_BLOCKS_QUEUE_LOADER_MAX_INTERVAL_MS,
          queueLoaderMaxIntervalMultiplier:
            blocksQueueConfig.BITCOIN_LOADER_BLOCKS_QUEUE_LOADER_MAX_INTERVAL_MULTIPLIER,
          queueIteratorBlocksBatchSize: blocksQueueConfig.BITCOIN_LOADER_BLOCKS_QUEUE_ITERATOR_BLOCKS_BATCH_SIZE,
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
          provide: 'LoaderMapper',
          useClass: mapper,
        },
        ViewsReadRepositoryService,
        ViewsWriteRepositoryService,
        ArithmeticService,
        LoaderService,
        LoaderSaga,
        BlocksCommandFactoryService,
        LoaderCommandFactoryService,
        LoaderModelFactoryService,
        ReadStateExceptionHandlerService,
        ViewsQueryFactoryService,
        ...CommandHandlers,
        ...EventsHandlers,
        ...QueryHandlers,
      ],
      exports: [],
    };
  }
}
