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
  @Transform(({ value }) => (value !== undefined ? parseInt(value, 10) : 10485760))
  @IsNumber()
  @JSONSchema({
    description: 'Maximum size in bytes of the rpc blocks batch request',
    default: 10485760,
  })
  BITCOIN_LOADER_BLOCKS_QUEUE_LOADER_REQUEST_BLOCKS_BATCH_SIZE: number = 10 * 1024 * 1024; // 10 MB;

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
}
