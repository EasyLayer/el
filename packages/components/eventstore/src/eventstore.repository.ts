import _ from 'lodash';
import { PostgresError } from 'pg-error-enum';
import { Injectable, Inject } from '@nestjs/common';
import { Repository, QueryFailedError, In, MoreThan } from 'typeorm';
import { AggregateRoot, IEvent } from '@easylayer/components/cqrs';
import { AppLogger } from '@easylayer/components/logger';
import { EventDataModel, BasicEvent } from './event-data.model';
import { SnapshotsModel } from './snapshots.model';

type AggregateWithId = AggregateRoot & { aggregateId: string };

@Injectable()
export class EventStoreRepository<T extends AggregateWithId = AggregateWithId> {
  constructor(
    private readonly log: AppLogger,
    @Inject('EVENT_DATA_MODEL_REPOSITORY')
    private readonly eventsRepository: Repository<EventDataModel>,
    @Inject('SNAPSHOTS_MODEL_REPOSITORY')
    private readonly snapshotsRepository: Repository<SnapshotsModel>
  ) {}

  public async save(models: T | T[]): Promise<void> {
    const aggregates: T[] = Array.isArray(models) ? models : [models];

    await Promise.all(aggregates.map((aggregate: T) => this.storeEvent(aggregate)));
  }

  public async getOne(model: T): Promise<T> {
    // IMPORTANT: We have to go over the model of the unit here even if it is empty
    const { aggregateId } = model;

    if (!aggregateId) {
      return model;
    }

    const snapshot = await this.snapshotsRepository.findOneBy({ aggregateId });

    if (!snapshot) {
      // If there is no snapshot at all, then we only get events sorted by version
      const eventRaws = await this.eventsRepository.find({
        where: { aggregateId },
        order: { version: 'ASC' },
      });

      await model.loadFromHistory(eventRaws.map(EventDataModel.deserialize));
      return model;
    }

    // If the snapshot was in the database,
    // then we still need to check
    // its relevance by getting events according to a version higher than that of the snapshot.
    await model.loadFromSnapshot(SnapshotsModel.deserialize(snapshot));

    const eventRaws = await this.eventsRepository.find({
      where: { aggregateId, version: MoreThan(model.version) },
    });

    if (eventRaws.length > 0) {
      await model.loadFromHistory(eventRaws.map(EventDataModel.deserialize));
    }

    return model;
  }

  // IMPORTANT: This method does not currently support snapshots.
  public async getMany(models: T[]): Promise<T[]> {
    // Extract all aggregateIds from the models
    const aggregateIds = models.map((model) => model.aggregateId);

    // Query all events for the given aggregateIds
    const eventRaws = await this.eventsRepository.find({
      where: { aggregateId: In(aggregateIds) },
      order: { version: 'ASC' },
    });

    // Group events by aggregateId
    const eventsByAggregateId = eventRaws.reduce((acc: { [key: string]: any[] }, eventRaw: any) => {
      const aggregateId = eventRaw.aggregateId;
      if (!acc[aggregateId]) {
        acc[aggregateId] = [];
      }
      acc[aggregateId].push(EventDataModel.deserialize(eventRaw));
      return acc;
    }, {});

    // Ensure each group of events is sorted by version
    // TODO: think
    // Object.keys(eventsByAggregateId).forEach(aggregateId => {
    //   eventsByAggregateId[aggregateId].sort((a, b) => a.version - b.version);
    // });

    // Load history for each model and return the updated models
    await Promise.all(
      models.map(async (model) => {
        const events = eventsByAggregateId[model.aggregateId] || [];
        await model.loadFromHistory(events);
      })
    );

    return models;
  }

  public async fetchLastEvent(model: T): Promise<BasicEvent<IEvent> | undefined> {
    const { aggregateId } = model;

    if (!aggregateId) {
      return undefined;
    }

    // Find last event raw
    const eventRaw = await this.eventsRepository.findOne({
      where: { aggregateId },
      order: { version: 'DESC' },
    });

    if (!eventRaw) {
      return undefined;
    }

    const event = EventDataModel.deserialize(eventRaw);
    return event;
  }

