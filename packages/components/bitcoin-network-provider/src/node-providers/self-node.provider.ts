import * as http from 'node:http';
import * as https from 'node:https';
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
  private baseUrl: string;
  private maxRequestContentLength: number = 200 * 1024 * 1024;
  private responseTimeout: number = 5000;
  private agent: http.Agent | https.Agent;
  private username?: string;
  private password?: string;

  constructor(options: SelfNodeProviderOptions) {
    super(options);

    // Parse the baseUrl to extract username and password
    const url = new URL(options.baseUrl);
    this.username = url.username || undefined;
    this.password = url.password || undefined;

    // Remove username and password from baseUrl
    url.username = '';
    url.password = '';
    this.baseUrl = url.toString();

    if (options.maxRequestContentLength) {
      this.maxRequestContentLength = options.maxRequestContentLength;
    }
    if (options.responseTimeout) {
      this.responseTimeout = options.responseTimeout;
    }

    // Determine whether to use HTTP or HTTPS, and create the appropriate agent
    const isHttps = this.baseUrl.startsWith('https://');
    this.agent = isHttps ? new https.Agent({ keepAlive: true }) : new http.Agent({ keepAlive: true });
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
    const health = await this.healthcheck();
    if (!health) {
      throw new Error('Cannot connect to the node');
    }
  }

  public async healthcheck(): Promise<boolean> {
    try {
      const response = await this._fetch('/', {
        method: 'POST',
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'getblockchaininfo',
          params: [],
          id: 1,
        }),
      });

      const data = (await response.json()) as { result?: any; error?: any };
      return response.ok && data.result !== undefined;
    } catch (error) {
      console.error('Healthcheck failed:', error);
      return false;
    }
  }

  public async disconnect() {
    if (this.agent) {
      this.agent.destroy();
    }
  }

  private async _fetch(path: string, options: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
    }, this.responseTimeout);

    // Create an instance of Headers
    const headers = new Headers();

    headers.set('Content-Type', 'application/json');

    // Add additional headers from options.headers if any
    if (options.headers) {
      const optionHeaders = options.headers;

      if (optionHeaders instanceof Headers) {
        optionHeaders.forEach((value, key) => {
          headers.append(key, value);
        });
      } else if (Array.isArray(optionHeaders)) {
        optionHeaders.forEach(([key, value]) => {
          headers.append(key, value);
        });
      } else {
        Object.entries(optionHeaders).forEach(([key, value]) => {
          headers.append(key, value as string);
        });
      }
    }

    // Add Authorization header if username and password are provided
    if (this.username && this.password) {
      const auth = Buffer.from(`${this.username}:${this.password}`).toString('base64');
      headers.set('Authorization', `Basic ${auth}`);
    }

    const requestOptions: RequestInit = {
      ...options,
      headers,
      // Specify the agent only if it exists
      ...(this.agent && { agent: this.agent }),
      signal: controller.signal,
    };

    try {
      // Use URL constructor to correctly join baseUrl and path
      const fullUrl = new URL(path, this.baseUrl).toString();
      const response = await fetch(fullUrl, requestOptions);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! Status: ${response.status}, ${errorText}`);
      }

      return response;
    } catch (error: any) {
      if (error.name === 'AbortError') {
        throw new Error(`The request timed out after ${this.responseTimeout} ms`);
      } else {
        throw error;
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  private _handleError(error: any): never {
    if (error.name === 'AbortError') {
      throw new Error(`The request timed out after ${this.responseTimeout} ms`);
    } else if (error instanceof Error) {
      throw error;
    } else {
      throw new Error('An unknown error occurred');
    }
  }

  public async getBlockHeight(): Promise<number> {
    try {
      const data = {
        jsonrpc: '2.0',
        method: 'getblockcount',
        params: [],
        id: 1,
      };
      const response = await this._fetch('/', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      const result = (await response.json()) as { result?: number; error?: any };

      if (result.error) {
        throw new Error(`Error from server: ${JSON.stringify(result.error)}`);
      }

      if (result.result === undefined) {
        throw new Error('No result returned from server');
      }

      return result.result;
    } catch (error) {
      this._handleError(error);
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

      const response = await this._fetch('/', {
        method: 'POST',
        body: JSON.stringify(data),
      });

      const result = (await response.json()) as { result?: Hash; error?: any };

      if (result.error) {
        throw new Error(`Error from server: ${JSON.stringify(result.error)}`);
      }

      if (result.result === undefined) {
        throw new Error('No result returned from server');
      }

      return result.result;
    } catch (error) {
      this._handleError(error);
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

      const response = await this._fetch('/', {
        method: 'POST',
        body: JSON.stringify(data),
      });

      const result = (await response.json()) as { result?: any; error?: any };

      if (result.error) {
        throw new Error(`Error from server: ${JSON.stringify(result.error)}`);
      }

      if (result.result === undefined) {
        throw new Error('No result returned from server');
      }

      return result.result;
    } catch (error) {
      this._handleError(error);
    }
  }

  public async getOneBlockByHeight(height: number, verbosity?: number): Promise<any> {
    const blockHash = await this.getOneBlockHashByHeight(height);
    const block = await this.getOneBlockByHash(blockHash, verbosity);
    return block;
  }

  public async getManyBlocksByHashes(hashes: string[], verbosity: number = 1): Promise<any[]> {
    try {
      const requests = hashes.map((hash, index) => ({
        jsonrpc: '2.0',
        method: 'getblock',
        params: [hash, verbosity],
        id: index,
      }));

      const response = await this._fetch('/', {
        method: 'POST',
        body: JSON.stringify(requests),
      });

      const result = (await response.json()) as Array<{ result?: any; error?: any }>;

      if (!Array.isArray(result)) {
        throw new Error('Invalid response structure: response data is not an array');
      }

      const results = result.map((item) => {
        if (item.error) {
          throw new Error(`Error from server: ${JSON.stringify(item.error)}`);
        }

        if (item.result === undefined) {
          throw new Error('No result returned from server');
        }

        return item.result;
      });

      return results;
    } catch (error) {
      this._handleError(error);
    }
  }

  public async getManyBlocksStatsByHashes(hashes: string[]): Promise<any[]> {
    try {
      const requests = hashes.map((hash, index) => ({
        jsonrpc: '2.0',
        method: 'getblockstats',
        params: [hash],
        id: index,
      }));

      const response = await this._fetch('/', {
        method: 'POST',
        body: JSON.stringify(requests),
      });

      const result = (await response.json()) as Array<{ result?: any; error?: any }>;

      if (!Array.isArray(result)) {
        throw new Error('Invalid response structure: response data is not an array');
      }

      const results = result.map((item) => {
        if (item.error) {
          throw new Error(`Error from server: ${JSON.stringify(item.error)}`);
        }

        if (item.result === undefined) {
          throw new Error('No result returned from server');
        }

        return item.result;
      });

      return results;
    } catch (error) {
      this._handleError(error);
    }
  }

  public async getManyHashesByHeights(heights: number[]): Promise<string[]> {
    try {
      const requests = heights.map((height, index) => ({
        jsonrpc: '2.0',
        method: 'getblockhash',
        params: [height],
        id: index,
      }));

      const response = await this._fetch('/', {
        method: 'POST',
        body: JSON.stringify(requests),
      });

      const result = (await response.json()) as Array<{ result?: string; error?: any }>;

      if (!Array.isArray(result)) {
        throw new Error('Invalid response structure: response data is not an array');
      }

      const results = result.map((item) => {
        if (item.error) {
          throw new Error(`Error from server: ${JSON.stringify(item.error)}`);
        }

        if (item.result === undefined) {
          throw new Error('No result returned from server');
        }

        return item.result;
      });

      return results;
    } catch (error) {
      this._handleError(error);
    }
  }

  public async getManyBlocksByHeights(heights: number[], verbosity?: number): Promise<any[]> {
    const blocksHashes = await this.getManyHashesByHeights(heights);
    const blocks = await this.getManyBlocksByHashes(blocksHashes, verbosity);
    return blocks.filter((block: any) => block);
  }

  public async getManyBlocksStatsByHeights(heights: number[]): Promise<any[]> {
    const genesisHeight = 0;
    // Check if genesis block is included in the request
    const hasGenesis = heights.includes(genesisHeight);

    if (hasGenesis) {
      // Fetch the genesis block hash using height 0
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
