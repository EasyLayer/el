import { v4 as uuidv4 } from 'uuid';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { AppLogger } from '@easylayer/components/logger';
import { LoaderCommandFactoryService } from './application-layer/services';
import { ViewsReadRepositoryService } from './infrastructure-layer/services';
import { BusinessConfig } from './config';

@Injectable()
export class LoaderService implements OnModuleInit {
  constructor(
    private readonly log: AppLogger,
    private readonly businessConfig: BusinessConfig,
    private readonly loaderCommandFactory: LoaderCommandFactoryService,
    private readonly viewsReadRepository: ViewsReadRepositoryService
  ) {}

  async onModuleInit() {
    await this.initialization();
  }

  private async initialization(): Promise<void> {
    this.log.info('Initialization all systems');

    try {
      const lastReadStateHeight = await this.viewsReadRepository.getLastBlock();

      await this.loaderCommandFactory.init({
        requestId: uuidv4(),
        startHeight: this.businessConfig.BITCOIN_LOADER_START_BLOCK_HEIGHT,
        lastReadStateHeight,
      });
    } catch (error) {
      this.log.error('initialization()', error, this.constructor.name);
      throw error;
    }
  }
}
