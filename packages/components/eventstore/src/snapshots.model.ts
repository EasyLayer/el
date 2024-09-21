import { Entity, Column, PrimaryColumn } from 'typeorm';
import { AggregateRoot } from '@easylayer/components/cqrs';

export interface SnapshotParameters {
  aggregateId: string;
  type: string;
  payload: string;
}

@Entity('snapshots')
export class SnapshotsModel {
  @PrimaryColumn({ type: 'varchar' })
  public aggregateId!: string;

  @Column({ type: 'text' })
  public payload!: string;

  @Column({ type: 'varchar' })
  public type!: string;

  static deserialize<T extends AggregateRoot & { aggregateId: string }>(snapshot: SnapshotsModel): T {
    const { aggregateId, payload, type } = snapshot;

    // Deserialize data from a JSON payload
    const deserializedPayload = JSON.parse(payload);

    const aggregate = Object.create(AggregateRoot.prototype) as T;

    aggregate.aggregateId = aggregateId;
    Object.assign(aggregate, deserializedPayload);

    aggregate.constructor = { name: type } as typeof Object.constructor;

    return aggregate;
  }

  static serialize<T extends AggregateRoot & { aggregateId: string }>(aggregate: T): SnapshotsModel {
    const { aggregateId, ...payload } = aggregate;

    if (!aggregateId) {
      throw new Error('Aggregate Id is missed');
    }

    // Serialize the payload as a JSON string
    const serializedPayload = JSON.stringify(payload, getCircularReplacer());

    return new SnapshotsModel({
      aggregateId,
      payload: serializedPayload,
      type: Object.getPrototypeOf(aggregate).constructor.name,
    });
  }

  constructor(parameters: SnapshotParameters) {
    if (!parameters) {
      return;
    }

    this.aggregateId = parameters.aggregateId;
    this.type = parameters.type;
    this.payload = parameters.payload;
  }
}

// Helps serialize objects containing circular references using JSON.stringify.
export const getCircularReplacer = () => {
  const seen = new WeakSet();
  return function (key: any, value: any) {
    // Check is used to ensure that the current value is an object but not null (since typeof null === 'object).
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) {
        // If the object has already been processed (i.e. it is in a WeakSet),
        // this means that a circular reference has been found and the function returns undefined instead,
        // (which prevents the circular reference from being serialized).
        // Skip cyclic references
        return;
      }
      // If the object has not yet been seen,
      // it is added to the WeakSet using seen.add(value)
      // to keep track of which objects have already been processed.
      seen.add(value);
    }
    return value;
  };
};

// const stringToHex = (str: string) => {
//   return Buffer.from(str, 'utf8').toString('hex');
// };

// const objectToHex = (obj: any) => {
//   const jsonString = JSON.stringify(obj);
//   return stringToHex(jsonString);
// };

// const hexToString = (hex: string) => {
//   return Buffer.from(hex, 'hex').toString('utf8');
// };

// const hexToObject = (hex: string) => {
//   const jsonString = hexToString(hex);
//   return JSON.parse(jsonString);
// };
