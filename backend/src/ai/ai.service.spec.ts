import { AiService } from './ai.service';
import type { TmdbService } from '../tmdb/tmdb.service';
import type { ParticipantAnswers } from '../questionnaire/questionnaire.service';

interface ClaudeRequest {
  model: string;
  messages: { role: string; content: string }[];
}

const mockCreate = jest.fn<Promise<unknown>, [ClaudeRequest]>();

jest.mock('@anthropic-ai/sdk', () =>
  jest.fn().mockImplementation(() => ({ messages: { create: mockCreate } })),
);

const answer = (overrides: Partial<ParticipantAnswers> = {}) => ({
  nickname: 'dana',
  mood: 'happy',
  genres: ['קומדיה'],
  length: 'medium',
  energyLevel: 'high',
  submittedAt: new Date(),
  ...overrides,
});

const claudeJson = JSON.stringify({
  movies: [
    { tmdbId: 11, title: 'Movie A', reason: 'fun', matchScore: 91 },
    { tmdbId: 22, title: 'Movie B', reason: 'light', matchScore: 84 },
  ],
});

function claudeReply(text: string) {
  return { content: [{ type: 'text', text }] };
}

describe('AiService', () => {
  let service: AiService;
  let tmdb: { getMovieDetails: jest.Mock; getWatchProviders: jest.Mock };

  beforeEach(() => {
    mockCreate.mockReset();
    tmdb = {
      getMovieDetails: jest.fn().mockResolvedValue({
        id: 11,
        title: 'Movie A',
        overview: 'desc',
        poster_path: '/p.jpg',
        release_date: '2023-05-01',
        runtime: 105,
      }),
      getWatchProviders: jest
        .fn()
        .mockResolvedValue([{ providerName: 'Netflix', logoPath: '/n.jpg' }]),
    };
    service = new AiService(tmdb as unknown as TmdbService);
  });

  it('parses a clean JSON response and enriches with TMDB', async () => {
    mockCreate.mockResolvedValue(claudeReply(claudeJson));
    const results = await service.getRecommendations([answer()]);
    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({
      tmdbId: 11,
      title: 'Movie A',
      matchScore: 91,
      posterPath: '/p.jpg',
      releaseYear: '2023',
      runtime: 105,
      providers: [{ providerName: 'Netflix', logoPath: '/n.jpg' }],
    });
  });

  it('parses JSON wrapped in markdown fences', async () => {
    mockCreate.mockResolvedValue(
      claudeReply('```json\n' + claudeJson + '\n```'),
    );
    const results = await service.getRecommendations([answer()]);
    expect(results).toHaveLength(2);
  });

  it('throws on an unparseable response', async () => {
    mockCreate.mockResolvedValue(claudeReply('sorry, no JSON for you'));
    await expect(service.getRecommendations([answer()])).rejects.toThrow(
      'Could not parse Claude recommendations response',
    );
  });

  it('throws when the response contains no movies', async () => {
    mockCreate.mockResolvedValue(claudeReply('{ "movies": [] }'));
    await expect(service.getRecommendations([answer()])).rejects.toThrow(
      'no movie recommendations',
    );
  });

  it('includes group preferences and seen/liked films in the prompt', async () => {
    mockCreate.mockResolvedValue(claudeReply(claudeJson));
    const filmCards = [
      { tmdbId: 100, title: 'Seen Film', posterPath: null },
      { tmdbId: 200, title: 'Liked Film', posterPath: null },
    ];
    await service.getRecommendations(
      [
        answer({ knownFilms: [100, 200], likedFilms: [200] }),
        answer({ nickname: 'yossi', mood: 'tired', genres: ['דרמה'] }),
      ],
      filmCards,
    );

    const prompt = mockCreate.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain('A group of 2 people');
    expect(prompt).toContain('happy, tired');
    expect(prompt).toContain('קומדיה, דרמה');
    expect(prompt).toContain('do NOT recommend');
    expect(prompt).toContain('Seen Film (tmdbId 100)');
    expect(prompt).toContain('taste signal');
    expect(prompt).toContain('Liked Film (tmdbId 200)');
  });

  it('omits the seen/liked lines when no films were marked', async () => {
    mockCreate.mockResolvedValue(claudeReply(claudeJson));
    await service.getRecommendations([answer()]);
    const prompt = mockCreate.mock.calls[0][0].messages[0].content;
    expect(prompt).not.toContain('do NOT recommend');
  });

  it('returns a bare recommendation when TMDB enrichment fails', async () => {
    mockCreate.mockResolvedValue(claudeReply(claudeJson));
    tmdb.getMovieDetails.mockRejectedValue(new Error('tmdb down'));
    const results = await service.getRecommendations([answer()]);
    expect(results[0]).toEqual({
      tmdbId: 11,
      title: 'Movie A',
      reason: 'fun',
      matchScore: 91,
    });
  });
});
