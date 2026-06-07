import {
  IsString,
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  ArrayMaxSize,
} from 'class-validator';

export class SubmitAnswersDto {
  @IsString()
  mood: string;

  @IsArray()
  @IsString({ each: true })
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
}
