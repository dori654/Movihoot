import { Logger, NotFoundException } from '@nestjs/common';
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { FirebaseService } from '../firebase/firebase.service';
import { SessionsService, type SessionData } from './sessions.service';
import {
  QuestionnaireService,
  AnswersRejectedError,
  type SubmitResult,
  type ParticipantAnswers,
} from '../questionnaire/questionnaire.service';
import type { FilmCard } from '../tmdb/tmdb.service';
import { AnswersSubmittedDto } from '../questionnaire/dto/submit-answers.dto';
import { AiService } from '../ai/ai.service';
import { JoinSessionDto } from './dto/join-session.dto';
import { WatchSessionDto } from './dto/watch-session.dto';
import {
  validatePayload,
  wsError,
  SocketRateLimiter,
  type WsAck,
} from './ws.utils';

interface SocketInfo {
  roomCode: string;
  role: 'host' | 'participant';
  nickname?: string;
}

@WebSocketGateway({ cors: { origin: process.env.FRONTEND_URL || '*' } })
export class SessionsGateway implements OnGatewayDisconnect {
  private readonly logger = new Logger(SessionsGateway.name);

  @WebSocketServer()
  server: Server;

  private socketToRoom = new Map<string, SocketInfo>();
  // roomCode -> nickname -> socketId, so a nickname is "taken" only while a
  // live socket holds it — a refreshed participant can rejoin with the same name
  private liveNicknames = new Map<string, Map<string, string>>();
  // rooms whose host socket dropped — used to broadcast host_back on rejoin
  private roomsAwaitingHost = new Set<string>();
  // pending grace-period removals for participants who dropped mid-session
  private removalTimers = new Map<string, NodeJS.Timeout>();
  private rateLimiter = new SocketRateLimiter();

  private static readonly REMOVAL_GRACE_MS = 30_000;

  constructor(
    private readonly firebase: FirebaseService,
    private readonly sessions: SessionsService,
    private readonly questionnaire: QuestionnaireService,
    private readonly ai: AiService,
  ) {}

  broadcastSessionStarted(roomCode: string): void {
    this.server.to(roomCode).emit('session_started', {});
  }

  @SubscribeMessage('watch_session')
  async handleWatch(
    @MessageBody() raw: unknown,
    @ConnectedSocket() client: Socket,
  ): Promise<WsAck<{ participants: string[] }>> {
    if (!this.rateLimiter.allow(client.id)) return wsError('RATE_LIMITED');

    const payload = validatePayload(WatchSessionDto, raw);
    if (!payload) return wsError('INVALID_PAYLOAD');
    const { roomCode, token } = payload;

    let session: SessionData;
    try {
      session = await this.sessions.getSession(roomCode);
    } catch {
      return wsError('ROOM_NOT_FOUND');
    }
    if (this.sessions.isExpired(session)) return wsError('SESSION_EXPIRED');

    try {
      const decoded = await this.firebase.auth.verifyIdToken(token);
      if (decoded.uid !== session.hostId) return wsError('NOT_HOST');
    } catch {
      return wsError('NOT_HOST');
    }

    await client.join(roomCode);
    this.socketToRoom.set(client.id, { roomCode, role: 'host' });
    if (this.roomsAwaitingHost.delete(roomCode)) {
      this.server.to(roomCode).emit('host_back', {});
    }
    this.logger.log(`Host is watching session ${roomCode}`);
    return { ok: true, participants: session.participants };
  }

  @SubscribeMessage('join_session')
  async handleJoin(
    @MessageBody() raw: unknown,
    @ConnectedSocket() client: Socket,
  ): Promise<WsAck<{ participants: string[] }>> {
    if (!this.rateLimiter.allow(client.id)) return wsError('RATE_LIMITED');

    const payload = validatePayload(JoinSessionDto, raw);
    if (!payload) return wsError('INVALID_PAYLOAD');
    const { roomCode, nickname } = payload;

    let session: SessionData;
    try {
      session = await this.sessions.getSession(roomCode);
    } catch {
      return wsError('ROOM_NOT_FOUND');
    }
    if (this.sessions.isExpired(session)) return wsError('SESSION_EXPIRED');

    // New joins are lobby-only; an existing participant may rejoin an active
    // session (reconnect mid-questionnaire)
    const isRejoin = session.participants.includes(nickname);
    if (session.status !== 'lobby' && !isRejoin) {
      return wsError('SESSION_NOT_JOINABLE');
    }

    const roomNicknames =
      this.liveNicknames.get(roomCode) ?? new Map<string, string>();
    const holder = roomNicknames.get(nickname);
    if (holder && holder !== client.id) return wsError('NICKNAME_TAKEN');

    try {
      await client.join(roomCode);
      await this.sessions.addParticipant(roomCode, nickname);
    } catch (err) {
      this.logger.error(`join_session failed for ${roomCode}`, err);
      return wsError('INTERNAL_ERROR');
    }

    roomNicknames.set(nickname, client.id);
    this.liveNicknames.set(roomCode, roomNicknames);
    this.socketToRoom.set(client.id, {
      roomCode,
      nickname,
      role: 'participant',
    });

    // Reconnected within the grace period — cancel the pending removal
    const timerKey = `${roomCode}:${nickname}`;
    const pending = this.removalTimers.get(timerKey);
    if (pending) {
      clearTimeout(pending);
      this.removalTimers.delete(timerKey);
    }

    const updated = await this.sessions.getSession(roomCode);
    this.server.to(roomCode).emit('user_joined', {
      nickname,
      count: updated.participants.length,
    });
    this.logger.log(
      `"${nickname}" ${isRejoin ? 'rejoined' : 'joined'} session ${roomCode} (${updated.participants.length} participants)`,
    );
    return { ok: true, participants: updated.participants };
  }

