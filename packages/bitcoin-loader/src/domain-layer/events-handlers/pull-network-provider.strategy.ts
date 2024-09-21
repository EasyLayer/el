// import { join } from 'node:path';
// import Piscina from 'piscina';
// import { Mutex } from 'async-mutex';
// import { NetworkProviderService } from '@easylayer/components/bitcoin-network-provider';
// import { AppLogger, RuntimeTracker } from '@easylayer/components/logger';
// import { BlocksLoadingStrategy, StrategyNames } from '../load-strategy.interface';
// import { Block } from '../../../interfaces';
// import { BlocksQueue } from '../../../blocks-queue';

// export class PullNetworkProviderByWorkersStrategy implements BlocksLoadingStrategy {
//   readonly name: StrategyNames = StrategyNames.PULL_NETWORL_PROVIDER;
//   private _workerPool!: Piscina;
//   private _isLoading: boolean = false;
//   private _batchLength!: number;
//   private _missedHeights: number[] = [];
//   private _loadedBlocks: Block[] = [];
//   private _mutex: Mutex = new Mutex();

//   constructor(
//     private readonly log: AppLogger,
//     private readonly networkProvider: NetworkProviderService,
//     private readonly queue: BlocksQueue<Block>,
//     config: {
//       minThreads: number;
//       maxThreads: number;
//       batchLength: number;
//     }
//   ) {
//     this._batchLength = config.batchLength;
//     this._workerPool = new Piscina({
//       filename: join(__dirname, './worker.js'),
//       minThreads: config.minThreads,
//       maxThreads: config.maxThreads,
//     });
//   }

//   get isLoading(): boolean {
//     return this._isLoading;
//   }

//   /**
//    * Starts the process of loading blocks.
//    * @param currentNetworkHeight The current height of the blockchain.
//    */
//   public async load(currentNetworkHeight: number): Promise<void> {
//     if (this._isLoading) {
//       return;
//     }

//     this._isLoading = true;
//     this._missedHeights = [];
//     this._loadedBlocks = [];

//     while (this._isLoading) {
//       // Check if we have reached the current network height
//       if (this.queue.lastHeight >= currentNetworkHeight) {
//         this.log.debug('Reached current network height.', { lastHeight: this.queue.lastHeight }, this.constructor.name);
//         break;
//       }

//       // Check if the queue is full
//       if (this.queue.length >= this.queue.maxQueueLength) {
//         // When the queue is full, wait a bit
//         this.log.debug('Queue is full. Waiting...', { queueLength: this.queue.length }, this.constructor.name);
//         await new Promise((resolve) => setTimeout(resolve, 100));
//         continue;
//       }

//       try {
//         await this.execute(currentNetworkHeight);
//       } catch (error) {
//         await this.stop();
//         throw error;
//       }
//     }

//     await this.stop();
//   }

//   /**
//    * Stops the loading process.
//    */
//   private async stop(): Promise<void> {
//     if (!this._isLoading) return;
//     this._isLoading = false;
//   }

//   /**
//    * Destroys the worker pool and stops the loading process.
//    */
//   public async destroy(): Promise<void> {
//     this._isLoading = false;
//     if (this._workerPool) {
//       await this._workerPool.destroy();
//     }
//   }

//   /**
//    * Executes the loading tasks by assigning workers and handling missed heights.
//    * @param currentNetworkHeight The current height of the blockchain.
//    */
//   private async execute(currentNetworkHeight: number): Promise<void> {
//     const activeTasks: Promise<Block[]>[] = [];
//     const threads = this._workerPool.options.maxThreads;

//     for (let i = 0; i < threads; i++) {
//       const nextStartHeight = this.queue.lastHeight + 1 + i * this._batchLength;

//       if (currentNetworkHeight >= nextStartHeight) {
//         if (!this._missedHeights.includes(nextStartHeight)) {
//           const taskPromise = this.assignWorker(nextStartHeight);
//           activeTasks.push(taskPromise);
//         }
//       }
//     }

//     // Process missed heights
//     while (this._missedHeights.length > 0) {
//       const height = this._missedHeights.shift();

//       if (height) {
//         this.log.debug('Re-attempting missed height.', { height }, this.constructor.name);
//         const taskPromise = this.assignWorker(height);
//         activeTasks.push(taskPromise);
//       }
//     }

//     const results = await Promise.allSettled(activeTasks);

//     for (const result of results) {
//       if (result.status === 'fulfilled') {
//         const blocks = result.value;
//         this._loadedBlocks.push(...blocks);
//       }
//     }

//     await this.enqueueBatches();
//   }

//   /**
//    * Assigns a worker to load a batch of blocks starting from a specific height.
//    * @param startHeight The starting height for the batch.
//    */
//   @RuntimeTracker({ showMemory: false, warningThresholdMs: 10, errorThresholdMs: 1000 })
//   private async assignWorker(startHeight: number): Promise<Block[]> {
//     try {
//       const providersConnectionOptions = this.networkProvider.connectionManager.connectionOptionsForAllProviders();

//       console.time(`_workerPool${startHeight}`);

//       // Pass parameters to the worker: startHeight and batchLength
//       const blocksBatch: Block[] = await this._workerPool.run({
//         startHeight,
//         batchLength: this._batchLength,
//         providersConnectionOptions,
//       });

//       console.timeEnd(`_workerPool${startHeight}`);
//       return blocksBatch;
//     } catch (error) {
//       // Check the number of missed heights
//       if (this._missedHeights.length >= 100) {
//         this._missedHeights = [];
//         throw new Error('Missed heights exceed 100. Clearing missed heights.');
//       }

//       if (!this._missedHeights.includes(startHeight)) {
//         this._missedHeights.push(startHeight);
//       }

//       return [];
//     }
//   }

//   /**
//    * Enqueues loaded blocks into the queue in the correct order.
//    */
//   private async enqueueBatches(): Promise<void> {
//     // Sort blocks by height in descending order
//     this._loadedBlocks.sort((a, b) => {
//       if (a.height < b.height) return 1;
//       if (a.height > b.height) return -1;
//       return 0;
//     });

//     while (this._loadedBlocks.length > 0) {
//       // Extract the last block from the array
//       const block = this._loadedBlocks.pop();

//       if (block) {
//         if (block.height <= this.queue.lastHeight) {
//           this.log.debug('Skipping block with height less than or equal to lastHeight', { blockHeight: block.height, lastHeight: this.queue.lastHeight });
//           continue;
//         }

//         // Attempt to enqueue the block
//         if (!this.queue.enqueue(block)) {
//           // If unable to enqueue, return the block back to the array
//           this._loadedBlocks.push(block);
//           this.log.debug('Could not enqueue block. Returning block back to loadedBlocks.', { blockHeight: block.height }, this.constructor.name);
//           // Exit the loop since subsequent blocks have lower heights
//           break;
//         }
//       }
//     }
//   }
// }
