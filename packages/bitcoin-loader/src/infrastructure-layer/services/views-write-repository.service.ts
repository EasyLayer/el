import { Injectable } from '@nestjs/common';
import { InjectDataSource, DataSource, Repository } from '@easylayer/components/views-rdbms-db';
import { AppLogger } from '@easylayer/components/logger';
import { ReadDatabaseConfig } from '../../config';

@Injectable()
export class ViewsWriteRepositoryService {
  // Queue of operations: stores entityName, method, and operation data
  private operations: Array<{ entityName: string; method: string; data: any[] }> = [];

  constructor(
    @InjectDataSource('loader-views')
    private readonly datasource: DataSource,
    private readonly config: ReadDatabaseConfig,
    private readonly log: AppLogger
  ) {}

  /**
   * Retrieves the repository for a specific entity from the datasource
   */
  private getRepository<T extends object>(entityName: string): Repository<T> {
    const entityMetadata = this.datasource.entityMetadatas.find(
      (metadata) =>
        metadata.tableName === entityName || metadata.targetName === entityName || metadata.target === entityName
    );

    if (!entityMetadata) {
      throw new Error(`Entity with name "${entityName}" not found.`);
    }

    return this.datasource.getRepository<T>(entityMetadata.target);
  }

  /**
   * Processes the models by extracting their operations history and adding those operations
   * to the internal queue (this.operations).
   */
  public process(models: Array<{ getOperationsHistory: () => Array<{ method: string; params: any }> }> = []): void {
    models.forEach((model) => {
      const entityName = model.constructor.name;
      const operationsHistory = model.getOperationsHistory();

      for (const operation of operationsHistory) {
        const { method, params } = operation;
        this.addOperation(entityName, method, params);
      }
    });
  }

  /**
   * Adds an operation (insert, update, delete) to the operations queue.
   * For `delete`, it accumulates different conditions into a single operation.
   * For `update`, it groups operations by values and accumulates conditions.
   */
  private addOperation(entityName: string, method: string, params: any): void {
    let existingOperation = this.operations.find((op) => op.entityName === entityName && op.method === method);

    if (!existingOperation) {
      existingOperation = { entityName, method, data: [] };
      if (method === 'delete' || method === 'update') {
        this.operations.unshift(existingOperation); // Prioritize delete and update operations
      } else {
        this.operations.push(existingOperation); // Add other operations to the end
      }
    }

    if (method === 'delete') {
      // Accumulate different conditions for batch deletion
      existingOperation.data.push(params);
    } else if (method === 'update') {
      // For updates, group by the same values and accumulate conditions
      const existingUpdate = existingOperation.data.find(
        (op) => JSON.stringify(op.values) === JSON.stringify(params.values)
      );

      if (existingUpdate) {
        // If values match, merge conditions
        existingUpdate.conditions.push(params.conditions);
      } else {
        // Otherwise, add new update entry with values and conditions
        existingOperation.data.push({ values: params.values, conditions: [params.conditions] });
      }
    } else {
      // For other operations (e.g., insert), just add the params
      existingOperation.data.push(params);
    }
  }

  /**
   * Commits all queued operations to the database.
   * Supports batch inserts and handles each operation sequentially.
   */
  public async commit(): Promise<void> {
    if (this.operations.length === 0) {
      throw new Error('No operations to commit');
    }

    const batchSize = this.config.BITCOIN_LOADER_READ_DB_INSERT_CHANKS_LIMIT;

    try {
      for (const operation of this.operations) {
        const { entityName, method, data } = operation;

        if (method === 'insert' && data.length > batchSize) {
          const chunkedBatches = this.chunkArray(data, batchSize);
          for (const chunk of chunkedBatches) {
            await this.executeOperation(method, entityName, chunk);
          }
        } else {
          await this.executeOperation(method, entityName, data);
        }
      }

      this.clearOperations();
    } catch (error) {
      this.clearOperations();
      throw error;
    }
  }

  /**
   * Executes a specific operation (insert, update, delete) for the given entity.
   * Handles batch operations for insert, and executes individual updates and deletes based on conditions.
   */
  public async executeOperation(method: string, entityName: string, data: any[]): Promise<void> {
    switch (method) {
      case 'insert':
        await this.insert(entityName, data);
        break;
      case 'update':
        for (const update of data) {
          await this.update(entityName, update); // Each update has grouped values and conditions
        }
        break;
      case 'delete':
        await this.delete(entityName, data); // For delete, handle batch deletion with accumulated conditions
        break;
      default:
        throw new Error(`Unknown method: ${method}`);
    }
  }

  /**
   * Inserts data into the repository in bulk.
   * Uses 'orIgnore' to avoid conflicts and prevent duplicate records.
   */
  public async insert(entityName: string, values: any[]): Promise<void> {
    const repo = this.getRepository(entityName);
    await repo.createQueryBuilder().insert().values(values).orIgnore().updateEntity(false).execute();
  }

  /**
   * Updates records in the repository based on conditions.
   * Groups conditions for the same values and applies them in a single query.
   */
  public async update(
    entityName: string,
    params: { values: Record<string, any>; conditions?: Record<string, any>[] }
  ): Promise<any> {
    const repo = this.getRepository(entityName);
    const queryBuilder = repo.createQueryBuilder().update().set(params.values);

    if (params.conditions) {
      // Combine multiple conditions using OR
      params.conditions.forEach((condition, index) => {
        const conditionStrings = Object.keys(condition).map((key) => `${key} = :${key}${index}`);
        const conditionClause = conditionStrings.join(' AND ');
        queryBuilder.orWhere(conditionClause, this.prefixConditionParams(condition, index));
      });
    }

    return await queryBuilder.execute();
  }

  /**
   * Deletes records from the repository based on conditions.
   * Supports multiple conditions and combines them into a single query.
   */
  public async delete(entityName: string, conditionsArray: Record<string, any>[]): Promise<void> {
    const repo = this.getRepository(entityName);
    const queryBuilder = repo.createQueryBuilder().delete();

    // Combine multiple conditions for batch deletion using OR
    conditionsArray.forEach((conditions, index) => {
      const conditionStrings = Object.keys(conditions).map((key) => `${key} = :${key}${index}`);
      const conditionClause = conditionStrings.join(' AND ');
      queryBuilder.orWhere(conditionClause, this.prefixConditionParams(conditions, index));
    });

    await queryBuilder.execute();
  }

  /**
   * Clear the queue of operations after they are successfully committed.
   */
  public clearOperations(): void {
    this.operations = [];
  }

  /**
   * Helper function to add a unique prefix to condition parameters to avoid conflicts.
   */
  private prefixConditionParams(conditions: Record<string, any>, index: number): Record<string, any> {
    const prefixedParams: Record<string, any> = {};
    Object.entries(conditions).forEach(([key, value]) => {
      prefixedParams[`${key}${index}`] = value;
    });
    return prefixedParams;
  }

  /**
   * Helper function to chunk large arrays into smaller batches.
   * Used primarily for batch inserts.
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const results: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      results.push(array.slice(i, i + chunkSize));
    }
    return results;
  }
}
