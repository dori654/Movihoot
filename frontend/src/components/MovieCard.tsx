import type { MovieResult } from '../pages/Results';
import './MovieCard.css';

const TMDB_IMG = 'https://image.tmdb.org/t/p/w500';

interface Props { movie: MovieResult }

function FilmPlaceholderIcon() {
  return (
    <svg
      className="film-placeholder-icon"
      width="48"
      height="48"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/>
      <line x1="7"  y1="2"  x2="7"  y2="22"/>
      <line x1="17" y1="2"  x2="17" y2="22"/>
      <line x1="2"  y1="12" x2="22" y2="12"/>
    </svg>
  );
}

export default function MovieCard({ movie }: Props) {
  /* scoreWidth is data-driven — CSS-variable trick not possible here */
  const scoreWidth = `${Math.min(100, Math.max(0, movie.matchScore))}%`;

  return (
    <article className="movie-card">
      {movie.posterPath ? (
        <img
          src={`${TMDB_IMG}${movie.posterPath}`}
          alt={`פוסטר של ${movie.title}`}
          className="movie-poster"
          loading="lazy"
        />
      ) : (
        <div className="movie-poster-placeholder" aria-hidden="true">
          <FilmPlaceholderIcon />
        </div>
      )}

      <div className="movie-info">
        <h3 className="movie-title">{movie.title}</h3>

        {(movie.releaseYear ?? movie.runtime) && (
          <div className="movie-meta">
            {movie.releaseYear && <span className="meta-tag">{movie.releaseYear}</span>}
            {movie.runtime     && <span className="meta-tag">{movie.runtime} דק׳</span>}
          </div>
        )}

        {movie.providers && movie.providers.length > 0 && (
          <div className="movie-providers">
            <span className="movie-providers-label">זמין לצפייה ב:</span>
            {movie.providers.map((p) => (
              <img
                key={p.providerName}
                src={`https://image.tmdb.org/t/p/w92${p.logoPath}`}
                alt={p.providerName}
                title={p.providerName}
                className="provider-logo"
                loading="lazy"
              />
            ))}
          </div>
        )}

        <div className="match-score">
          <div
            className="match-score-bar"
            role="progressbar"
            aria-valuenow={movie.matchScore}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            {/* width is data-driven — intentionally inline */}
            <div className="match-score-fill" style={{ width: scoreWidth }} />
          </div>
          <span className="match-score-value">{movie.matchScore}%</span>
        </div>

        <p className="movie-reason">{movie.reason}</p>
      </div>
    </article>
  );
}