  // IMPORTANT: This method does not currently support snapshots.
  public async getOneByExtra(model: T & { extra: string }): Promise<T> {
    const { extra } = model;

    if (!extra) {
      throw new Error(`Method getOneByExtra() is not supported by this aggregate`);
    }

    //We do NOT need aggregateId here, because we get events by extra

    const eventRaws = await this.eventsRepository.find({
      where: { extra },
      order: { version: 'ASC' },
    });

    await model.loadFromHistory(eventRaws.map(EventDataModel.deserialize));

    return model;
  }

  private async storeEvent(aggregate: T) {
    try {
      const uncommittedEvents: IEvent[] = aggregate.getUncommittedEvents();

      if (uncommittedEvents.length === 0) {
        return;
      }

      const events = uncommittedEvents.map((event) => {
        return EventDataModel.serialize(event, aggregate.version);
      });

      // IMPORTANT: We use createQueryBuilder with "updateEntity = false" option to ensure there is only one query
      // (without select after insert)
      // https://github.com/typeorm/typeorm/issues/4651
      await this.eventsRepository.createQueryBuilder().insert().values(events).updateEntity(false).execute();

      // Update snapshot only when version is a multiple of 100
      if (aggregate.version % 100 === 0) {
        await this.updateSnapshot(aggregate);
      }
    } catch (error) {
      this.handleDatabaseError(error);
    }
  }

  private async updateSnapshot(aggregate: T) {
    try {
      // IMPORTANT: At the moment this is a crutch (temporary) solution
      // (The problem is that before publishing(commit) events are in the aggregate and we don't want to store them in the snapshot).

      // Clone the aggregate deeply excluding uncommitted events
      const clonedAggregate = _.cloneDeep(aggregate);
      // Remove internal events from the cloned aggregate
      clonedAggregate.uncommit();

      // Serialize the cloned aggregate
      const snapshot = SnapshotsModel.serialize(clonedAggregate);

      await this.snapshotsRepository
        .createQueryBuilder()
        .insert()
        .into(SnapshotsModel)
        .values(snapshot)
        .orUpdate(
          ['payload'], // Columns that we update
          ['aggregateId']
        )
        .updateEntity(false)
        .execute();
    } catch (error) {
      if (error instanceof QueryFailedError) {
        const driverError = error.driverError;

        if (driverError.code === 'SQLITE_CONSTRAINT') {
          this.log.error('updateSnapshot()', { error: driverError.message }, this.constructor.name);
          return;
        }

        if (driverError.code === PostgresError.UNIQUE_VIOLATION) {
          this.log.error('updateSnapshot()', { error: driverError.detail }, this.constructor.name);
          return;
        }

        throw error;
      }

      throw error;
    }
  }

  // TODO: move to new file or class
  private handleDatabaseError(error: any): void {
    if (error instanceof QueryFailedError) {
      const driverError = error.driverError;

      // SQLite Error Handling
      if (driverError.code === 'SQLITE_CONSTRAINT') {
        const errorMessage = driverError.message;
        if (errorMessage.includes('UNIQUE constraint failed: events.requestId, events.aggregateId')) {
          // Idempotency protection, just return
          return;
        }
        if (errorMessage.includes('UNIQUE constraint failed: events.version, events.aggregateId')) {
          throw new Error('Version conflict error');
        }

        switch (driverError.message) {
          case 'UQ__request_id__aggregate_id':
            console.log('Idempotency protection, just return\n');
            return;
          case 'UQ__version__aggregate_id':
            throw new Error('Version conflict error');
          default:
            throw error;
        }
      }

      // PostgreSQL Error Handling
      if (driverError.code === PostgresError.UNIQUE_VIOLATION) {
        if (driverError.detail.includes('Key (request_id, aggregate_id)')) {
          // Idempotency protection, just return
          return;
        }
        if (driverError.detail.includes('Key (version, aggregate_id)')) {
          throw new Error('Version conflict error');
        }
        throw error;
      }

      throw error;
    }
  }
}
