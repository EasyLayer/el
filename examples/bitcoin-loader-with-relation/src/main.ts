import { bootstrap } from '@el/bitcoin-loader';
import { BlockSchema, TransactionSchema } from './models';
import { Mapper } from './mapper';

bootstrap({
  appName: 'easylayer',
  schemas: [BlockSchema, TransactionSchema],
  mapper: Mapper,
  isServer: true
}).catch((error: Error) => console.error(error));