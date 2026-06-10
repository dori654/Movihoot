import { NotFoundException } from '@nestjs/common';
import { SessionsService, type SessionData } from './sessions.service';
import type { FirebaseService } from '../firebase/firebase.service';
import type { TmdbService } from '../tmdb/tmdb.service';

describe('SessionsService', () => {
  let service: SessionsService;
  let docMock: { set: jest.Mock; get: jest.Mock; update: jest.Mock };
  let tmdbMock: { getPopularMovies: jest.Mock };

  beforeEach(() => {
    docMock = {
      set: jest.fn().mockResolvedValue(undefined),
      get: jest.fn(),
      update: jest.fn().mockResolvedValue(undefined),
    };
    const firestore = {
      collection: jest.fn(() => ({ doc: jest.fn(() => docMock) })),
    };
    tmdbMock = { getPopularMovies: jest.fn().mockResolvedValue([]) };
    service = new SessionsService(
      { firestore } as unknown as FirebaseService,
      tmdbMock as unknown as TmdbService,
    );
  });

  describe('generateRoomCode', () => {
    it('returns 6 uppercase alphanumeric chars', () => {
      for (let i = 0; i < 50; i++) {
        expect(service.generateRoomCode()).toMatch(/^[A-Z0-9]{6}$/);
      }
    });
  });

  describe('createSession', () => {
    it('writes a lobby session doc and returns the room code', async () => {
      const roomCode = await service.createSession('host-uid');
      expect(roomCode).toMatch(/^[A-Z0-9]{6}$/);
      expect(docMock.set).toHaveBeenCalledWith({
        hostId: 'host-uid',
        status: 'lobby',
        participants: [],
        results: [],
        createdAt: expect.any(Date) as Date,
      });
    });
  });

  describe('getSession', () => {
    it('throws NotFoundException when the doc does not exist', async () => {
      docMock.get.mockResolvedValue({ exists: false });
      await expect(service.getSession('NOPE99')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns the session data when it exists', async () => {
      const data = { hostId: 'h', status: 'lobby', participants: [] };
      docMock.get.mockResolvedValue({ exists: true, data: () => data });
      await expect(service.getSession('ABC123')).resolves.toEqual(data);
    });
  });

  describe('isExpired', () => {
    const base = {
      hostId: 'h',
      status: 'lobby',
      participants: [],
      results: [],
    };

    it('is false for a fresh session', () => {
      const session = { ...base, createdAt: new Date() } as SessionData;
      expect(service.isExpired(session)).toBe(false);
    });

    it('is true for a session older than 12 hours', () => {
      const old = new Date(Date.now() - 13 * 60 * 60 * 1000);
      const session = { ...base, createdAt: old } as SessionData;
      expect(service.isExpired(session)).toBe(true);
    });

    it('handles Firestore Timestamp values', () => {
      const old = new Date(Date.now() - 13 * 60 * 60 * 1000);
      const session = {
        ...base,
        createdAt: { toDate: () => old },
      } as unknown as SessionData;
      expect(service.isExpired(session)).toBe(true);
    });
  });

  describe('startSession', () => {
    it('stores fetched film cards and sets status active', async () => {
      const cards = [
        { tmdbId: 1, title: 'A', posterPath: '/a.jpg', releaseYear: '2024' },
      ];
      tmdbMock.getPopularMovies.mockResolvedValue(cards);
      await service.startSession('ABC123');
      expect(docMock.update).toHaveBeenCalledWith({
        status: 'active',
        filmCards: cards,
      });
    });

    it('stores empty film cards when TMDB fails', async () => {
      tmdbMock.getPopularMovies.mockRejectedValue(new Error('tmdb down'));
      await service.startSession('ABC123');
      expect(docMock.update).toHaveBeenCalledWith({
        status: 'active',
        filmCards: [],
      });
    });
  });
});
