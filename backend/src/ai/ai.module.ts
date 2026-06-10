import { Module } from '@nestjs/common';
import { AiService } from './ai.service';
import { TmdbModule } from '../tmdb/tmdb.module';

@Module({
  imports: [TmdbModule],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {}
