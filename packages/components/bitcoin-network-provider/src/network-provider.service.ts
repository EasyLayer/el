import { Injectable } from '@nestjs/common';
import { AppLogger, RuntimeTracker } from '@easylayer/components/logger';
import { ConnectionManager } from './connection-manager';
import { Hash } from './node-providers';

@Injectable()
export class NetworkProviderService {
  constructor(
    private readonly log: AppLogger,
    private readonly _connectionManager: ConnectionManager
  ) {}

  get connectionManager() {
    return this._connectionManager;
  }

  public async getCurrentBlockHeight(): Promise<number> {
    try {
      const provider = await this._connectionManager.getActiveProvider();
      return await provider.getBlockHeight();
    } catch (error) {
      this.log.error('getCurrentBlockHeight()', error, this.constructor.name);
      throw error;
    }
  }

  public async getOneBlockHashByHeight(height: string | number): Promise<any> {
    try {
      const provider = await this._connectionManager.getActiveProvider();
      return await provider.getOneBlockHashByHeight(Number(height));
    } catch (error) {
      this.log.error('getOneBlockHashByHeight()', error, this.constructor.name);
      throw error;
    }
  }

  public async getOneBlockByHeight(height: string | number, verbosity?: number): Promise<any> {
    try {
      const provider = await this._connectionManager.getActiveProvider();
      return await provider.getOneBlockByHeight(Number(height), verbosity);
    } catch (error) {
      this.log.error('getOneBlockByHeight()', error, this.constructor.name);
      throw error;
    }
  }

  @RuntimeTracker({ showMemory: false, warningThresholdMs: 1000, errorThresholdMs: 5000 })
  public async getManyBlocksByHeights(heights: string[] | number[], verbosity?: number): Promise<any> {
    try {
      const provider = await this._connectionManager.getActiveProvider();
      const blocks = await provider.getManyBlocksByHeights(
        heights.map((item) => Number(item)),
        verbosity
      );
      return blocks.filter((block: any) => block);
    } catch (error) {
      this.log.error('getManyBlocksByHeights()', error, this.constructor.name);
      throw error;
    }
  }

  public async getOneBlockByHash(hash: string | Hash, verbosity?: number): Promise<any> {
    try {
      const provider = await this._connectionManager.getActiveProvider();
      // TODO: add method transform into Hash
      return await provider.getOneBlockByHash(hash as Hash, verbosity);
    } catch (error) {
      this.log.error('getOneBlockByHash()', error, this.constructor.name);
      throw error;
    }
  }

  public async getManyBlocksByHashes(hashes: string[] | Hash[], verbosity?: number): Promise<any> {
    try {
      const provider = await this._connectionManager.getActiveProvider();
      // TODO: add method transform into Hash
      return await provider.getManyBlocksByHashes(hashes as Hash[], verbosity);
    } catch (error) {
      this.log.error('getManyBlocksByHashes()', error, this.constructor.name);
      throw error;
    }
  }

  public async getOneTransactionByHash(hash: string | Hash): Promise<any> {
    try {
      const provider = await this._connectionManager.getActiveProvider();
      // TODO: add method transform into Hash
      return await provider.getOneTransactionByHash(hash as Hash);
    } catch (error) {
      this.log.error('getOneTransactionByHash()', error, this.constructor.name);
      throw error;
    }
  }

  public async getManyTransactionsByHashes(hashes: string[] | Hash[]): Promise<any> {
    try {
      const provider = await this._connectionManager.getActiveProvider();
      // TODO: add method transform into Hash
      return await provider.getManyTransactionsByHashes(hashes as Hash[]);
    } catch (error) {
      this.log.error('getManyTransactionsByHashes()', error, this.constructor.name);
      throw error;
    }
  }
}
