import { useLocation } from 'react-router-dom';
import MovieCard from '../components/MovieCard';
import './Results.css';

export interface MovieResult {
  tmdbId:      number;
  title:       string;
  reason:      string;
  matchScore:  number;
  posterPath?: string;
  overview?:   string;
  releaseYear?: string;
  runtime?:    number;
}

interface LocationState { results: MovieResult[] }

export default function Results() {
  const location = useLocation();
  const { results } = (location.state as LocationState | null) ?? { results: [] };

  if (results.length === 0) {
    return (
      <div className="page-center">
        <div className="spinner spinner--results" />
        <h2 className="loading-heading">ממתין לתוצאות...</h2>
      </div>
    );
  }

  return (
    <div className="results-page">
      <div className="results-header animate-fade-in-up">
        <h1 className="logo">MOVIHOOT</h1>
        <div className="neon-divider neon-divider--results" />
        <h2 className="results-title">הסרטים המומלצים לכם</h2>
        <p className="results-sub">5 סרטים שנבחרו על ידי Claude לקבוצה שלכם</p>
      </div>

      <div className="movie-grid container-wide">
        {results.map((movie) => (
          <MovieCard key={movie.tmdbId} movie={movie} />
        ))}
      </div>
    </div>
  );
}
