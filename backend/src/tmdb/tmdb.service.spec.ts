import { TmdbService } from './tmdb.service';

const mockGet = jest.fn();

jest.mock('axios', () => ({
  __esModule: true,
  default: { create: jest.fn(() => ({ get: mockGet })) },
}));

describe('TmdbService', () => {
  let service: TmdbService;

  beforeEach(() => {
    mockGet.mockReset();
    service = new TmdbService();
  });

  describe('getPopularMovies', () => {
    it('maps and limits the popular results', async () => {
      mockGet.mockResolvedValue({
        data: {
          results: [
            {
              id: 1,
              title: 'One',
              poster_path: '/1.jpg',
              release_date: '2024-01-01',
            },
            {
              id: 2,
              title: 'Two',
              poster_path: null,
              release_date: '2023-06-15',
            },
            {
              id: 3,
              title: 'Three',
              poster_path: '/3.jpg',
              release_date: '2022-03-10',
            },
          ],
        },
      });
      const films = await service.getPopularMovies(2);
      expect(films).toEqual([
        { tmdbId: 1, title: 'One', posterPath: '/1.jpg', releaseYear: '2024' },
        { tmdbId: 2, title: 'Two', posterPath: null, releaseYear: '2023' },
      ]);
    });

    it('propagates request failures to the caller', async () => {
      mockGet.mockRejectedValue(new Error('network'));
      await expect(service.getPopularMovies(5)).rejects.toThrow('network');
    });
  });

  describe('getWatchProviders', () => {
    const provider = (id: number, name: string) => ({
      provider_id: id,
      provider_name: name,
      logo_path: `/${id}.jpg`,
    });

    it('prefers the requested region', async () => {
      mockGet.mockResolvedValue({
        data: {
          results: {
            IL: { flatrate: [provider(8, 'Netflix')] },
            US: { flatrate: [provider(9, 'Hulu')] },
          },
        },
      });
      const providers = await service.getWatchProviders(1);
      expect(providers).toEqual([
        { providerName: 'Netflix', logoPath: '/8.jpg' },
      ]);
    });

    it('falls back to US when the region is missing', async () => {
      mockGet.mockResolvedValue({
        data: { results: { US: { flatrate: [provider(9, 'Hulu')] } } },
      });
      const providers = await service.getWatchProviders(1);
      expect(providers).toEqual([{ providerName: 'Hulu', logoPath: '/9.jpg' }]);
    });

    it('dedupes across categories and caps at 4 providers', async () => {
      mockGet.mockResolvedValue({
        data: {
          results: {
            IL: {
              flatrate: [provider(1, 'A'), provider(2, 'B'), provider(3, 'C')],
              ads: [provider(1, 'A'), provider(4, 'D')],
              free: [provider(5, 'E')],
            },
          },
        },
      });
      const providers = await service.getWatchProviders(1);
      expect(providers).toHaveLength(4);
      expect(providers.map((p) => p.providerName)).toEqual([
        'A',
        'B',
        'C',
        'D',
      ]);
    });

    it('returns an empty list when no region data exists', async () => {
      mockGet.mockResolvedValue({ data: { results: {} } });
      await expect(service.getWatchProviders(1)).resolves.toEqual([]);
    });

    it('returns an empty list on request failure', async () => {
      mockGet.mockRejectedValue(new Error('network'));
      await expect(service.getWatchProviders(1)).resolves.toEqual([]);
    });
  });
});
