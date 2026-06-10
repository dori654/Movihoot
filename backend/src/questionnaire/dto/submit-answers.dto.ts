import {
  IsString,
  IsArray,
  IsIn,
  IsEnum,
  IsNumber,
  IsOptional,
  ArrayMaxSize,
  ArrayMinSize,
  Matches,
  MinLength,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { MOOD_VALUES, GENRE_VALUES } from '../questionnaire.constants';

export class SubmitAnswersDto {
  @IsIn(MOOD_VALUES)
  mood: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(GENRE_VALUES.length)
  @IsIn(GENRE_VALUES, { each: true })
  genres: string[];

  @IsEnum(['short', 'medium', 'long'])
  length: 'short' | 'medium' | 'long';

  @IsEnum(['low', 'medium', 'high'])
  energyLevel: 'low' | 'medium' | 'high';

  @IsArray()
  @IsNumber({}, { each: true })
  @ArrayMaxSize(5)
  @IsOptional()
  knownFilms?: number[];

  @IsArray()
  @IsNumber({}, { each: true })
  @ArrayMaxSize(5)
  @IsOptional()
  likedFilms?: number[];
}

// WebSocket payload for the answers_submitted event
export class AnswersSubmittedDto {
  @IsString()
  @Matches(/^[A-Z0-9]{6}$/)
  roomCode: string;

  @IsString()
  @MinLength(1)
  @MaxLength(20)
  nickname: string;

  @ValidateNested()
  @Type(() => SubmitAnswersDto)
  answers: SubmitAnswersDto;
}
