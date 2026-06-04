import { Injectable, NotFoundException } from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';

export interface SessionData {
  hostId: string;
  status: 'lobby' | 'active' | 'done';
  participants: string[];
  results: MovieResult[];
  createdAt: FirebaseFirestore.Timestamp;
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
}

@Injectable()
export class SessionsService {
  constructor(private readonly firebase: FirebaseService) {}

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
    await this.firebase.firestore
      .collection('sessions')
      .doc(roomCode)
      .update({ status: 'active' });
  }

  async setResults(roomCode: string, results: MovieResult[]): Promise<void> {
    await this.firebase.firestore
      .collection('sessions')
      .doc(roomCode)
      .update({ status: 'done', results });
  }
}