  @SubscribeMessage('answers_submitted')
  async handleAnswers(
    @MessageBody() raw: unknown,
    @ConnectedSocket() client: Socket,
  ): Promise<WsAck> {
    if (!this.rateLimiter.allow(client.id)) return wsError('RATE_LIMITED');

    const payload = validatePayload(AnswersSubmittedDto, raw);
    if (!payload) return wsError('INVALID_PAYLOAD');
    const { roomCode, nickname, answers } = payload;

    let submitResult: SubmitResult;
    try {
      submitResult = await this.questionnaire.submitAnswers(
        roomCode,
        nickname,
        answers,
      );
    } catch (err) {
      if (err instanceof NotFoundException) return wsError('ROOM_NOT_FOUND');
      if (err instanceof AnswersRejectedError) return wsError(err.code);
      this.logger.error(`answers_submitted failed for ${roomCode}`, err);
      return wsError('INTERNAL_ERROR');
    }

    this.server.to(roomCode).emit('answer_received', { nickname });

    if (submitResult.triggerRecommendations) {
      await this.generateAndBroadcast(
        roomCode,
        submitResult.answers,
        submitResult.filmCards,
      );
    }

    return { ok: true };
  }

  private async generateAndBroadcast(
    roomCode: string,
    answers: ParticipantAnswers[],
    filmCards: FilmCard[],
  ): Promise<void> {
    try {
      const results = await this.ai.getRecommendations(answers, filmCards);
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

  async handleDisconnect(client: Socket) {
    this.rateLimiter.forget(client.id);
    const info = this.socketToRoom.get(client.id);
    if (!info) return;

    const { roomCode, nickname, role } = info;
    this.socketToRoom.delete(client.id);

    if (role === 'host') {
      this.roomsAwaitingHost.add(roomCode);
      this.server.to(roomCode).emit('host_left', {});
      this.logger.log(`Host disconnected from session ${roomCode}`);
      return;
    }

    if (!nickname) return;
    const roomNicknames = this.liveNicknames.get(roomCode);
    if (roomNicknames?.get(nickname) === client.id) {
      roomNicknames.delete(nickname);
      if (roomNicknames.size === 0) this.liveNicknames.delete(roomCode);
    }

    let session: SessionData | null = null;
    try {
      session = await this.sessions.getSession(roomCode);
    } catch {
      return; // session gone — nothing to clean up
    }

    // During the lobby a drop means "left" — remove right away. Mid-session,
    // give a grace period so a page refresh doesn't kick the participant out,
    // then re-check "all answered" since the leaver may have been the only
    // one holding up the group.
    if (session.status !== 'active') {
      await this.removeAndNotify(roomCode, nickname);
      return;
    }

    const timerKey = `${roomCode}:${nickname}`;
    const timer = setTimeout(() => {
      this.removalTimers.delete(timerKey);
      void (async () => {
        if (this.liveNicknames.get(roomCode)?.has(nickname)) return;
        await this.removeAndNotify(roomCode, nickname);
        const check = await this.questionnaire.checkAllAnswered(roomCode);
        if (check.triggerRecommendations) {
          await this.generateAndBroadcast(
            roomCode,
            check.answers,
            check.filmCards,
          );
        }
      })();
    }, SessionsGateway.REMOVAL_GRACE_MS);
    this.removalTimers.set(timerKey, timer);
  }

  private async removeAndNotify(
    roomCode: string,
    nickname: string,
  ): Promise<void> {
    try {
      await this.sessions.removeParticipant(roomCode, nickname);
    } catch (err) {
      this.logger.error(
        `Failed to remove "${nickname}" from session ${roomCode}`,
        err,
      );
    }
    this.server.to(roomCode).emit('user_left', { nickname });
    this.logger.log(`"${nickname}" left session ${roomCode}`);
  }
}
