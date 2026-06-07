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
import { QuestionnaireService } from '../questionnaire/questionnaire.service';
import { SubmitAnswersDto } from '../questionnaire/dto/submit-answers.dto';

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
  answers: SubmitAnswersDto;
}

@WebSocketGateway({ cors: { origin: '*' } })
export class SessionsGateway implements OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private socketToRoom = new Map<
    string,
    { roomCode: string; nickname: string }
  >();

  constructor(
    private readonly sessions: SessionsService,
    private readonly questionnaire: QuestionnaireService,
  ) {}

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
  async handleAnswers(@MessageBody() payload: AnswersPayload) {
    const { roomCode, nickname, answers } = payload;

    // Acknowledge receipt to the whole room
    this.server.to(roomCode).emit('answer_received', { nickname });

    const { allAnswered, answers: allAnswers } =
      await this.questionnaire.submitAnswers(roomCode, nickname, answers);

    if (allAnswered) {
      // AI service will be injected in Step 5; for now broadcast empty results
      // so the flow is wired end-to-end and CI stays green.
      await this.sessions.setResults(roomCode, []);
      this.server.to(roomCode).emit('all_answered', { results: [] });
    }

    return { allAnswers };
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
