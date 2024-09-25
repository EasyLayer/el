import { Injectable } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsNumber, IsEnum } from 'class-validator';
import { JSONSchema } from 'class-validator-jsonschema';

enum BlocksQueueStrategy {
  WEBHOOK_STREAM = 'webhook-stream',
  PULL_NETWORK_TRANSPORT = 'pull-network-transport',
  PULL_NETWORL_PROVIDER = 'pull-network-provider',
}

@Injectable()
export class BlocksQueueConfig {
  @Transform(({ value }) => (value !== undefined ? parseInt(value, 10) : 4))
  @IsNumber()
  @JSONSchema({
    description: 'Number of parallel requests for the Bitcoin loader queue.',
    default: 1,
  })
  BITCOIN_LOADER_BLOCKS_QUEUE_LOADER_CONCURRENCY_NUM: number = 4;

  @Transform(({ value }) => (value !== undefined ? parseInt(value, 10) : 100 * 4 * 1024 * 1024))
  @IsNumber()
  @JSONSchema({
    description: 'Maximum size in bytes of the Bitcoin loader blocks queue.',
    default: 419430400,
  })
  BITCOIN_LOADER_BLOCKS_QUEUE_MAX_SIZE: number = 100 * 4 * 1024 * 1024;

  @Transform(({ value }) => (value !== undefined ? value : BlocksQueueStrategy.PULL_NETWORL_PROVIDER))
  @IsEnum(BlocksQueueStrategy)
  @JSONSchema({
    description: 'Loader strategy name for the Bitcoin blocks queue.',
    default: BlocksQueueStrategy.PULL_NETWORL_PROVIDER,
    enum: Object.values(BlocksQueueStrategy),
  })
  BITCOIN_LOADER_BLOCKS_QUEUE_LOADER_STRATEGY_NAME: BlocksQueueStrategy = BlocksQueueStrategy.PULL_NETWORL_PROVIDER;

  @Transform(({ value }) => (value !== undefined ? parseInt(value, 10) : 4 * 10 * 1024 * 1024))
  @IsNumber()
  @JSONSchema({
    description:
      'Batch size in bytes of the batch blocks iterator at one time. Should not be bigger than the size of a single block.',
    default: 4194304,
  })
  BITCOIN_LOADER_BLOCKS_QUEUE_ITERATOR_BLOCKS_BATCH_SIZE: number = 4 * 1024 * 1024;

  @Transform(({ value }) => (value !== undefined ? parseInt(value, 10) : 25))
  @IsNumber()
  BITCOIN_LOADER_BLOCKS_QUEUE_LOADER_BLOCKS_BATCH_LENGTH: number = 25;

  @Transform(({ value }) => (value !== undefined ? parseInt(value, 10) : 500))
  @IsNumber()
  BITCOIN_LOADER_BLOCKS_QUEUE_LOADER_INTERVAL_MS: number = 500;

  @Transform(({ value }) => (value !== undefined ? parseInt(value, 10) : 10 * 60 * 1000))
  @IsNumber()
  BITCOIN_LOADER_BLOCKS_QUEUE_LOADER_MAX_INTERVAL_MS: number = 10 * 60 * 1000;

  @Transform(({ value }) => (value !== undefined ? parseInt(value, 10) : 2))
  @IsNumber()
  BITCOIN_LOADER_BLOCKS_QUEUE_LOADER_MAX_INTERVAL_MULTIPLIER: number = 2;
}
