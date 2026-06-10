import { IsString, Matches, MinLength } from 'class-validator';

// WebSocket payload for the watch_session event (host only)
export class WatchSessionDto {
  @IsString()
  @Matches(/^[A-Z0-9]{6}$/)
  roomCode: string;

  // Firebase ID token — verified against the session's hostId
  @IsString()
  @MinLength(1)
  token: string;
}
