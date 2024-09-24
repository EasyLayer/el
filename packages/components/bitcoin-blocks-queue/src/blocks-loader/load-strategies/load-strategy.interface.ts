export interface BlocksLoadingStrategy {
  readonly name: StrategyNames;
  load(currentNetworkHeight: number): Promise<void>;
  destroy(): Promise<void>;
}

export enum StrategyNames {
  PULL_NETWORL_PROVIDER = 'pull-network-provider',
}
