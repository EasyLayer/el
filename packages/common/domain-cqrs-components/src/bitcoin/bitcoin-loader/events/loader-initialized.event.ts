import { BasicEvent } from '../../../base.event';

interface BitcoinLoaderInitializedEventPayload {
  aggregateId: string;
  requestId: string;
  status: string;
  indexedHeight: string;
  restoreBlocks: string[];
}

export class BitcoinLoaderInitializedEvent implements BasicEvent<BitcoinLoaderInitializedEventPayload> {
  constructor(public readonly payload: BitcoinLoaderInitializedEventPayload) {}
}
