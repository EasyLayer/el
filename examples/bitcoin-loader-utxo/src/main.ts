import { bootstrap } from '@el/bitcoin-loader';
import { OutputSchema, InputSchema } from './models';
import { Mapper } from './mapper';

bootstrap({
  appName: 'easylayer',
  schemas: [OutputSchema, InputSchema],
  mapper: Mapper,
  isServer: true
}).catch((error: Error) => console.error(error));