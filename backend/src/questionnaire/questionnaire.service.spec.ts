import { NotFoundException } from '@nestjs/common';
import {
  QuestionnaireService,
  AnswersRejectedError,
  type ParticipantAnswers,
} from './questionnaire.service';
import { SubmitAnswersDto } from './dto/submit-answers.dto';
import type { FirebaseService } from '../firebase/firebase.service';

const dto: SubmitAnswersDto = {
  mood: 'happy',
  genres: ['קומדיה'],
  length: 'medium',
  energyLevel: 'high',
  knownFilms: [],
};

interface FakeDbOptions {
  session: Record<string, unknown> | null;
  answers: Partial<ParticipantAnswers>[];
}

function makeService({ session, answers }: FakeDbOptions) {
  const answerDocRef = {};
  const answersCollection = { doc: jest.fn(() => answerDocRef) };
  const sessionRef = { collection: jest.fn(() => answersCollection) };

  const transaction = {
    get: jest.fn((ref: unknown) => {
      if (ref === sessionRef) {
        return Promise.resolve({
          exists: session !== null,
          data: () => session,
        });
      }
      return Promise.resolve({
        docs: answers.map((a) => ({ data: () => a })),
      });
    }),
    set: jest.fn(),
    update: jest.fn(),
  };

  const db = {
    collection: jest.fn(() => ({ doc: jest.fn(() => sessionRef) })),
    runTransaction: jest.fn((fn: (t: typeof transaction) => Promise<unknown>) =>
      fn(transaction),
    ),
  };

  const service = new QuestionnaireService({
    firestore: db,
  } as unknown as FirebaseService);

  return { service, transaction, answerDocRef };
}

describe('QuestionnaireService.submitAnswers', () => {
  it('throws NotFoundException when the session does not exist', async () => {
    const { service } = makeService({ session: null, answers: [] });
    await expect(service.submitAnswers('ABC123', 'dana', dto)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('rejects when the session is not active', async () => {
    const { service } = makeService({
      session: { status: 'lobby', participants: ['dana'] },
      answers: [],
    });
    await expect(
      service.submitAnswers('ABC123', 'dana', dto),
    ).rejects.toMatchObject({ code: 'SESSION_NOT_ACTIVE' });
  });

  it('rejects when the nickname is not a participant', async () => {
    const { service } = makeService({
      session: { status: 'active', participants: ['yossi'] },
      answers: [],
    });
    await expect(
      service.submitAnswers('ABC123', 'dana', dto),
    ).rejects.toBeInstanceOf(AnswersRejectedError);
  });

  it('stores the answer and reports not-all-answered while others are pending', async () => {
    const { service, transaction } = makeService({
      session: { status: 'active', participants: ['dana', 'yossi'] },
      answers: [],
    });
    const result = await service.submitAnswers('ABC123', 'dana', dto);
    expect(transaction.set).toHaveBeenCalled();
    expect(result.allAnswered).toBe(false);
    expect(result.triggerRecommendations).toBe(false);
    expect(result.answers).toHaveLength(1);
  });

  it('triggers recommendations exactly when the last participant answers', async () => {
    const { service, transaction } = makeService({
      session: { status: 'active', participants: ['dana', 'yossi'] },
      answers: [{ ...dto, nickname: 'yossi' }],
    });
    const result = await service.submitAnswers('ABC123', 'dana', dto);
    expect(result.allAnswered).toBe(true);
    expect(result.triggerRecommendations).toBe(true);
    expect(transaction.update).toHaveBeenCalledWith(expect.anything(), {
      recommendationsTriggered: true,
    });
  });

  it('does not trigger again when recommendations were already triggered', async () => {
    const { service, transaction } = makeService({
      session: {
        status: 'active',
        participants: ['dana', 'yossi'],
        recommendationsTriggered: true,
      },
      answers: [{ ...dto, nickname: 'yossi' }],
    });
    const result = await service.submitAnswers('ABC123', 'dana', dto);
    expect(result.allAnswered).toBe(true);
    expect(result.triggerRecommendations).toBe(false);
    expect(transaction.update).not.toHaveBeenCalled();
  });

  it('does not double count a resubmission by the same nickname', async () => {
    const { service } = makeService({
      session: { status: 'active', participants: ['dana', 'yossi'] },
      answers: [{ ...dto, nickname: 'dana' }],
    });
    const result = await service.submitAnswers('ABC123', 'dana', dto);
    expect(result.allAnswered).toBe(false);
    expect(result.answers).toHaveLength(1);
  });

  it('ignores stale answers from participants who left', async () => {
    const { service } = makeService({
      session: { status: 'active', participants: ['dana'] },
      answers: [{ ...dto, nickname: 'leaver' }],
    });
    const result = await service.submitAnswers('ABC123', 'dana', dto);
    expect(result.allAnswered).toBe(true);
    expect(result.answers.map((a) => a.nickname)).toEqual(['dana']);
  });

  it('passes the stored film cards through', async () => {
    const filmCards = [{ tmdbId: 7, title: 'X', posterPath: null }];
    const { service } = makeService({
      session: { status: 'active', participants: ['dana'], filmCards },
      answers: [],
    });
    const result = await service.submitAnswers('ABC123', 'dana', dto);
    expect(result.filmCards).toEqual(filmCards);
  });
});

describe('QuestionnaireService.checkAllAnswered', () => {
  it('triggers when all remaining participants have answered', async () => {
    const { service, transaction } = makeService({
      session: { status: 'active', participants: ['dana'] },
      answers: [
        { ...dto, nickname: 'dana' },
        { ...dto, nickname: 'leaver' },
      ],
    });
    const result = await service.checkAllAnswered('ABC123');
    expect(result.triggerRecommendations).toBe(true);
    expect(result.answers.map((a) => a.nickname)).toEqual(['dana']);
    expect(transaction.update).toHaveBeenCalledWith(expect.anything(), {
      recommendationsTriggered: true,
    });
  });

  it('does not trigger when an answer is still missing', async () => {
    const { service } = makeService({
      session: { status: 'active', participants: ['dana', 'yossi'] },
      answers: [{ ...dto, nickname: 'dana' }],
    });
    const result = await service.checkAllAnswered('ABC123');
    expect(result.triggerRecommendations).toBe(false);
  });

  it('does not trigger for inactive or already-triggered sessions', async () => {
    const inactive = makeService({
      session: { status: 'done', participants: ['dana'] },
      answers: [{ ...dto, nickname: 'dana' }],
    });
    await expect(
      inactive.service.checkAllAnswered('ABC123'),
    ).resolves.toMatchObject({ triggerRecommendations: false });

    const triggered = makeService({
      session: {
        status: 'active',
        participants: ['dana'],
        recommendationsTriggered: true,
      },
      answers: [{ ...dto, nickname: 'dana' }],
    });
    await expect(
      triggered.service.checkAllAnswered('ABC123'),
    ).resolves.toMatchObject({ triggerRecommendations: false });
  });

  it('does not trigger when the session has no participants left', async () => {
    const { service } = makeService({
      session: { status: 'active', participants: [] },
      answers: [{ ...dto, nickname: 'leaver' }],
    });
    const result = await service.checkAllAnswered('ABC123');
    expect(result.triggerRecommendations).toBe(false);
  });
});
