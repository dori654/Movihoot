import { Module } from '@nestjs/common';
import { QuestionnaireService } from './questionnaire.service';

@Module({
  providers: [QuestionnaireService],
  exports: [QuestionnaireService],
})
export class QuestionnaireModule {}
