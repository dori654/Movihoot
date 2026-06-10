import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';
import {
  TmdbService,
  type FilmCard,
  type WatchProvider,
} from '../tmdb/tmdb.service';
import { FILM_CARDS_COUNT } from '../questionnaire/questionnaire.constants';

export interface SessionData {
  hostId: string;
  status: 'lobby' | 'active' | 'done';
  participants: string[];
  results: MovieResult[];
  createdAt: FirebaseFirestore.Timestamp | Date;
  recommendationsTriggered?: boolean;
  filmCards?: FilmCard[];
}

export interface MovieResult {
  tmdbId: number;
  title: string;
  reason: string;
  matchScore: number;
  posterPath?: string;
  overview?: string;
  releaseYear?: string;
  runtime?: number;
  providers?: WatchProvider[];
}

const SESSION_TTL_MS = 12 * 60 * 60 * 1000;

@Injectable()
export class SessionsService {
  private readonly logger = new Logger(SessionsService.name);

  constructor(
    private readonly firebase: FirebaseService,
    private readonly tmdb: TmdbService,
  ) {}

  generateRoomCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    return Array.from(
      { length: 6 },
      () => chars[Math.floor(Math.random() * chars.length)],
    ).join('');
  }

  async createSession(hostId: string): Promise<string> {
    const roomCode = this.generateRoomCode();
    await this.firebase.firestore.collection('sessions').doc(roomCode).set({
      hostId,
      status: 'lobby',
      participants: [],
      results: [],
      createdAt: new Date(),
    });
    this.logger.log(`Session ${roomCode} created by host ${hostId}`);
    return roomCode;
  }

  async getSession(roomCode: string): Promise<SessionData> {
    const doc = await this.firebase.firestore
      .collection('sessions')
      .doc(roomCode)
      .get();

    if (!doc.exists)
      throw new NotFoundException(`Session ${roomCode} not found`);
    return doc.data() as SessionData;
  }

  isExpired(session: SessionData): boolean {
    const createdAt =
      session.createdAt instanceof Date
        ? session.createdAt
        : session.createdAt?.toDate?.();
    if (!createdAt) return false;
    return Date.now() - createdAt.getTime() > SESSION_TTL_MS;
  }

  async addParticipant(roomCode: string, nickname: string): Promise<void> {
    const { FieldValue } = await import('firebase-admin/firestore');
    await this.firebase.firestore
      .collection('sessions')
      .doc(roomCode)
      .update({ participants: FieldValue.arrayUnion(nickname) });
  }

  async removeParticipant(roomCode: string, nickname: string): Promise<void> {
    const { FieldValue } = await import('firebase-admin/firestore');
    await this.firebase.firestore
      .collection('sessions')
      .doc(roomCode)
      .update({ participants: FieldValue.arrayRemove(nickname) });
  }

  async startSession(roomCode: string): Promise<void> {
    // Fetch the film cards once at start so every participant sees the same
    // films even if TMDB's popular list shifts mid-session
    let filmCards: FilmCard[] = [];
    try {
      filmCards = await this.tmdb.getPopularMovies(FILM_CARDS_COUNT, 'he');
    } catch (err) {
      this.logger.warn(
        `Could not fetch film cards for ${roomCode} — the known-films step will be skipped: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    await this.firebase.firestore
      .collection('sessions')
      .doc(roomCode)
      .update({ status: 'active', filmCards });
    this.logger.log(
      `Session ${roomCode} started (${filmCards.length} film cards)`,
    );
  }

  async setResults(roomCode: string, results: MovieResult[]): Promise<void> {
    await this.firebase.firestore
      .collection('sessions')
      .doc(roomCode)
      .update({ status: 'done', results });
    this.logger.log(`Session ${roomCode} done — ${results.length} results`);
  }
}
