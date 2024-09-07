import { AggregateRoot } from '@easylayer/components/cqrs';
import { NetworkProviderService, Blockchain } from '@easylayer/components/bitcoin-network-provider';
import {
  BitcoinLoaderInitializedEvent,
  BitcoinLoaderBlocksIndexedEvent,
  BitcoinLoaderReorganisationStartedEvent,
  BitcoinLoaderReorganisationFinishedEvent,
  BitcoinLoaderReorganisationProcessedEvent,
} from '@easylayer/common/domain-cqrs-components/bitcoin-loader';

enum LoaderStatuses {
  AWAITING = 'awaiting',
  REORGANISATION = 'reorganisation',
}

type LightBlock = {
  height: number;
  hash: string;
  prevHash: string;
  tx: string[];
};

export class Loader extends AggregateRoot {
  // IMPORTANT: There must be only one Loader Aggregate in the module,
  // so we immediately give it aggregateId by which we can find it.
  public aggregateId: string = 'loader';
  public status!: LoaderStatuses;
  public chain: Blockchain = new Blockchain({ maxSize: 5000 });

  // IMPORTANT: this method doing two things:
  // 1 - create Loader if it's first creation
  // 2 - use already created params but still publish event
  public async init({
    requestId,
    startHeight,
    restoreBlocks,
  }: {
    requestId: string;
    startHeight: string | number;
    restoreBlocks: string[];
  }) {
    const status = this.status || LoaderStatuses.AWAITING;
    const lastBlockHeight = this.chain.lastBlockHeight;
    // NOTE: lastBlockHeight - is the last already indexed block and
    // if it's start of blockchain where genesis block height is '0'
    // so we indicate the last indexed block adjusted by -1.
    // startHeight - is the height from which the user wants to index, it cannot be less than 0.
    const height = lastBlockHeight + 1 > Number(startHeight) ? lastBlockHeight : Number(startHeight) - 1;

    await this.apply(
      new BitcoinLoaderInitializedEvent({
        aggregateId: this.aggregateId,
        requestId,
        status,
        indexedHeight: height.toString(),
        restoreBlocks,
      })
    );
  }

  public async addBlocks({
    blocks,
    requestId,
    service,
    logger,
  }: {
    blocks: any;
    requestId: string;
    service: any;
    logger: any;
  }) {
    if (this.status !== LoaderStatuses.AWAITING) {
      throw new Error("addBlocks() Reorganisation hasn't finished yet");
    }

    const isValid = this.chain.validateNextBlocks(blocks);

    if (!isValid) {
      return await this.startReorganisation({
        requestId,
        service,
        logger,
        blocks: [],
      });
    }

    logger.info(
      'Balances successfull indexed',
      {
        blocksHeight: blocks[blocks.length - 1].height,
        blocksLength: blocks.length,
        txLength: blocks.reduce((result: number, item: any) => result + item.tx.length, 0),
      },
      this.constructor.name
    );

    return await this.apply(
      new BitcoinLoaderBlocksIndexedEvent({
        aggregateId: this.aggregateId,
        requestId,
        status: LoaderStatuses.AWAITING,
        blocks: blocks.map((block: any) => ({
          ...block,
          tx: block.tx.map((t: any) => t.txid),
        })),
      })
    );
  }

