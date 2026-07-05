import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  MessageBody,
  ConnectedSocket,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';

export interface WsNotificationPayload {
  id: string;
  type: string;
  title: string;
  body: string;
  refId?: string;
  refType?: string;
  createdAt: Date;
}

export interface WsTaskUpdatedPayload {
  taskId: string;
  taskType: 'DELEGATION' | 'WORK_REQUEST' | 'CHECKLIST' | 'FMS';
  status: string;
  updatedBy: string;
}

/**
 * Rooms:
 *   user:{userId}          — private channel per user
 *   tenant:{tenantId}      — broadcast channel for the whole company
 *
 * The JWT in the handshake `auth.token` is verified on connection.
 * On success the socket joins both rooms automatically.
 */
/**
 * SEC-01 fix: CORS is now restricted to the configured FRONTEND_URL(s).
 */
@WebSocketGateway({
  namespace: '/ws',
  cors: {
    origin: false, // overridden in afterInit()
    credentials: true,
  },
  transports: ['websocket', 'polling'],
})
export class NotificationsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationsGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {}

  afterInit(server: Server) {
    const frontendUrl = this.config.get<string>('FRONTEND_URL', 'http://localhost:3000');
    const allowedOrigins = [
      frontendUrl,
      'http://localhost:3000',
      'http://localhost:3001',
    ].filter(Boolean);

    const engine = (server as any).engine;
    if (engine?.opts) {
      engine.opts.cors = {
        origin: (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) => {
          if (!origin || allowedOrigins.includes(origin)) {
            cb(null, true);
          } else {
            this.logger.warn(`WS CORS blocked: ${origin}`);
            cb(new Error('Not allowed by CORS'));
          }
        },
        credentials: true,
      };
    }

    this.logger.log(`WebSocket gateway initialised — allowed origins: ${allowedOrigins.join(', ')}`);
  }

  // ── Connection ────────────────────────────────────────────────────────────

  async handleConnection(socket: Socket) {
    try {
      const token =
        (socket.handshake.auth as any)?.token ||
        socket.handshake.headers['authorization']?.replace('Bearer ', '');

      if (!token) throw new WsException('Missing auth token');

      const payload = this.jwtService.verify(token, {
        secret: this.config.get('JWT_ACCESS_SECRET') ?? this.config.get('JWT_SECRET'),
      });

      (socket as any).userId = payload.sub;
      (socket as any).tenantId = payload.tenantId;

      await socket.join(`user:${payload.sub}`);
      await socket.join(`tenant:${payload.tenantId}`);

      this.logger.log(`Client connected: ${socket.id} → user:${payload.sub}`);
    } catch (err) {
      this.logger.warn(`WS auth failed for ${socket.id}: ${err.message}`);
      socket.emit('error', { message: 'Unauthorized' });
      socket.disconnect(true);
    }
  }

  handleDisconnect(socket: Socket) {
    this.logger.log(`Client disconnected: ${socket.id}`);
  }

  // ── Incoming messages ────────────────────────────────────────────────────

  @SubscribeMessage('ping')
  handlePing() {
    return { event: 'pong', data: 'pong' };
  }

  // ── Outgoing helpers ─────────────────────────────────────────────────────

  /**
   * Emit a task-status-changed event to a specific user's private room.
   * Called from delegation.service / work-request.service.
   */
  emitTaskUpdated(userId: string, payload: WsTaskUpdatedPayload): void {
    this.server.to(`user:${userId}`).emit('task:updated', payload);
  }

  /**
   * Emit a new in-app notification to a specific user's private room.
   * Called from notifications.service after the DB row is persisted.
   */
  emitNotification(userId: string, payload: any): void {
    this.server.to(`user:${userId}`).emit('notification:new', payload);
  }

  /** Broadcast any arbitrary event to all sockets in a tenant room. */
  broadcastToTenant(tenantId: string, event: string, payload: any): void {
    this.server.to(`tenant:${tenantId}`).emit(event, payload);
  }
}
