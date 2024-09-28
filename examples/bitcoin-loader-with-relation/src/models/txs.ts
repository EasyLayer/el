import { EntitySchema, generateModelFromSchema } from '@easylayer/bitcoin-loader';
import { IBlock } from './blocks';


export interface Vin {
  txid?: string;
  vout?: number;
  scriptSig?: {
    asm: string;
  };
  sequence?: number;
  witness?: string[];
  coinbase?: string;
}
export interface Vout {
  value: number;
  n: number;
  scriptPubKey?: {
    asm: string;
    reqSigs?: number;
    type: string;
    addresses?: string[];
  };
}

export interface ITransaction {
  txid: string;
  vin: Vin[];
  vout: Vout[];
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
