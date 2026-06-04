import {
  Controller,
  Post,
  Patch,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/auth.decorator';
import { SessionsService } from './sessions.service';
import type { DecodedIdToken } from 'firebase-admin/auth';

@Controller('sessions')
export class SessionsController {
  constructor(private readonly sessions: SessionsService) {}

  @Post()
  @UseGuards(AuthGuard)
  async createSession(@CurrentUser() user: DecodedIdToken) {
    const roomCode = await this.sessions.createSession(user.uid);
    return { roomCode };
  }

  @Patch(':roomCode/start')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async startSession(@Param('roomCode') roomCode: string) {
    await this.sessions.startSession(roomCode);
  }
}
