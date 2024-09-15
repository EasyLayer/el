import { Injectable } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsString, IsOptional, IsArray } from 'class-validator';
import { JSONSchema } from 'class-validator-jsonschema';

@Injectable()
export class ProvidersConfig {
  @Transform(({ value }) => (value ? value : ''))
  @IsString()
  @IsOptional()
  @JSONSchema({
    description: "URL of the user's own Bitcoin node. Format: http://username:password@host:port",
  })
  BITCOIN_LOADER_NETWORK_PROVIDER_SELF_NODE_URL?: string;

  @Transform(({ value }) => (value ? value.split('|') : []))
  @IsArray()
  @IsOptional()
  @JSONSchema({
    description: 'Multiple QuickNode node URLs can be entered, separated by commas.',
  })
  BITCOIN_LOADER_NETWORK_PROVIDER_QUICK_NODE_URLS?: string[];
}
