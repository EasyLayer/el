import { AggregateRoot } from '@easylayer/components/cqrs';
import {
  NetworkProviderService,
  LightBlock,
  Blockchain,
  restoreChainLinks,
} from '@easylayer/components/bitcoin-network-provider';
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

export class Loader extends AggregateRoot {
  // IMPORTANT: There must be only one Loader Aggregate in the module,
  // so we immediately give it aggregateId by which we can find it.
  public aggregateId: string = 'loader';
  public status: LoaderStatuses = LoaderStatuses.AWAITING;
  // IMPORTANT: 'maxSize' must be NOT LESS than the number of blocks in a single batch when iterating over BlocksQueue.
  // The number of blocks in a batch depends on the block size,
  // so we must take the smallest blocks in the network,
  // and make sure that they fit into a single batch less than the value of 'maxSize' .
  public chain: Blockchain = new Blockchain({ maxSize: 1000 });

  protected toJsonPayload(): any {
    return {
      status: this.status,
      // Convert Blockchain to an array of blocks
      chain: this.chain.toArray(),
    };
  }

  protected fromSnapshot(state: any): void {
    this.status = state.status;
    if (state.chain && Array.isArray(state.chain)) {
      this.chain = new Blockchain({ maxSize: 1000 });
      this.chain.fromArray(state.chain);
      // Recovering links in Blockchain
      restoreChainLinks(this.chain.head);
    }
  }

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
    // IMPORTANT: lastBlockHeight - is the last already indexed block and
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

  public async addBlocks({ blocks, requestId, service }: { blocks: any; requestId: string; service: any }) {
    if (this.status !== LoaderStatuses.AWAITING) {
      throw new Error("addBlocks() Reorganisation hasn't finished yet");
    }

    const isValid = this.chain.validateNextBlocks(blocks);

    if (!isValid) {
      return await this.startReorganisation({
        height: this.chain.lastBlockHeight,
        requestId,
        service,
        blocks: [],
      });
    }

    return await this.apply(
      new BitcoinLoaderBlocksIndexedEvent({
        aggregateId: this.aggregateId,
        requestId,
        status: LoaderStatuses.AWAITING,
        blocks: blocks.map((block: any) => ({
          height: Number(block.height),
          hash: block.hash,
          previousblockhash: block?.previousblockhash || '',
          tx: block.tx.map((t: any) => t.txid),
        })),
      })
    );
  }

  public async processReorganisation({
    blocks,
    height,
    requestId,
  }: {
    blocks: LightBlock[];
    height: string | number;
    requestId: string;
  }): Promise<void> {
    if (this.status !== LoaderStatuses.REORGANISATION) {
      throw new Error("processReorganisation() Reorganisation hasn't started yet");
    }

    if (Number(height) > this.chain.lastBlockHeight) {
      throw new Error('Wrong block height');
    }

    // TODO: Task SH-15
    // if (blocks.length > 100) {
    //   const blocksToProcessed = blocks;

    //   return await this.apply(
    //     new BitcoinLoaderReorganisationProcessedEvent({
    //       aggregateId: this.aggregateId,
    //       requestId,
    //       // IMPORTANT: height - height of reorganization (last correct block)
    //       height: height.toString(),
    //       blocks: blocksToProcessed,
    //     })
    //   );
    // }

    return await this.apply(
      new BitcoinLoaderReorganisationFinishedEvent({
        aggregateId: this.aggregateId,
        requestId,
        status: LoaderStatuses.AWAITING,
        // IMPORTANT: height - height of reorganization (last correct block)
        height: height.toString(),
        blocks,
      })
    );
  }

  public async startReorganisation({
    height,
    requestId,
    service,
    blocks,
  }: {
    height: number;
    requestId: string;
    service: NetworkProviderService;
    blocks: any[];
  }): Promise<void> {
    if (this.status !== LoaderStatuses.AWAITING) {
      throw new Error("reorganisation() Previous reorganisation hasn't finished yet");
    }

    const localBlock = this.chain.findBlockByHeight(height)!;
    const oldBlock = await service.getOneBlockByHeight(height);

    if (oldBlock.hash === localBlock.hash && oldBlock.previousblockhash === localBlock.previousblockhash) {
      // Match found

      return await this.apply(
        new BitcoinLoaderReorganisationStartedEvent({
          aggregateId: this.aggregateId,
          requestId,
          status: LoaderStatuses.REORGANISATION,
          // IMPORTANT: height - is height of reorganisation(the last height where the blocks matched)
          height: height.toString(),
          // IMPORTANT: blocks that need to be reorganized
          blocks,
        })
      );
    }

    // Saving blocks for publication in an event
    const newBlocks = [...blocks, localBlock];
    const prevHeight = height - 1;

    // Recursive check the previous block
    return this.startReorganisation({ height: prevHeight, requestId, service, blocks: newBlocks });
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
