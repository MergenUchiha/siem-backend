import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private connectedClients = new Set<string>();

  handleConnection(client: Socket) {
    this.connectedClients.add(client.id);
    console.log(
      `✅ Client connected: ${client.id} (Total: ${this.connectedClients.size})`,
    );

    // Send connection confirmation
    client.emit('connected', {
      message: 'Connected to SIEM WebSocket',
      clientId: client.id,
    });
  }

  handleDisconnect(client: Socket) {
    this.connectedClients.delete(client.id);
    console.log(
      `❌ Client disconnected: ${client.id} (Total: ${this.connectedClients.size})`,
    );
  }

  // Emit new log to all clients
  broadcastNewLog(log: any) {
    this.server.emit('newLog', log);
  }

  // Emit new incident to all clients
  broadcastNewIncident(incident: any) {
    this.server.emit('newIncident', incident);
  }

  // Emit metrics update
  broadcastMetricsUpdate(metrics: any) {
    this.server.emit('metricsUpdate', metrics);
  }

  @SubscribeMessage('ping')
  handlePing(client: Socket) {
    return { event: 'pong', data: { timestamp: new Date().toISOString() } };
  }

  getConnectedClientsCount(): number {
    return this.connectedClients.size;
  }
}
