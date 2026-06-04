import { IsString, MinLength, MaxLength } from 'class-validator';

export class JoinSessionDto {
  @IsString()
  @MinLength(6)
  @MaxLength(6)
  roomCode: string;

  @IsString()
  @MinLength(1)
  @MaxLength(20)
  nickname: string;
}
