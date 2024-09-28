import { ILoaderMapper } from '@easylayer/bitcoin-loader';
import { BlockModel } from './blocks';

export class BlocksMapper implements ILoaderMapper {
    public async onLoad(block: any) {
        const { height, hash, previousblockhash, tx } = block;

        const model = new BlockModel();

        model.insert({
            hash, 
            height: Number(height),
            previousblockhash: previousblockhash ? previousblockhash : '000000000000000000',
            tx: tx.map((t: any) => t.txid)
        });

        return model;
    }

    public async onReorganisation(lightBlock: any) {
        const { hash } = lightBlock;

        const model = new BlockModel();

        model.update(
            { is_suspended: true },
            { hash }
        );

        return model;
    }
}