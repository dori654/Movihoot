import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { ParticipantAnswers } from '../questionnaire/questionnaire.service';
import { MovieResult } from '../sessions/sessions.service';
import { TmdbService, type FilmCard } from '../tmdb/tmdb.service';

interface ClaudeMovie {
  tmdbId: number;
  title: string;
  reason: string;
  matchScore: number;
}

interface ClaudeResponse {
  movies: ClaudeMovie[];
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    timeout: 30_000,
    maxRetries: 1,
  });

  constructor(private readonly tmdb: TmdbService) {}

  async getRecommendations(
    answers: ParticipantAnswers[],
    filmCards: FilmCard[] = [],
  ): Promise<MovieResult[]> {
    const summary = this.buildAnswersSummary(answers, filmCards);

    const started = Date.now();
    const message = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system:
        'You are a movie recommendation expert. Given group preferences, return exactly 5 movie recommendations as JSON. ' +
        'Never recommend a movie the group has already seen. Use films the group liked as a signal of their taste. ' +
        'Respond ONLY with valid JSON — no markdown, no extra text.',
      messages: [
        {
          role: 'user',
          content:
            `A group of ${answers.length} people answered these questions:\n\n` +
            `${summary}\n\n` +
            `Return JSON: { "movies": [ { "tmdbId": number, "title": string, "reason": string, "matchScore": number } ] }\n` +
            `"matchScore" must be an integer from 0 to 100 representing the percentage match with the group's preferences.`,
        },
      ],
    });
    this.logger.log(
      `Claude recommendations call took ${Date.now() - started}ms for ${answers.length} participants`,
    );

    const raw = (message.content[0] as { type: string; text: string }).text;
    // Claude sometimes wraps JSON in markdown fences despite instructions not to
    const cleaned = raw.trim().replace(/^```(?:json)?\s*|\s*```$/g, '');
    let parsed: ClaudeResponse;

    try {
      parsed = JSON.parse(cleaned) as ClaudeResponse;
    } catch {
      this.logger.error(`Failed to parse Claude response: ${raw}`);
      throw new Error('Could not parse Claude recommendations response');
    }

    if (!Array.isArray(parsed.movies) || parsed.movies.length === 0) {
      this.logger.error(`Claude response had no movies: ${raw}`);
      throw new Error('Claude response contained no movie recommendations');
    }

    return this.enrichWithTmdb(parsed.movies);
  }

  private buildAnswersSummary(
    answers: ParticipantAnswers[],
    filmCards: FilmCard[],
  ): string {
    const moods = answers.map((a) => a.mood).join(', ');
    const genres = [...new Set(answers.flatMap((a) => a.genres))].join(', ');
    const lengths = answers.map((a) => a.length).join(', ');
    const energies = answers.map((a) => a.energyLevel).join(', ');

    const lines = [
      `Moods: ${moods}`,
      `Preferred genres: ${genres}`,
      `Movie length preferences: ${lengths}`,
      `Energy levels: ${energies}`,
    ];

    const titleOf = (id: number) =>
      filmCards.find((f) => f.tmdbId === id)?.title ?? `tmdbId ${id}`;

    const seenIds = [...new Set(answers.flatMap((a) => a.knownFilms ?? []))];
    if (seenIds.length > 0) {
      lines.push(
        `Movies the group has already seen — do NOT recommend any of these: ${seenIds
          .map((id) => `${titleOf(id)} (tmdbId ${id})`)
          .join(', ')}`,
      );
    }

    const likedIds = [...new Set(answers.flatMap((a) => a.likedFilms ?? []))];
    if (likedIds.length > 0) {
      lines.push(
        `Movies group members saw and liked — use these as a taste signal: ${likedIds
          .map((id) => `${titleOf(id)} (tmdbId ${id})`)
          .join(', ')}`,
      );
    }

    return lines.join('\n');
  }

  private async enrichWithTmdb(movies: ClaudeMovie[]): Promise<MovieResult[]> {
    const results = await Promise.allSettled(
      movies.map(async (movie): Promise<MovieResult> => {
        const base: MovieResult = {
          tmdbId: movie.tmdbId,
          title: movie.title,
          reason: movie.reason,
          matchScore: movie.matchScore,
        };
        try {
          const [details, providers] = await Promise.all([
            this.tmdb.getMovieDetails(movie.tmdbId),
            this.tmdb.getWatchProviders(movie.tmdbId),
          ]);
          return {
            ...base,
            posterPath: details.poster_path ?? undefined,
            overview: details.overview,
            releaseYear: details.release_date?.slice(0, 4),
            runtime: details.runtime ?? undefined,
            providers,
          };
        } catch {
          // TMDB enrichment failed — return bare recommendation
          return base;
        }
      }),
    );

    return results
      .filter(
        (r): r is PromiseFulfilledResult<MovieResult> =>
          r.status === 'fulfilled',
      )
      .map((r) => r.value);
  }
}
