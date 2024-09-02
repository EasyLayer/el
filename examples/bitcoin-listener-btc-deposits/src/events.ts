import { BlockchainEvent } from '@el/bitcoin-listener';

export class DepositEvent implements BlockchainEvent {
  type: string = 'deposit';
  data: any;

  constructor(data: any) {
    this.data = data;
  }
}
