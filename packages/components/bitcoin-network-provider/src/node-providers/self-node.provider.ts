import axios from 'axios';
import * as http from 'http';
import * as https from 'https';
import { BaseNodeProvider, BaseNodeProviderOptions } from './base-node-provider';
import { NodeProviderTypes, Hash } from './interfaces';

export interface SelfNodeProviderOptions extends BaseNodeProviderOptions {
  baseUrl: string;
  maxRequestContentLength?: number;
  responseTimeout?: number;
}

export const createSelfNodeProvider = (options: SelfNodeProviderOptions): SelfNodeProvider => {
  return new SelfNodeProvider(options);
};

export class SelfNodeProvider extends BaseNodeProvider<SelfNodeProviderOptions> {
  readonly type: NodeProviderTypes = 'selfnode';
  private _httpClient: any;
  private baseUrl: string;
  private maxRequestContentLength: number = 200 * 1024 * 1024;
  private responseTimeout: number = 5000;

  constructor(options: SelfNodeProviderOptions) {
    super(options);
    this.baseUrl = options.baseUrl;
    if (options.maxRequestContentLength) {
      this.maxRequestContentLength = options.maxRequestContentLength;
    }
    if (options.responseTimeout) {
      this.responseTimeout = options.responseTimeout;
    }
  }

  get connectionOptions() {
    return {
      type: this.type,
      uniqName: this.uniqName,
      baseUrl: this.baseUrl,
      maxRequestContentLength: this.maxRequestContentLength,
      responseTimeout: this.responseTimeout,
    };
  }

  public async connect() {
    this._httpClient = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Content-Type': 'application/json',
      },
      // keepAlive - Allows reuse of TCP connections.
      httpAgent: new http.Agent({ keepAlive: true }),
      httpsAgent: new https.Agent({ keepAlive: true }),
      timeout: this.responseTimeout,
      maxRedirects: 0,
      maxContentLength: this.maxRequestContentLength,
    });

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

  public async disconnect() {
    if (this._httpClient) {
      (this._httpClient.defaults.httpAgent as http.Agent)?.destroy();
      (this._httpClient.defaults.httpsAgent as https.Agent)?.destroy();
    }
  }

  public async getBlockHeight(): Promise<number> {
    try {
      const data = {
        jsonrpc: '2.0',
        method: 'getblockcount',
        id: 1,
      };
      const response = await this._httpClient.post('/', data);
      const blockHeight = response.data.result;
      return blockHeight;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNABORTED') {
          throw new Error(`The request timed out: ${error.message}`);
        }

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
        id: 1,
      };

      const response = await this._httpClient.post('/', data);
      const blockHash = response.data.result;
      return blockHash;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNABORTED') {
          throw new Error(`The request timed out: ${error.message}`);
        }

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
        id: 1,
      };

      const response = await this._httpClient.post('/', data);
      const block = response.data.result;
      return block;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.code === 'ECONNABORTED') {
          throw new Error(`The request timed out: ${error.message}`);
        }

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

  public async getManyBlocksByHashes(hashes: string[], verbosity: number = 1): Promise<any> {
    try {
      const requests = hashes.map((hash, index) => ({
        jsonrpc: '2.0',
        method: 'getblock',
        params: [hash, verbosity],
        id: index,
      }));

      const response = await this._httpClient.post('/', requests);

      // const contentLengthHeader = response.headers['content-length'];
      // console.log('axios response size', contentLengthHeader / 1048576);

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
        if (error.code === 'ECONNABORTED') {
          throw new Error(`The request timed out: ${error.message}`);
        }

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
        if (error.code === 'ECONNABORTED') {
          throw new Error(`The request timed out: ${error.message}`);
        }

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
        if (error.code === 'ECONNABORTED') {
          throw new Error(`The request timed out: ${error.message}`);
        }

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
    return blocks.filter((block: any) => block);
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
}