  public async processReorganisation({
    blocks,
    height,
    requestId,
    logger,
  }: {
    blocks: LightBlock[];
    height: string | number;
    requestId: string;
    logger: any;
  }): Promise<void> {
    if (this.status !== LoaderStatuses.REORGANISATION) {
      throw new Error("processReorganisation() Reorganisation hasn't started yet");
    }

    if (Number(height) > this.chain.lastBlockHeight) {
      throw new Error('Wrong block height');
    }

    // We check the block size and see if we will split it into several events
    if (blocks.length > 100) {
      // TODO: Add logic for creating several events here at once in case there are many blocks

      const blocksToProcessed = blocks;

      logger.info(
        `Blockchain continue reorganising by blocks count`,
        {
          blocksLength: blocksToProcessed.length,
        },
        this.constructor.name
      );

      return await this.apply(
        new BitcoinLoaderReorganisationProcessedEvent({
          aggregateId: this.aggregateId,
          requestId,
          // NOTE: height - height of reorganization (last correct block)
          height: height.toString(),
          blocks: blocksToProcessed,
        })
      );
    }

    logger.info(
      `Blockchain successfull reorganised to height`,
      {
        height,
      },
      this.constructor.name
    );

    return await this.apply(
      new BitcoinLoaderReorganisationFinishedEvent({
        aggregateId: this.aggregateId,
        requestId,
        status: LoaderStatuses.AWAITING,
        // NOTE: height - height of reorganization (last correct block)
        height: height.toString(),
      })
    );
  }

  public async startReorganisation({
    height,
    requestId,
    service,
    logger,
    blocks,
  }: {
    height?: number;
    requestId: string;
    service: NetworkProviderService;
    logger: any;
    blocks: any[];
  }): Promise<void> {
    if (this.status !== LoaderStatuses.AWAITING) {
      throw new Error("reorganisation() Previous reorganisation hasn't finished yet");
    }

    // NOTE: We move from the last block in the chain and look for the last match with the provider network
    const prevHeight = height ? height : this.chain.lastBlockHeight;
    const localBlock = this.chain.findBlockByHeight(prevHeight);
    const oldBlock = await service.getOneBlockByHeight(prevHeight);

    if (!localBlock) {
      // If we haven’t found a block by height in the chain by height,
      // then this is an error,
      // we must go back all the way to the loader and try with another block
      throw new Error('Block not found in local chain');
    }

    if (oldBlock.hash === localBlock.hash && oldBlock.previousblockhash === localBlock.prevHash) {
      // Match found

      logger.info(
        'Blockchain reorganisation starting',
        {
          reorganisationHeight: localBlock.height.toString(),
          blocksLength: blocks.length,
          txLength: blocks.reduce((result: number, item: any) => result + item.tx.length, 0),
        },
        this.constructor.name
      );

      return await this.apply(
        new BitcoinLoaderReorganisationStartedEvent({
          aggregateId: this.aggregateId,
          requestId,
          status: LoaderStatuses.REORGANISATION,
          // NOTE: height - is height of reorganisation(the last height where the blocks matched)
          height: localBlock.height.toString(),
          // NOTE: blocks that need to be reorganized
          blocks,
        })
      );
    }

    // Saving blocks for publication in an event
    const newBlocks = [...blocks, localBlock];

    // Recursive check the previous block
    return this.startReorganisation({ height: prevHeight, requestId, service, logger, blocks: newBlocks });
  }

  private onBitcoinLoaderInitializedEvent({ payload }: BitcoinLoaderInitializedEvent) {
    const { aggregateId, status } = payload;
    this.aggregateId = aggregateId;
    this.status = status as LoaderStatuses;
  }

  private onBitcoinLoaderBlocksIndexedEvent({ payload }: BitcoinLoaderBlocksIndexedEvent) {
    const { blocks, status } = payload;

    this.status = status as LoaderStatuses;
    this.chain.addBlocks(blocks);
  }

  private onBitcoinLoaderReorganisationStartedEvent({ payload }: BitcoinLoaderReorganisationStartedEvent) {
    const { status } = payload;
    this.status = status as LoaderStatuses;
  }

  // Here we cut full at once in height
  // This method is idempotent
  private onBitcoinLoaderReorganisationFinishedEvent({ payload }: BitcoinLoaderReorganisationFinishedEvent) {
    const { height, status } = payload;
    this.status = status as LoaderStatuses;
    this.chain.truncateToBlock(Number(height));
  }

  // Here we will only cut a few blocks
  // This method is idempotent
  private onBitcoinLoaderReorganisationProcessedEvent({ payload }: BitcoinLoaderReorganisationProcessedEvent) {
    const { blocks } = payload;
    this.chain.truncateToBlock(Number(blocks[0].height));
  }
}
