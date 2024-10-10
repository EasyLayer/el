import { ILoaderMapper } from '@easylayer/bitcoin-loader';
import { ScriptUtilService } from '@easylayer/components/bitcoin-network-provider';
import { Currency, Money } from '@easylayer/common/arithmetic';
import { OutputsRepository, InputsRepository } from './repositories';

export class Mapper implements ILoaderMapper {
  public async onLoad(block: any) {
    const currency: Currency = {
      code: 'BTC',
      minorUnit: 8,
    };

    const { height, tx } = block;

    const outputRepos: InstanceType<typeof OutputsRepository>[] = [];
    const inputRepos: InstanceType<typeof InputsRepository>[] = [];

    if (!tx || tx.length === 0) {
      throw new Error(`Tx length = 0`);
    }

    for (const t of tx) {
      const txid = t.txid;

      for (const vout of t.vout) {
        const scriptHash = ScriptUtilService.getScriptHashFromScriptPubKey(vout.scriptPubKey);
        const value = Money.fromDecimal(vout.value, currency).toCents();
        const outputRepo = new OutputsRepository();

        outputRepo.insert({
          txid,
          script_hash: scriptHash,
          value,
          n: Number(vout.n),
          block_height: Number(height)
        });

        outputRepos.push(outputRepo);
      }

      for (const vin of t.vin) {
        if (vin.txid && vin.vout) {
          const inputRepo = new InputsRepository();

          inputRepo.insert({
            txid,
            output_txid: vin.txid,
            output_n: Number(vin.vout),
          });

          inputRepos.push(inputRepo);
        }
      }
    }

    return [...outputRepos, ...inputRepos];
  }

  public async onReorganisation(lightBlock: any) {
    const { tx } = lightBlock;

    const outputRepos: InstanceType<typeof OutputsRepository>[] = [];

    for (let txid of tx) {
      const outputRepo = new OutputsRepository();

      outputRepo.update(
        { txid },
        { is_suspended: true },
      );

      outputRepos.push(outputRepo);
    }

    return outputRepos;
  }
}