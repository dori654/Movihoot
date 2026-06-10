import { Injectable, Logger } from '@nestjs/common';
import axios, { type AxiosInstance } from 'axios';

export interface TmdbMovieDetails {
  id: number;
  title: string;
  overview: string;
  poster_path: string | null;
  release_date: string;
  runtime: number | null;
}

export interface FilmCard {
  tmdbId: number;
  title: string;
  posterPath: string | null;
  releaseYear?: string;
}

export interface WatchProvider {
  providerName: string;
  logoPath: string;
}

interface TmdbPopularResponse {
  results: {
    id: number;
    title: string;
    poster_path: string | null;
    release_date: string;
  }[];
}

interface TmdbProviderEntry {
  provider_id: number;
  provider_name: string;
  logo_path: string;
}

interface TmdbWatchProvidersResponse {
  results: Record<
    string,
    {
      flatrate?: TmdbProviderEntry[];
      ads?: TmdbProviderEntry[];
      free?: TmdbProviderEntry[];
    }
  >;
}

const MAX_PROVIDERS = 4;

@Injectable()
export class TmdbService {
  private readonly logger = new Logger(TmdbService.name);
  private readonly http: AxiosInstance = axios.create({ timeout: 10_000 });

  private get baseUrl(): string {
    return process.env.TMDB_BASE_URL ?? 'https://api.themoviedb.org/3';
  }

  private get apiKey(): string | undefined {
    return process.env.TMDB_API_KEY;
  }

  async getMovieDetails(tmdbId: number): Promise<TmdbMovieDetails> {
    const { data } = await this.http.get<TmdbMovieDetails>(
      `${this.baseUrl}/movie/${tmdbId}`,
      { params: { api_key: this.apiKey } },
    );
    return data;
  }

  async getPopularMovies(count: number, language = 'he'): Promise<FilmCard[]> {
    const { data } = await this.http.get<TmdbPopularResponse>(
      `${this.baseUrl}/movie/popular`,
      { params: { api_key: this.apiKey, language } },
    );
    return data.results.slice(0, count).map((movie) => ({
      tmdbId: movie.id,
      title: movie.title,
      posterPath: movie.poster_path,
      releaseYear: movie.release_date?.slice(0, 4),
    }));
  }

  async getWatchProviders(
    tmdbId: number,
    region = 'IL',
  ): Promise<WatchProvider[]> {
    try {
      const { data } = await this.http.get<TmdbWatchProvidersResponse>(
        `${this.baseUrl}/movie/${tmdbId}/watch/providers`,
        { params: { api_key: this.apiKey } },
      );
      const regional = data.results?.[region] ?? data.results?.US;
      if (!regional) return [];

      const entries = [
        ...(regional.flatrate ?? []),
        ...(regional.ads ?? []),
        ...(regional.free ?? []),
      ];
      const seen = new Set<number>();
      const unique = entries.filter((p) => {
        if (seen.has(p.provider_id)) return false;
        seen.add(p.provider_id);
        return true;
      });
      return unique.slice(0, MAX_PROVIDERS).map((p) => ({
        providerName: p.provider_name,
        logoPath: p.logo_path,
      }));
    } catch (err) {
      this.logger.warn(
        `Failed to fetch watch providers for movie ${tmdbId}: ${err instanceof Error ? err.message : String(err)}`,
      );
      return [];
    }
  }
}
