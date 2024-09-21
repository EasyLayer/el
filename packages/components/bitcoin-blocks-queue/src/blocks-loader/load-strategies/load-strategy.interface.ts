export interface BlocksLoadingStrategy {
  readonly name: StrategyNames;
  isLoading: boolean;
  load(currentNetworkHeight: number): Promise<void>;
  destroy(): Promise<void>;
}

export enum StrategyNames {
  WEBHOOK_STREAM = 'webhook-stream',
  PULL_NETWORK_TRANSPORT = 'pull-network-transport',
  PULL_NETWORL_PROVIDER = 'pull-network-provider',
}
