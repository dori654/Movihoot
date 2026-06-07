import type { MovieResult } from '../pages/Results';

const TMDB_IMG = 'https://image.tmdb.org/t/p/w500';

interface Props {
  movie: MovieResult;
}

export default function MovieCard({ movie }: Props) {
  return (
    <div className="movie-card">
      {movie.posterPath ? (
        <img
          src={`${TMDB_IMG}${movie.posterPath}`}
          alt={movie.title}
          className="movie-poster"
        />
      ) : (
        <div className="movie-poster-placeholder">🎬</div>
      )}
      <div className="movie-info">
        <h3>{movie.title}</h3>
        {movie.releaseYear && <span className="year">{movie.releaseYear}</span>}
        {movie.runtime && <span className="runtime">{movie.runtime} דק׳</span>}
        <div className="match-score">
          התאמה: <strong>{movie.matchScore}%</strong>
        </div>
        <p className="reason">{movie.reason}</p>
        {movie.overview && <p className="overview">{movie.overview}</p>}
      </div>
    </div>
  );
}
