// import { v4 as uuidv4 } from 'uuid';
import { Injectable } from '@nestjs/common';
import { CommandBus } from '@el/components/cqrs';
import { HandleBatchCommand } from '@el/common/domain-cqrs-components/bitcoin-listener';

@Injectable()
export class BlocksCommandFactoryService {
  constructor(private readonly commandBus: CommandBus) {}

  public async handleBatch(dto: any): Promise<void> {
    await this.commandBus.execute(new HandleBatchCommand({ ...dto }));
  }
}
