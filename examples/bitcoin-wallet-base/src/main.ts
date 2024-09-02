import { bootstrap } from '@el/bitcoin-wallet';

bootstrap({
  appName: 'easylayer',
}).catch((error: Error) => console.error(error));