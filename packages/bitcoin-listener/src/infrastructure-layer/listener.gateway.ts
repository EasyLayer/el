import { WebSocketGateway, WebSocketServer, SubscribeMessage, MessageBody } from '@nestjs/websockets';
import { Server } from 'socket.io';

@WebSocketGateway()
export class BitcoinListenerGateway {
  @WebSocketServer()
  server!: Server;

  constructor() {}

  public sendEvent(event: any) {
    this.server.emit('event', { payload: event });
  }

  @SubscribeMessage('commit')
  async handleBlockAck(@MessageBody() payload: { blockHeight: number }): Promise<void> {
    console.log(payload);
  }
}
