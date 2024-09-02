export interface IInitLoaderCommand {
  requestId: string;
  startHeight: string | number;
  lastReadStateHeight?: number;
}

export class InitLoaderCommand {
  constructor(public readonly payload: IInitLoaderCommand) {}
}
