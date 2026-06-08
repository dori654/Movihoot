import { Injectable, Logger } from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';
import { SubmitAnswersDto } from './dto/submit-answers.dto';

export interface ParticipantAnswers extends SubmitAnswersDto {
  nickname: string;
  submittedAt: Date;
}

export interface SubmitResult {
  allAnswered: boolean;
  answers: ParticipantAnswers[];
}

@Injectable()
export class QuestionnaireService {
  private readonly logger = new Logger(QuestionnaireService.name);

  constructor(private readonly firebase: FirebaseService) {}

  async submitAnswers(
    roomCode: string,
    nickname: string,
    dto: SubmitAnswersDto,
  ): Promise<SubmitResult> {
    const db = this.firebase.firestore;

    // Persist this participant's answers
    await db
      .collection('sessions')
      .doc(roomCode)
      .collection('answers')
      .doc(nickname)
      .set({ ...dto, nickname, submittedAt: new Date() });

    // Check how many participants have answered
    const sessionDoc = await db.collection('sessions').doc(roomCode).get();
    const sessionData = sessionDoc.data() as
      | { participants?: string[] }
      | undefined;
    const participants: string[] = sessionData?.participants ?? [];

    const answersSnap = await db
      .collection('sessions')
      .doc(roomCode)
      .collection('answers')
      .get();

    const answers = answersSnap.docs.map((d) => d.data() as ParticipantAnswers);

    const allAnswered =
      participants.length > 0 && answers.length >= participants.length;

    this.logger.log(
      `[${roomCode}] "${nickname}" answered — ` +
        `participants=[${participants.join(', ')}] (${participants.length}), ` +
        `answers=[${answers.map((a) => a.nickname).join(', ')}] (${answers.length}), ` +
        `allAnswered=${allAnswered}`,
    );

    return { allAnswered, answers };
  }
}
