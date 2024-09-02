import { Injectable } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsString, IsOptional, IsArray } from 'class-validator';

@Injectable()
export class ProvidersConfig {
  @Transform(({ value }) => (value ? value : ''))
  @IsString()
  @IsOptional()
  BITCOIN_INDEXER_NETWORK_PROVIDER_SELF_NODE_URL?: string;

  @Transform(({ value }) => (value ? value.split('|') : []))
  @IsArray()
  @IsOptional()
  BITCOIN_INDEXER_NETWORK_PROVIDER_QUICK_NODE_URLS?: string[];
}
