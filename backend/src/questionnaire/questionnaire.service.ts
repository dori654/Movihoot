import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';
import { SubmitAnswersDto } from './dto/submit-answers.dto';
import type { SessionData } from '../sessions/sessions.service';
import type { FilmCard } from '../tmdb/tmdb.service';

export interface ParticipantAnswers extends SubmitAnswersDto {
  nickname: string;
  submittedAt: Date;
}

export interface SubmitResult {
  allAnswered: boolean;
  // true exactly once per session — the submission that flipped the flag
  triggerRecommendations: boolean;
  answers: ParticipantAnswers[];
  filmCards: FilmCard[];
}

export class AnswersRejectedError extends Error {
  constructor(public readonly code: 'SESSION_NOT_ACTIVE' | 'NOT_PARTICIPANT') {
    super(code);
  }
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
    const sessionRef = db.collection('sessions').doc(roomCode);
    const answersRef = sessionRef.collection('answers');

    // Transaction guarantees the "all answered" decision and the
    // recommendationsTriggered flag flip are atomic, so concurrent final
    // submissions can't both trigger the AI call
    const result = await db.runTransaction(async (t) => {
      const sessionSnap = await t.get(sessionRef);
      if (!sessionSnap.exists) {
        throw new NotFoundException(`Session ${roomCode} not found`);
      }
      const session = sessionSnap.data() as SessionData;
      if (session.status !== 'active') {
        throw new AnswersRejectedError('SESSION_NOT_ACTIVE');
      }
      const participants = session.participants ?? [];
      if (!participants.includes(nickname)) {
        throw new AnswersRejectedError('NOT_PARTICIPANT');
      }

      const answersSnap = await t.get(answersRef);
      // Only current participants' answers count — a leaver's stale answer
      // must not be sent to the AI on their behalf
      const existing = answersSnap.docs
        .map((d) => d.data() as ParticipantAnswers)
        .filter(
          (a) => a.nickname !== nickname && participants.includes(a.nickname),
        );

      const answer: ParticipantAnswers = {
        ...dto,
        nickname,
        submittedAt: new Date(),
      };
      t.set(answersRef.doc(nickname), answer);

      const answers = [...existing, answer];
      const answered = new Set(answers.map((a) => a.nickname));
      const allAnswered =
        participants.length > 0 && participants.every((p) => answered.has(p));

      let triggerRecommendations = false;
      if (allAnswered && !session.recommendationsTriggered) {
        t.update(sessionRef, { recommendationsTriggered: true });
        triggerRecommendations = true;
      }

      return {
        allAnswered,
        triggerRecommendations,
        answers,
        filmCards: session.filmCards ?? [],
        participants,
      };
    });

    this.logger.log(
      `[${roomCode}] "${nickname}" answered — ` +
        `participants=${result.participants.length}, answers=${result.answers.length}, ` +
        `allAnswered=${result.allAnswered}, trigger=${result.triggerRecommendations}`,
    );

    return {
      allAnswered: result.allAnswered,
      triggerRecommendations: result.triggerRecommendations,
      answers: result.answers,
      filmCards: result.filmCards,
    };
  }

  // Re-evaluates "all answered" without writing an answer — used after a
  // participant is removed mid-questionnaire, which can leave everyone else
  // already done. Flips recommendationsTriggered atomically like submitAnswers.
  async checkAllAnswered(roomCode: string): Promise<{
    triggerRecommendations: boolean;
    answers: ParticipantAnswers[];
    filmCards: FilmCard[];
  }> {
    const db = this.firebase.firestore;
    const sessionRef = db.collection('sessions').doc(roomCode);
    const answersRef = sessionRef.collection('answers');

    const result = await db.runTransaction(async (t) => {
      const sessionSnap = await t.get(sessionRef);
      if (!sessionSnap.exists) {
        return { triggerRecommendations: false, answers: [], filmCards: [] };
      }
      const session = sessionSnap.data() as SessionData;
      if (session.status !== 'active' || session.recommendationsTriggered) {
        return { triggerRecommendations: false, answers: [], filmCards: [] };
      }
      const participants = session.participants ?? [];

      const answersSnap = await t.get(answersRef);
      const all = answersSnap.docs.map((d) => d.data() as ParticipantAnswers);
      // Only answers from current participants count — a leaver's answer
      // must not be sent to the AI on their behalf
      const answers = all.filter((a) => participants.includes(a.nickname));
      const answered = new Set(answers.map((a) => a.nickname));
      const allAnswered =
        participants.length > 0 && participants.every((p) => answered.has(p));

      if (!allAnswered) {
        return { triggerRecommendations: false, answers: [], filmCards: [] };
      }
      t.update(sessionRef, { recommendationsTriggered: true });
      return {
        triggerRecommendations: true,
        answers,
        filmCards: session.filmCards ?? [],
      };
    });

    if (result.triggerRecommendations) {
      this.logger.log(
        `[${roomCode}] all remaining participants answered after a departure — triggering recommendations`,
      );
    }
    return result;
  }
}
