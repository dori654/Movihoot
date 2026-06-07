import { useLocation } from 'react-router-dom';
import MovieCard from '../components/MovieCard';

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

interface LocationState {
  results: MovieResult[];
}

export default function Results() {
  const location = useLocation();
  const { results } = (location.state as LocationState | null) ?? { results: [] };

  if (results.length === 0) {
    return (
      <div className="center-page">
        <h2>⏳ ממתין לתוצאות...</h2>
      </div>
    );
  }

  return (
    <div className="results">
      <h1>🎬 הסרטים המומלצים לכם</h1>
      <div className="movie-grid">
        {results.map((movie) => (
          <MovieCard key={movie.tmdbId} movie={movie} />
        ))}
      </div>
    </div>
  );
}
