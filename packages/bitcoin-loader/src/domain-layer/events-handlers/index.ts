import { BitcoinLoaderBlocksIndexedEventHandler } from './blocks-indexed.event-handler';
import { BitcoinLoaderReorganisationProcessedEventHandler } from './reorganisation-processed.event-handler';
import { BitcoinLoaderInitializedEventHandler } from './loader-initialized.event-handler';

export const EventsHandlers = [
  BitcoinLoaderBlocksIndexedEventHandler,
  BitcoinLoaderReorganisationProcessedEventHandler,
  BitcoinLoaderInitializedEventHandler,
];
