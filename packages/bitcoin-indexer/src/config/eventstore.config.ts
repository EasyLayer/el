import { resolve } from 'node:path';
import { Injectable } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsString, IsBoolean, IsOptional, IsNumber } from 'class-validator';

type DatabaseTypes = 'sqlite' | 'postgres';

@Injectable()
export class EventStoreConfig {
  @Transform(({ value }) => (value ? value : 'sqlite'))
  @IsString()
  BITCOIN_INDEXER_EVENTSTORE_DB_TYPE: DatabaseTypes = 'sqlite';

  @IsBoolean()
  BITCOIN_INDEXER_EVENTSTORE_DB_SYNCHRONIZE: boolean = true;

  @Transform(({ value }) => (value ? value : 'localhost'))
  @IsString()
  @IsOptional()
  BITCOIN_INDEXER_EVENTSTORE_DB_HOST?: string;

  @Transform(({ value }) => (value ? parseInt(value, 10) : 5432))
  @IsNumber()
  @IsOptional()
  BITCOIN_INDEXER_EVENTSTORE_DB_PORT?: number;

  @Transform(({ value }) => (value ? value : ''))
  @IsString()
  @IsOptional()
  BITCOIN_INDEXER_EVENTSTORE_DB_USERNAME?: string;

  @Transform(({ value }) => (value ? value : ''))
  @IsString()
  @IsOptional()
  BITCOIN_INDEXER_EVENTSTORE_DB_PASSWORD?: string;

  @Transform(({ value }) => (value ? value : ''))
  @IsString()
  BITCOIN_INDEXER_EVENTSTORE_DB_NAME: string = resolve(process.cwd(), `data/indexer-eventstore.db`);

  isLogging(): boolean {
    return process.env.DB_DEBUG === '1';
  }
}
