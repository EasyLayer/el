import { BitcoinLoaderBlocksIndexedEventHandler } from './blocks-indexed.event-handler';
import { BitcoinLoaderReorganisationFinishedEventHandler } from './reorganisation-finished.event-handler';
import { BitcoinLoaderInitializedEventHandler } from './loader-initialized.event-handler';

export const EventsHandlers = [
  BitcoinLoaderBlocksIndexedEventHandler,
  BitcoinLoaderReorganisationFinishedEventHandler,
  BitcoinLoaderInitializedEventHandler,
];
