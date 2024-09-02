import { Injectable } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsString, IsBoolean, IsNumber, IsOptional } from 'class-validator';

@Injectable()
export class ReadDatabaseConfig {
  // TODO
  @IsBoolean()
  BITCOIN_WALLET_READ_DB_SYNCHRONIZE: boolean = true;

  @Transform(({ value }) => (value ? value : 'localhost'))
  @IsString()
  @IsOptional()
  BITCOIN_WALLET_READ_DB_HOST?: string;

  @Transform(({ value }) => (value ? parseInt(value, 10) : 5432))
  @IsNumber()
  @IsOptional()
  BITCOIN_WALLET_READ_DB_PORT?: number;

  @Transform(({ value }) => (value ? value : ''))
  @IsString()
  @IsOptional()
  BITCOIN_WALLET_READ_DB_USERNAME?: string;

  @Transform(({ value }) => (value ? value : ''))
  @IsString()
  @IsOptional()
  BITCOIN_WALLET_READ_DB_PASSWORD?: string;

  @Transform(({ value }) => (value ? Number(value) : 10000))
  @IsNumber()
  BITCOIN_WALLET_READ_DB_SQLITE_CHANKS_LIMIT: number = 10000;

  isLogging(): boolean {
    return process.env.DB_DEBUG === '1';
  }
}
