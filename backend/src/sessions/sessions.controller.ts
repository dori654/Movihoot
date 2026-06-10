import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  ForbiddenException,
  ConflictException,
  GoneException,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/auth.decorator';
import { SessionsService } from './sessions.service';
import { SessionsGateway } from './sessions.gateway';
import type { DecodedIdToken } from 'firebase-admin/auth';

@Controller('sessions')
export class SessionsController {
  constructor(
    private readonly sessions: SessionsService,
    private readonly gateway: SessionsGateway,
  ) {}

  @Post()
  @UseGuards(AuthGuard)
  async createSession(@CurrentUser() user: DecodedIdToken) {
    const roomCode = await this.sessions.createSession(user.uid);
    return { roomCode };
  }

  @Get(':roomCode')
  @UseGuards(AuthGuard)
  async getSession(
    @Param('roomCode') roomCode: string,
    @CurrentUser() user: DecodedIdToken,
  ) {
    const session = await this.sessions.getSession(roomCode);
    if (session.hostId !== user.uid) {
      throw new ForbiddenException('You do not own this session');
    }
    if (this.sessions.isExpired(session)) {
      throw new GoneException('Session has expired');
    }
    return {
      roomCode,
      status: session.status,
      participants: session.participants,
    };
  }

  // Public — participants are anonymous and fetch the film cards for the
  // known-films questionnaire step
  @Get(':roomCode/film-cards')
  async getFilmCards(@Param('roomCode') roomCode: string) {
    const session = await this.sessions.getSession(roomCode);
    return { films: session.filmCards ?? [] };
  }

  @Patch(':roomCode/start')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async startSession(
    @Param('roomCode') roomCode: string,
    @CurrentUser() user: DecodedIdToken,
  ) {
    const session = await this.sessions.getSession(roomCode);
    if (session.hostId !== user.uid) {
      throw new ForbiddenException('You do not own this session');
    }
    if (this.sessions.isExpired(session)) {
      throw new GoneException('Session has expired');
    }
    if (session.status !== 'lobby') {
      throw new ConflictException('Session has already started');
    }
    await this.sessions.startSession(roomCode);
    this.gateway.broadcastSessionStarted(roomCode);
  }
}
