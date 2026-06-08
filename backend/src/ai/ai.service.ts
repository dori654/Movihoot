import { Injectable, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import axios from 'axios';
import { ParticipantAnswers } from '../questionnaire/questionnaire.service';
import { MovieResult } from '../sessions/sessions.service';

interface ClaudeMovie {
  tmdbId: number;
  title: string;
  reason: string;
  matchScore: number;
}

interface ClaudeResponse {
  movies: ClaudeMovie[];
}

interface TmdbMovieDetails {
  id: number;
  title: string;
  overview: string;
  poster_path: string | null;
  release_date: string;
  runtime: number | null;
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private readonly anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  async getRecommendations(
    answers: ParticipantAnswers[],
  ): Promise<MovieResult[]> {
    const summary = this.buildAnswersSummary(answers);

    const message = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system:
        'You are a movie recommendation expert. Given group preferences, return exactly 5 movie recommendations as JSON. Respond ONLY with valid JSON — no markdown, no extra text.',
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

  private buildAnswersSummary(answers: ParticipantAnswers[]): string {
    const moods = answers.map((a) => a.mood).join(', ');
    const genres = [...new Set(answers.flatMap((a) => a.genres))].join(', ');
    const lengths = answers.map((a) => a.length).join(', ');
    const energies = answers.map((a) => a.energyLevel).join(', ');

    return [
      `Moods: ${moods}`,
      `Preferred genres: ${genres}`,
      `Movie length preferences: ${lengths}`,
      `Energy levels: ${energies}`,
    ].join('\n');
  }

  private async enrichWithTmdb(movies: ClaudeMovie[]): Promise<MovieResult[]> {
    const tmdbKey = process.env.TMDB_API_KEY;
    const base = process.env.TMDB_BASE_URL ?? 'https://api.themoviedb.org/3';

    const results = await Promise.allSettled(
      movies.map(async (movie): Promise<MovieResult> => {
        try {
          const { data } = await axios.get<TmdbMovieDetails>(
            `${base}/movie/${movie.tmdbId}`,
            { params: { api_key: tmdbKey } },
          );
          return {
            tmdbId: movie.tmdbId,
            title: movie.title,
            reason: movie.reason,
            matchScore: movie.matchScore,
            posterPath: data.poster_path ?? undefined,
            overview: data.overview,
            releaseYear: data.release_date?.slice(0, 4),
            runtime: data.runtime ?? undefined,
          };
        } catch {
          // TMDB enrichment failed — return bare recommendation
          return {
            tmdbId: movie.tmdbId,
            title: movie.title,
            reason: movie.reason,
            matchScore: movie.matchScore,
          };
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
