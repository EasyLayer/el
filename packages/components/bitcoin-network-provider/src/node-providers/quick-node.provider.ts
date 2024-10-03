import { Readable } from 'node:stream';
import axios, { AxiosInstance } from 'axios';
import * as http from 'http';
import * as https from 'https';
import rateLimit from 'axios-rate-limit';
import { parser } from 'stream-json';
import StreamArray from 'stream-json/streamers/StreamArray';
import { BaseNodeProvider, BaseNodeProviderOptions } from './base-node-provider';
import { Hash, NodeProviderTypes } from './interfaces';

export interface QuickNodeProviderOptions extends BaseNodeProviderOptions {
  baseUrl: string;
  maxContentLength?: number;
}

export const createQuickNodeProvider = (options: QuickNodeProviderOptions): QuickNodeProvider => {
  return new QuickNodeProvider(options);
};

export class QuickNodeProvider extends BaseNodeProvider<QuickNodeProviderOptions> {
  private _httpClient!: AxiosInstance;
  readonly type: NodeProviderTypes = 'quicknode';
  baseUrl!: string;
  maxContentLength: number = 200 * 1024 * 1024; // TODO: move to envs

  constructor(options: QuickNodeProviderOptions) {
    super(options);
    this.baseUrl = options.baseUrl;
    if (options.maxContentLength) {
      this.maxContentLength = options.maxContentLength;
    }
  }

  get connectionOptions() {
    return {
      type: this.type,
      uniqName: this.uniqName,
      baseUrl: this.baseUrl,
    };
  }

  public async connect() {
    this._httpClient = rateLimit(
      axios.create({
        baseURL: this.connectionOptions.baseUrl,
        headers: {
          'Content-Type': 'application/json',
        },
        // TODO: add to envs
        // TODO: we must also compare these values ​​with the number of workers and batches
        // keepAlive - Allows reuse of TCP connections.
        httpAgent: new http.Agent({ keepAlive: true }),
        httpsAgent: new https.Agent({ keepAlive: true }),
        timeout: 20000,
      }),
      { maxRequests: 15, perMilliseconds: 1000 }
    );

    const health = await this.healthcheck();
    if (!health) {
      throw new Error('Cant connect');
    }
  }

  public async healthcheck(): Promise<boolean> {
    try {
      const response = await this._httpClient.post('/', {
        jsonrpc: '2.0',
        method: 'getblockchaininfo',
        params: [],
        id: 1,
      });

      return response.status === 200 && response.data.result !== undefined;
    } catch (error) {
      return false;
    }
  }

  public async disconnect() {}

  public async getBlockHeight(): Promise<number> {
    try {
      const data = {
        jsonrpc: '2.0',
        method: 'getblockcount',
      };

      const response = await this._httpClient.post('/', data);
      const blockHeight = response.data.result;
      return Number(blockHeight);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response) {
          throw new Error(`Error: ${error.response.data}`);
        } else if (error.request) {
          throw new Error('No response received from server');
        } else {
          throw new Error(error.message);
        }
      }

