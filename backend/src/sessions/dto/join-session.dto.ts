import { IsString, Matches, MinLength, MaxLength } from 'class-validator';

// WebSocket payload for the join_session event
export class JoinSessionDto {
  @IsString()
  @Matches(/^[A-Z0-9]{6}$/)
  roomCode: string;

  @IsString()
  @MinLength(1)
  @MaxLength(20)
  nickname: string;
}
