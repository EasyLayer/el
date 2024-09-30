import { EntitySchema, generateModelFromSchema } from '@easylayer/bitcoin-loader';
import { IBlock } from './blocks';

export interface ITransaction {
  txid: string;
  hex: string;
  vin: string;
  vout: string;
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
      type: 'text',
      nullable: false,
    },
    vout: {
      type: 'text',
      nullable: false,
    },
    block_hash: {
      type: 'varchar',
      nullable: false,
    },
  },
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
