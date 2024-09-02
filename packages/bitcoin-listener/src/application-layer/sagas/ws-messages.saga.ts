import { Injectable } from '@nestjs/common';
import { Observable } from 'rxjs';
import { Saga, ICommand, executeWithRetry } from '@el/components/cqrs';
import { WebsocketMessage } from '@el/common/domain-cqrs-components/websocket-messages';
import { WsMessagesService } from '../../infrastructure-layer/services';

@Injectable()
export class WsMessagesSaga {
  constructor(private readonly wsMessagesService: WsMessagesService) {}

  @Saga()
  onWebsocketMessage(events$: Observable<any>): Observable<ICommand> {
    return events$.pipe(
      executeWithRetry({
        event: WebsocketMessage,
        command: ({ payload }: WebsocketMessage) => this.wsMessagesService.processIncomingMessage(payload),
      })
    );
  }
}
