import { ILoaderMapper } from '@easylayer/bitcoin-loader';
import { BlockModel, TransactionModel } from './models';

export class Mapper implements ILoaderMapper {
    public async onLoad(block: any) {
        const { height, hash, previousblockhash, tx } = block;

        const blockModels: InstanceType<typeof BlockModel>[] = [];
        const txsModels: InstanceType<typeof TransactionModel>[] = [];

        if (!tx || tx.length === 0) {
          throw new Error(`Tx length = 0`);
        }

        for (const t of tx) {
            const { txid, vin, vout } = t;
      
            const txsModel = new TransactionModel();
      
            txsModel.insert({
              txid,
              vin,
              vout,
              block_hash: hash,
            });
      
            txsModels.push(txsModel);
        }

        const blockModel = new BlockModel();

        blockModel.insert({
            hash, 
            height: Number(height),
            previousblockhash: previousblockhash ? previousblockhash : '000000000000000000'
        });
        
        blockModels.push(blockModel);

        return [...blockModels, ...txsModels];
    }

    public async onReorganisation(lightBlock: any) {
        const { hash } = lightBlock;

        const blockModel = new BlockModel();
    
        blockModel.update(
            { is_suspended: true },
            { hash }
        );

        return blockModel;
    }
}