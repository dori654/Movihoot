import { Module } from '@nestjs/common';
import { SessionsController } from './sessions.controller';
import { SessionsService } from './sessions.service';
import { SessionsGateway } from './sessions.gateway';
import { AuthModule } from '../auth/auth.module';
import { QuestionnaireModule } from '../questionnaire/questionnaire.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [AuthModule, QuestionnaireModule, AiModule],
  controllers: [SessionsController],
  providers: [SessionsService, SessionsGateway],
  exports: [SessionsService],
})
export class SessionsModule {}
