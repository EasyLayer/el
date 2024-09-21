// // import { v4 as uuidv4 } from 'uuid';
// import { INestApplicationContext } from '@nestjs/common';
// import { NestFactory } from '@nestjs/core';
// import {
//   NetworkProviderModule,
//   NetworkProviderService,
//   ProviderNodeOptions,
//   ProviderOptions,
// } from '@easylayer/components/bitcoin-network-provider';

// class ApplicationContextProvider {
//   private static appContext: INestApplicationContext | null;

//   // NOTE: A private constructor prevents the creation of a new instance of a class from outside
//   private constructor() {}

//   public static async getApplicationContext(providers: ProviderOptions[]): Promise<INestApplicationContext> {
//     if (!this.appContext) {
//       this.appContext = await NestFactory.createApplicationContext(
//         NetworkProviderModule.forRootAsync({
//           providers,
//         }),
//         { logger: false }
//       );
//     }

//     return this.appContext;
//   }

//   public static async closeApplicationContext(): Promise<void> {
//     if (this.appContext) {
//       await this.appContext.close();
//       this.appContext = null;
//     }
//   }
// }

// export const loadBlock = async ({
//   startHeight,
//   batchLength,
//   providersConnectionOptions
// }: {
//   startHeight: number;
//   batchLength: number;
//   providersConnectionOptions: ProviderNodeOptions[];
// }) => {
//   try {
//     const providers = providersConnectionOptions.map((connection: ProviderNodeOptions) => ({ connection }));

//     const appContext = await ApplicationContextProvider.getApplicationContext(providers);

//     const bitcoinService = appContext.get(NetworkProviderService);

//     // Generate an array of block heights to load
//     const heights: number[] = [];
//     for (let i = 0; i < batchLength; i++) {
//       heights.push(startHeight + i);
//     }

//     // IMPORTANT: '2' means get block with all transactions objects
//     const blocks = await bitcoinService.getManyBlocksByHeights(heights, 2);
//     return blocks;
//   } catch (error) {
//     throw error;
//   }
// };

// process.on('SIGTERM', async () => {
//   await ApplicationContextProvider.closeApplicationContext();
//   process.exit(0);
// });

// process.on('SIGINT', async () => {
//   await ApplicationContextProvider.closeApplicationContext();
//   process.exit(0);
// });
