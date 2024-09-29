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

  @Transform(({ value }) => (value !== undefined ? parseInt(value, 10) : 119430400))
  @IsNumber()
  @JSONSchema({
    description: 'Maximum size in bytes of the Bitcoin blocks queue.',
    default: 119430400,
  })
  BITCOIN_LOADER_BLOCKS_QUEUE_MAX_SIZE: number = 119430400; // 100 MB

  @Transform(({ value }) => (value !== undefined ? parseInt(value, 10) : 1048576))
  @IsNumber()
  @JSONSchema({
    description: 'Minimum size in bytes of the Bitcoin blocks queue transfer blocks to outStack',
    default: 1048576,
  })
  BITCOIN_LOADER_BLOCKS_QUEUE_MIN_TRANSFER_SIZE: number = 1 * 1024 * 1024; // 1 MB;

  @Transform(({ value }) => (value !== undefined ? value : BlocksQueueStrategy.PULL_NETWORL_PROVIDER))
  @IsEnum(BlocksQueueStrategy)
  @JSONSchema({
    description: 'Loader strategy name for the Bitcoin blocks queue.',
    default: BlocksQueueStrategy.PULL_NETWORL_PROVIDER,
    enum: Object.values(BlocksQueueStrategy),
  })
  BITCOIN_LOADER_BLOCKS_QUEUE_LOADER_STRATEGY_NAME: BlocksQueueStrategy = BlocksQueueStrategy.PULL_NETWORL_PROVIDER;

  @Transform(({ value }) => (value !== undefined ? parseInt(value, 10) : 4194304))
  @IsNumber()
  @JSONSchema({
    description:
      'Batch size in bytes of the batch blocks iterator at one time. Should not be bigger than the size of a single block.',
    default: 4194304,
  })
  BITCOIN_LOADER_BLOCKS_QUEUE_ITERATOR_BLOCKS_BATCH_SIZE: number = 4194304; // 4 MB

  @Transform(({ value }) => (value !== undefined ? parseInt(value, 10) : 10))
  @IsNumber()
  BITCOIN_LOADER_BLOCKS_QUEUE_LOADER_BLOCKS_BATCH_LENGTH: number = 10;

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
