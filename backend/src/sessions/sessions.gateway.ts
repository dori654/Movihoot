import { Logger } from '@nestjs/common';
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
import { AiService } from '../ai/ai.service';

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
  private readonly logger = new Logger(SessionsGateway.name);

  @WebSocketServer()
  server: Server;

  private socketToRoom = new Map<
    string,
    { roomCode: string; nickname: string }
  >();

  constructor(
    private readonly sessions: SessionsService,
    private readonly questionnaire: QuestionnaireService,
    private readonly ai: AiService,
  ) {}

  @SubscribeMessage('watch_session')
  async handleWatch(
    @MessageBody() payload: StartPayload,
    @ConnectedSocket() client: Socket,
  ) {
    await client.join(payload.roomCode);
  }

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
      try {
        const results = await this.ai.getRecommendations(allAnswers);
        if (results.length === 0) {
          throw new Error('AI returned no recommendations');
        }
        await this.sessions.setResults(roomCode, results);
        this.server.to(roomCode).emit('all_answered', { results });
      } catch (err) {
        this.logger.error('Failed to generate recommendations', err);
        this.server.to(roomCode).emit('recommendation_error', {
          message: 'משהו השתבש בעת יצירת ההמלצות. נסו ליצור סשן חדש ולנסות שוב.',
        });
      }
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
