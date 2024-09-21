import { EntitySchema, generateModelFromSchema } from '@easylayer/bitcoin-loader';
import { IBlock } from './blocks';

export interface ITransaction {
  txid: string;
  vin: any;
  vout: any;
  block_hash: string;
  block?: IBlock;
}

export const TransactionSchema = new EntitySchema<ITransaction>({
  name: 'txs',
  tableName: 'txs',
  columns: {
    txid: {
      type: 'varchar',
      primary: true,
    },
    vin: {
      type: 'json',
      nullable: false,
    },
    vout: {
      type: 'json',
      nullable: false,
    },
    block_hash: {
      type: 'varchar',
      nullable: false,
    },
  },
  uniques: [
    {
      name: 'UQ__txs__txid',
      columns: ['txid'],
    },
  ],
  relations: {
    block: {
      type: 'many-to-one',
      target: 'blocks',
      inverseSide: 'tx',
      joinColumn: {
        name: 'block_hash',
        referencedColumnName: 'hash',
      },
    },
  },
});

export const TransactionModel = generateModelFromSchema(TransactionSchema);