      throw error;
    }
  }

  public async getOneBlockHashByHeight(height: number): Promise<Hash> {
    try {
      const data = {
        jsonrpc: '2.0',
        method: 'getblockhash',
        params: [height],
      };

      const response = await this._httpClient.post('/', data);
      const blockHash = response.data.result;
      return blockHash;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response) {
          throw new Error(
            `Server responded with status ${error.response.status}: ${JSON.stringify(error.response.data)}`
          );
        } else if (error.request) {
          throw new Error('No response received from server');
        } else {
          throw new Error(`Error during request setup: ${error.message}`);
        }
      }

      throw error;
    }
  }

  public async getOneBlockByHash(hash: Hash, verbosity: number = 1): Promise<any> {
    try {
      const data = {
        jsonrpc: '2.0',
        method: 'getblock',
        params: [hash, verbosity],
      };

      const response = await this._httpClient.post('/', data);
      const block = response.data.result;
      return block;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response) {
          throw new Error(
            `Server responded with status ${error.response.status}: ${JSON.stringify(error.response.data)}`
          );
        } else if (error.request) {
          throw new Error('No response received from server');
        } else {
          throw new Error(`Error during request setup: ${error.message}`);
        }
      }

      throw error;
    }
  }

  public async getOneBlockByHeight(height: number, verbosity?: number): Promise<any> {
    const blockHash = await this.getOneBlockHashByHeight(height);
    const block = await this.getOneBlockByHash(blockHash, verbosity);
    return block;
  }

  public async getOneTransactionByHash(hash: Hash): Promise<any> {
    try {
      const data = {
        jsonrpc: '2.0',
        method: 'getrawtransaction',
        params: [hash, 2], //1
      };

      const response = await this._httpClient.post('/', data);
      const block = response.data.result;
      return block;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response) {
          throw new Error(
            `Server responded with status ${error.response.status}: ${JSON.stringify(error.response.data)}`
          );
        } else if (error.request) {
          throw new Error('No response received from server');
        } else {
          throw new Error(`Error during request setup: ${error.message}`);
        }
      }

      throw error;
    }
  }

  public async getManyTransactionsByHashes(hashes: Hash[], verbosity?: number): Promise<any> {
    const transactions = [];

    for (const hash of hashes) {
      const tx = await this.getOneBlockByHash(hash, verbosity);
      transactions.push(tx);
    }

    return transactions;
  }

  public async getManyBlocksByHashes(hashes: string[], verbosity: number = 1): Promise<any> {
    try {
      const requests = hashes.map((hash, index) => ({
        jsonrpc: '2.0',
        method: 'getblock',
        params: [hash, verbosity],
        id: index,
      }));

      const response = await this._httpClient.post('/', requests);

      if (!response || !response.data || !Array.isArray(response.data)) {
        throw new Error('Invalid response structure: response data is missing or not an array');
      }

      const results = response.data.map((item: any) => {
        if (!item) {
          throw new Error(`Invalid response item: ${JSON.stringify(item)}`);
        }

        if (item.error) {
          throw new Error(`Invalid result: ${JSON.stringify(item.error)}`);
        }

        if (item.result === null) {
          throw new Error(`Null result for item: ${JSON.stringify(item)}`);
        }

        return item.result;
      });

      return results;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response) {
          throw new Error(
            `Server responded with status ${error.response.status}: ${JSON.stringify(error.response.data)}`
          );
        } else if (error.request) {
          throw new Error('No response received from server');
        } else {
          throw new Error(`Error during request setup: ${error.message}`);
        }
      }

      throw error;
    }
  }

  public async getManyHashesByHeights(heights: number[]): Promise<any> {
    try {
      const requests = heights.map((height, index) => ({
        jsonrpc: '2.0',
        method: 'getblockhash',
        params: [height],
        id: index,
      }));

      const response = await this._httpClient.post('/', requests);

      if (!response || !response.data || !Array.isArray(response.data)) {
        throw new Error('Invalid response structure: response data is missing or not an array');
      }

      const results = response.data.map((item: any) => {
        if (!item) {
          throw new Error(`Invalid response item: ${JSON.stringify(item)}`);
        }

        if (item.error) {
          throw new Error(`Invalid result: ${JSON.stringify(item.error)}`);
        }

        if (item.result === null) {
          throw new Error(`Null result for item: ${JSON.stringify(item)}`);
        }

        return item.result;
      });

      return results;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response) {
          throw new Error(
            `Server responded with status ${error.response.status}: ${JSON.stringify(error.response.data)}`
          );
        } else if (error.request) {
          throw new Error('No response received from server');
        } else {
          throw new Error(`Error during request setup: ${error.message}`);
        }
      }

      throw error;
    }
  }

  public async getManyBlocksStatsByHashes(hashes: string[]): Promise<any> {
    try {
      const requests = hashes.map((hash, index) => ({
        jsonrpc: '2.0',
        method: 'getblockstats',
        params: [hash],
        id: index,
      }));

      const response = await this._httpClient.post('/', requests);

      if (!response || !response.data || !Array.isArray(response.data)) {
        throw new Error('Invalid response structure: response data is missing or not an array');
      }

      const results = response.data.map((item: any) => {
        if (!item) {
          throw new Error(`Invalid response item: ${JSON.stringify(item)}`);
        }

        if (item.error) {
          throw new Error(`Invalid result: ${JSON.stringify(item.error)}`);
        }

        if (item.result === null) {
          throw new Error(`Null result for item: ${JSON.stringify(item)}`);
        }

        return item.result;
      });

      return results;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response) {
          throw new Error(
            `Server responded with status ${error.response.status}: ${JSON.stringify(error.response.data)}`
          );
        } else if (error.request) {
          throw new Error('No response received from server');
        } else {
          throw new Error(`Error during request setup: ${error.message}`);
        }
      }

      throw error;
    }
  }

  public async getManyBlocksByHeights(heights: number[], verbosity?: number): Promise<any> {
    const blocksHashes = await this.getManyHashesByHeights(heights);
    const blocks = await this.getManyBlocksByHashes(blocksHashes, verbosity);
    return blocks;
  }

  public async getManyBlocksStatsByHeights(heights: number[]): Promise<any> {
    const genesisHeight = 0;
    // Check if genesis block is included in the request
    const hasGenesis = heights.includes(genesisHeight);

    if (hasGenesis) {
      // Dynamically fetch the genesis block hash using height 0
      const genesisHash = await this.getOneBlockHashByHeight(genesisHeight);

      const filteredHeights = heights.filter((height) => height !== genesisHeight);
      const blocksHashes = await this.getManyHashesByHeights(filteredHeights);
      const blocks = await this.getManyBlocksStatsByHashes(blocksHashes);

      // Create a mock object for the genesis block with required fields
      const genesisMock = {
        blockhash: genesisHash,
        total_size: 0,
        height: genesisHeight,
      };

      return [genesisMock, ...blocks.filter((block: any) => block)];
    } else {
      // If genesis block is not included, process all heights normally

      // Fetch hashes for all requested heights
      const blocksHashes = await this.getManyHashesByHeights(heights);

      // Fetch stats for all fetched hashes
      const blocks = await this.getManyBlocksStatsByHashes(blocksHashes);

      // Filter out any undefined or null block stats
      return blocks.filter((block: any) => block);
    }
  }

  public async createWebhookStream(streamConfig: any): Promise<any> {
    try {
      const response = await this._httpClient.post('/streams', streamConfig);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response) {
          throw new Error(
            `Server responded with status ${error.response.status}: ${JSON.stringify(error.response.data)}`
          );
        } else if (error.request) {
          throw new Error('No response received from server');
        } else {
          throw new Error(`Error during request setup: ${error.message}`);
        }
      }

      throw error;
    }
  }

  public async deleteWebhookStream(streamId: string): Promise<any> {
    try {
      const response = await this._httpClient.delete(`/streams/${streamId}`);
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response) {
          throw new Error(`Error: ${error.response.data}`);
        } else if (error.request) {
          throw new Error('No response received from server');
        } else {
          throw new Error(error.message);
        }
      }

      throw error;
    }
  }

  public async handleWebhookStream({
    stream,
    onDataCallback,
    onFinishCallback,
    onErrorCallback,
  }: {
    stream: Readable;
    onDataCallback: (block: any) => Promise<void>;
    onFinishCallback: () => void;
    onErrorCallback: (error: any) => void;
  }): Promise<NodeJS.ReadWriteStream> {
    return new Promise((resolve, reject) => {
      const jsonParser = parser();

      const jsonStream = stream.pipe(jsonParser).pipe(new StreamArray());

      jsonStream.on('data', async ({ value }) => {
        try {
          await onDataCallback(value);
        } catch (error) {
          onErrorCallback(error);
        }
      });

      jsonStream.on('end', () => {
        onFinishCallback();
        resolve(jsonStream);
      });

      jsonStream.on('error', (error: any) => {
        onErrorCallback(error);
        reject(error);
      });
    });
  }
}
