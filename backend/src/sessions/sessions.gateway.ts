import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { SessionsService } from './sessions.service';

interface JoinPayload {
  roomCode: string;
  nickname: string;
}

interface StartPayload {
  roomCode: string;
}

interface AnswersPayload {
  roomCode: string;
  nickname: string;
  answers: Record<string, unknown>;
}

@WebSocketGateway({ cors: { origin: '*' } })
export class SessionsGateway implements OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private socketToRoom = new Map<
    string,
    { roomCode: string; nickname: string }
  >();

  constructor(private readonly sessions: SessionsService) {}

  @SubscribeMessage('join_session')
  async handleJoin(
    @MessageBody() payload: JoinPayload,
    @ConnectedSocket() client: Socket,
  ) {
    const { roomCode, nickname } = payload;
    await client.join(roomCode);
    await this.sessions.addParticipant(roomCode, nickname);
    this.socketToRoom.set(client.id, { roomCode, nickname });

    const session = await this.sessions.getSession(roomCode);
    this.server.to(roomCode).emit('user_joined', {
      nickname,
      count: session.participants.length,
    });
  }

  @SubscribeMessage('start_session')
  async handleStart(@MessageBody() payload: StartPayload) {
    await this.sessions.startSession(payload.roomCode);
    this.server.to(payload.roomCode).emit('session_started', {});
  }

  @SubscribeMessage('answers_submitted')
  handleAnswers(@MessageBody() payload: AnswersPayload) {
    // Questionnaire service handles persistence and AI trigger.
    // Gateway just re-emits for other modules listening via events if needed.
    this.server.to(payload.roomCode).emit('answer_received', {
      nickname: payload.nickname,
    });
  }

  async handleDisconnect(client: Socket) {
    const info = this.socketToRoom.get(client.id);
    if (!info) return;

    const { roomCode, nickname } = info;
    this.socketToRoom.delete(client.id);

    await this.sessions.removeParticipant(roomCode, nickname);
    this.server.to(roomCode).emit('user_left', { nickname });
  }
}
