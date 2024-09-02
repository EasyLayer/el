import { Injectable } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsString, IsBoolean, IsNumber, IsOptional } from 'class-validator';

type DatabaseTypes = 'sqlite' | 'postgres';

@Injectable()
export class ReadDatabaseConfig {
  @Transform(({ value }) => (value ? value : 'sqlite'))
  @IsString()
  BITCOIN_LOADER_READ_DB_TYPE: DatabaseTypes = 'sqlite';

  // TODO
  @IsBoolean()
  BITCOIN_LOADER_READ_DB_SYNCHRONIZE: boolean = true;

  @Transform(({ value }) => (value ? value : 'localhost'))
  @IsString()
  @IsOptional()
  BITCOIN_LOADER_READ_DB_HOST?: string;

  @Transform(({ value }) => (value ? parseInt(value, 10) : 5432))
  @IsNumber()
  @IsOptional()
  BITCOIN_LOADER_READ_DB_PORT?: number;

  @Transform(({ value }) => (value ? value : ''))
  @IsString()
  @IsOptional()
  BITCOIN_LOADER_READ_DB_USERNAME?: string;

  @Transform(({ value }) => (value ? value : ''))
  @IsString()
  @IsOptional()
  BITCOIN_LOADER_READ_DB_PASSWORD?: string;

  @Transform(({ value }) => (value ? Number(value) : 10000))
  @IsNumber()
  BITCOIN_LOADER_READ_DB_SQLITE_CHANKS_LIMIT: number = 10000;

  isLogging(): boolean {
    return process.env.DB_DEBUG === '1';
  }
}
