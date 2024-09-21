import { Test, TestingModule } from '@nestjs/testing';
import { AppLogger } from '@easylayer/components/logger';
import { BlocksQueueService } from '../blocks-queue.service';
import { BlocksQueue } from '../blocks-queue';
import { Block } from '../interfaces';
import { BlocksQueueIteratorService } from '../blocks-iterator';
import { BlocksQueueLoaderService } from '../blocks-loader';
import { BlocksQueueCollectorService } from '../blocks-collector';

describe('BlocksQueueService', () => {
  let service: BlocksQueueService;
  let mockLogger: jest.Mocked<AppLogger>;
  let mockBlocksIterator: jest.Mocked<BlocksQueueIteratorService>;
  let mockBlocksLoader: jest.Mocked<BlocksQueueLoaderService>;
  let mockBlocksCollectorService: jest.Mocked<BlocksQueueCollectorService>;
  let mockBlockQueue: jest.Mocked<BlocksQueue<Block>>;
  let config: { maxQueueLength: number; maxBlockHeight: number };

  beforeEach(async () => {
    mockLogger = {
      debug: jest.fn(),
      error: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
    } as any;

    mockBlocksIterator = {
      startQueueIterating: jest.fn(),
      resolveNextBatch: jest.fn(),
    } as any;

    mockBlocksLoader = {
      startBlocksLoading: jest.fn(),
    } as any;

    mockBlocksCollectorService = {
      init: jest.fn(),
    } as any;

    // Initialize the mockBlockQueue without directly assigning to read-only properties
    mockBlockQueue = {
      enqueue: jest.fn(),
      dequeue: jest.fn(),
      reorganize: jest.fn(),
      findBlocks: jest.fn(),
      inStack: [],
      outStack: [],
      length: 0,
      maxQueueLength: 0,
      maxBlockHeight: 0,
    } as any;

    config = { maxQueueLength: 1000, maxBlockHeight: 1000000 };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        { provide: AppLogger, useValue: mockLogger },
        { provide: BlocksQueueIteratorService, useValue: mockBlocksIterator },
        { provide: BlocksQueueLoaderService, useValue: mockBlocksLoader },
        { provide: BlocksQueueCollectorService, useValue: mockBlocksCollectorService },
        { provide: 'CONFIG', useValue: config },
        {
          provide: BlocksQueueService,
          useFactory: (
            logger: AppLogger,
            iterator: BlocksQueueIteratorService,
            loader: BlocksQueueLoaderService,
            collector: BlocksQueueCollectorService,
            config: any
          ) => new BlocksQueueService(logger, iterator, loader, collector, config),
          inject: [
            AppLogger,
            BlocksQueueIteratorService,
            BlocksQueueLoaderService,
            BlocksQueueCollectorService,
            'CONFIG',
          ],
        },
      ],
    }).compile();

    service = module.get<BlocksQueueService>(BlocksQueueService);

    // Assign the mocked block queue to the service
    service['_blockQueue'] = mockBlockQueue;
  });

  describe('start', () => {
    it('should initialize and start loading and iterating', () => {
      const indexedHeight = 100;
      service['init'] = jest.fn(); // Mock the init method

      service.start(indexedHeight);

      expect(service['init']).toHaveBeenCalledWith(indexedHeight);
      expect(mockBlocksLoader.startBlocksLoading).toHaveBeenCalledWith(mockBlockQueue);
      expect(mockBlocksIterator.startQueueIterating).toHaveBeenCalledWith(mockBlockQueue);
    });
  });

  describe('reorganizeBlocks', () => {
    it('should reorganize the queue and resolve the next batch', async () => {
      mockBlockQueue.reorganize = jest.fn();
      const newStartHeight = 200;

      await service.reorganizeBlocks(newStartHeight);

      expect(mockBlockQueue.reorganize).toHaveBeenCalledWith(Number(newStartHeight));
      expect(mockBlocksIterator.resolveNextBatch).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Queue was clear to height: ',
        { newStartHeight },
        service.constructor.name
      );
    });
  });

  describe('queue', () => {
    it('should return the block queue', () => {
      expect(service.queue).toBe(mockBlockQueue);
    });
  });

  describe('blocksCollector', () => {
    it('should return the blocks collector service', () => {
      expect(service.blocksCollector).toBe(mockBlocksCollectorService);
    });
  });
});
