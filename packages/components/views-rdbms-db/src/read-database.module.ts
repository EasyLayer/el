import { Module, DynamicModule } from '@nestjs/common';
import { TypeOrmModule, TypeOrmModuleOptions, getDataSourceToken } from '@nestjs/typeorm';
import { addTransactionalDataSource, initializeTransactionalContext } from 'typeorm-transactional';
import { DataSource, DataSourceOptions, EntitySchema } from 'typeorm';
import { LoggerModule, AppLogger } from '@easylayer/components/logger';
import { ReadDatabaseService } from './read-database.service';

type ReadDatabaseModuleConfig = TypeOrmModuleOptions & {
  type: 'sqlite' | 'postgres' | 'mysql' | 'mongodb';
  name: string;
  // eslint-disable-next-line @typescript-eslint/ban-types
  entities: (Function | EntitySchema<any>)[];
  database: string;
};

@Module({})
export class ReadDatabaseModule {
  static async forRootAsync(config: ReadDatabaseModuleConfig): Promise<DynamicModule> {
    const { name, entities = [], database, ...restOptions } = config;

    // Initialize transactional context before setting up the database connections
    initializeTransactionalContext();

    const dataSourceOptions = {
      ...restOptions,
      name,
      database,
      entities,
      synchronize: false, // Disable synchronization by default
    };

    const tempDataSource = new DataSource(dataSourceOptions);

    try {
      await tempDataSource.initialize();

      const queryRunner = tempDataSource.createQueryRunner();
      const tableChecks = entities.map((entity) => queryRunner.hasTable(entity.constructor.name));

      const results = await Promise.all(tableChecks);

      const hasTables = results.every((exists) => exists);

      if (!hasTables) {
        // If any table is missing, enable synchronization
        dataSourceOptions.synchronize = true;
      }

      await tempDataSource.destroy();
    } catch (error) {
      dataSourceOptions.synchronize = true;
    }

    return {
      module: ReadDatabaseModule,
      imports: [
        TypeOrmModule.forRootAsync({
          imports: [LoggerModule.forRoot({ componentName: 'ViewsDatabase' })],
          name,
          useFactory: (log: AppLogger) => ({
            ...dataSourceOptions,
            log,
          }),
          inject: [AppLogger],
          dataSourceFactory: async (options?: DataSourceOptions & { log?: AppLogger }) => {
            if (!options) {
              throw new Error('Invalid options passed');
            }

            options.log?.info(`Connecting to read database...`, {}, this.constructor.name);

            const dataSource = new DataSource(options);

            try {
              await dataSource.initialize();
            } catch (error) {
              options.log?.error(`Unable to connect to the database ${database}`, error, this.constructor.name);
            }

            if (restOptions.type === 'sqlite') {
              await dataSource.query('PRAGMA cache_size = 10000;');
              await dataSource.query('PRAGMA temp_store = MEMORY;');
              await dataSource.query('PRAGMA mmap_size = 268435456;');
              await dataSource.query('PRAGMA synchronous = OFF;');
              await dataSource.query('PRAGMA journal_mode = OFF;');
              await dataSource.query('PRAGMA journal_size_limit = 6144000;');
              await dataSource.query('PRAGMA wal_checkpoint(TRUNCATE);');
            }

            addTransactionalDataSource({
              name,
              dataSource,
            });

            options.log?.info(`Successfully connected to views database.`, {}, this.constructor.name);

            return dataSource;
          },
        }),
        TypeOrmModule.forFeature(entities, name),
      ],
      providers: [
        {
          provide: ReadDatabaseService,
          useFactory: async (dataSource: DataSource) => {
            return new ReadDatabaseService(dataSource);
          },
          inject: [getDataSourceToken(name)],
        },
      ],
      exports: [TypeOrmModule, ReadDatabaseService],
    };
  }
}
