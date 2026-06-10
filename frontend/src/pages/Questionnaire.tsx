import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSocket, type WsAck } from '../hooks/useSocket';
import { getFilmCards, type FilmCard } from '../services/api';
import { PARTICIPANT_STORAGE_KEY } from './Lobby';
import type { MovieResult } from './Results';
import './Questionnaire.css';

const GENRES = ['אקשן', 'קומדיה', 'דרמה', 'אימה', 'מד"ב', 'רומנטיקה', 'תיעודי'];

const MOODS = [
  { label: 'שמח',    value: 'happy' },
  { label: 'עייף',   value: 'tired' },
  { label: 'הרפתקני', value: 'adventurous' },
  { label: 'רומנטי', value: 'romantic' },
  { label: 'מתוח',   value: 'tense' },
];

const LENGTHS = [
  { label: 'קצר',    sub: 'עד 90 דק׳',    value: 'short'  },
  { label: 'בינוני', sub: '90–120 דק׳',    value: 'medium' },
  { label: 'ארוך',   sub: 'מעל 2 שעות',   value: 'long'   },
] as const;

const ENERGY = [
  { label: 'נמוכה',   sub: 'ספה ושמיכה', value: 'low'    },
  { label: 'בינונית', sub: 'כוס קפה',    value: 'medium' },
  { label: 'גבוהה',   sub: 'פנייר וסושי', value: 'high'   },
] as const;

const TMDB_IMG = 'https://image.tmdb.org/t/p/w500';

interface LocationState      { roomCode: string; nickname: string }
interface AllAnsweredPayload { results: MovieResult[] }
interface RecommendationErrorPayload { message: string }

function readStoredIdentity(): LocationState {
  try {
    const raw = sessionStorage.getItem(PARTICIPANT_STORAGE_KEY);
    if (raw) return JSON.parse(raw) as LocationState;
  } catch { /* fall through to defaults */ }
  return { roomCode: '', nickname: 'אורח' };
}

function CheckIcon() {
  return (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="5" y1="12" x2="19" y2="12"/>
      <polyline points="12 5 19 12 12 19"/>
    </svg>
  );
}

export default function Questionnaire() {
  const location     = useLocation();
  const navigate     = useNavigate();
  const { emitWithAck, on, status } = useSocket();

  const { roomCode, nickname } =
    (location.state as LocationState | null) ?? readStoredIdentity();

  const [step, setStep]           = useState(0);
  const [mood, setMood]           = useState('');
  const [genres, setGenres]       = useState<string[]>([]);
  const [length, setLength]       = useState<'short' | 'medium' | 'long'>('medium');
  const [energyLevel, setEnergy]  = useState<'low' | 'medium' | 'high'>('medium');
  const [films, setFilms]         = useState<FilmCard[]>([]);
  const [filmIndex, setFilmIndex] = useState(0);
  const [knownFilms, setKnown]    = useState<number[]>([]);
  const [likedFilms, setLiked]    = useState<number[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [recError, setRecError]   = useState<string | null>(null);
  const [hostAway, setHostAway]   = useState(false);

  // The known-films step only exists when the server has film cards
  const hasFilmsStep = films.length > 0;
  const totalSteps   = hasFilmsStep ? 5 : 4;
  const stepLabels   = ['מצב רוח', "ז'אנרים", 'אורך', 'אנרגיה', ...(hasFilmsStep ? ['סרטים'] : [])];

  useEffect(() => {
    if (!roomCode) return;
    getFilmCards(roomCode)
      .then(({ films: cards }) => setFilms(cards))
      .catch(() => setFilms([])); // step is skipped gracefully without cards
  }, [roomCode]);

  useEffect(() => {
    const offAll = on<AllAnsweredPayload>('all_answered', ({ results }) => {
      void navigate('/results', { state: { results } });
    });
    const offRecError = on<RecommendationErrorPayload>('recommendation_error', ({ message }) => {
      setRecError(message);
    });
    const offHostLeft = on('host_left', () => setHostAway(true));
    const offHostBack = on('host_back', () => setHostAway(false));
    return () => { offAll(); offRecError(); offHostLeft(); offHostBack(); };
  }, [on, navigate]);

  // Rejoin the socket room after a reconnect, otherwise all_answered never
  // reaches us (the server allows rejoining an active session)
  useEffect(() => {
    if (!roomCode || status !== 'connected') return;
    emitWithAck('join_session', { roomCode, nickname }).catch(() => {
      /* banner already shows the connection problem */
    });
  }, [roomCode, nickname, status, emitWithAck]);

  const toggleGenre = (g: string) => {
    setGenres((prev) => prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]);
  };

  const submitAnswers = async (known: number[], liked: number[]) => {
    setSubmitted(true);
    setSubmitError(null);
    try {
      const ack = await emitWithAck<WsAck>('answers_submitted', {
        roomCode,
        nickname,
        answers: { mood, genres, length, energyLevel, knownFilms: known, likedFilms: liked },
      });
      if (!ack.ok) setSubmitError(ack.message);
    } catch {
      setSubmitError('שליחת התשובות נכשלה — בדקו את החיבור ונסו שוב');
    }
  };

  const handleEnergyNext = () => {
    if (hasFilmsStep) setStep(4);
    else void submitAnswers(knownFilms, likedFilms);
  };

  // seen: 'liked' | 'seen' | 'no' — last card submits automatically
  const handleFilmAnswer = (verdict: 'liked' | 'seen' | 'no') => {
    const film = films[filmIndex];
    const known = verdict === 'no' ? knownFilms : [...knownFilms, film.tmdbId];
    const liked = verdict === 'liked' ? [...likedFilms, film.tmdbId] : likedFilms;
    setKnown(known);
    setLiked(liked);

    if (filmIndex + 1 < films.length) setFilmIndex(filmIndex + 1);
    else void submitAnswers(known, liked);
  };

  const handleRetrySubmit = () => {
    setSubmitted(false);
    setSubmitError(null);
  };

  const progress = (step / totalSteps) * 100;

  /* ---- Submitted state ---- */
  if (submitted) {
    return (
      <div className="questionnaire-page">
        <h1 className="logo submitted-logo">MOVIHOOT</h1>
        <div className="card submitted-card">
          <div className="submitted-state">
            {submitError ? (
              <>
                <p className="form-error" role="alert">{submitError}</p>
                <button className="btn-primary" onClick={handleRetrySubmit}>
                  נסו שוב
                </button>
              </>
            ) : (
              <>
                <div className="check-circle">
                  <CheckIcon />
                </div>
                <h2>תשובות נשלחו!</h2>
                {recError ? (
                  <p className="form-error" role="alert">{recError}</p>
                ) : (
                  <>
                    <p className="submitted-desc">Claude מנתח את העדפות הקבוצה...</p>
                    {hostAway && (
                      <p className="form-error" role="alert">המארח התנתק — ממתינים שיחזור...</p>
                    )}
                    <div className="waiting-status waiting-status--full">
                      <div className="spinner" />
                      ממתין לשאר המשתתפים
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ---- Questions ---- */
  return (
    <div className="questionnaire-page">
      <h1 className="logo questionnaire-logo--mb">MOVIHOOT</h1>

      <div className="progress-bar-track">
        {/* width is data-driven — stays inline */}
        <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
      </div>

      <div className="question-card card">
        <p className="question-step-label">
          שלב {step + 1} מתוך {totalSteps} — {stepLabels[step]}
        </p>

        {/* Step 0: Mood */}
        {step === 0 && (
          <>
            <h2 className="question-title">מה המצב רוח שלך הערב?</h2>
            <div className="options-grid options-grid--mood">
              {MOODS.map((m) => (
                <button
                  key={m.value}
                  className={`option-btn${mood === m.value ? ' selected' : ''}`}
                  onClick={() => setMood(m.value)}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <button className="btn-primary" onClick={() => setStep(1)} disabled={!mood}>
              הבא <ArrowIcon />
            </button>
          </>
        )}

        {/* Step 1: Genres */}
        {step === 1 && (
          <>
            <h2 className="question-title">איזה ז׳אנר תרצה לראות?</h2>
            <div className="options-grid">
              {GENRES.map((g) => (
                <button
                  key={g}
                  className={`option-btn${genres.includes(g) ? ' selected' : ''}`}
                  onClick={() => toggleGenre(g)}
                  aria-pressed={genres.includes(g)}
                >
                  {g}
                </button>
              ))}
            </div>
            <button className="btn-primary" onClick={() => setStep(2)} disabled={genres.length === 0}>
              הבא <ArrowIcon />
            </button>
          </>
        )}

        {/* Step 2: Length */}
        {step === 2 && (
          <>
            <h2 className="question-title">כמה זמן יש לך?</h2>
            <div className="options-row">
              {LENGTHS.map((l) => (
                <button
                  key={l.value}
                  className={`option-btn option-btn--stacked${length === l.value ? ' selected' : ''}`}
                  onClick={() => setLength(l.value)}
                >
                  <span className="option-label-main">{l.label}</span>
                  <span className="option-label-sub">{l.sub}</span>
                </button>
              ))}
            </div>
            <button className="btn-primary" onClick={() => setStep(3)}>
              הבא <ArrowIcon />
            </button>
          </>
        )}

        {/* Step 3: Energy */}
        {step === 3 && (
          <>
            <h2 className="question-title">מה רמת האנרגיה שלך?</h2>
            <div className="options-row">
              {ENERGY.map((e) => (
                <button
                  key={e.value}
                  className={`option-btn option-btn--stacked${energyLevel === e.value ? ' selected' : ''}`}
                  onClick={() => setEnergy(e.value)}
                >
                  <span className="option-label-main">{e.label}</span>
                  <span className="option-label-sub">{e.sub}</span>
                </button>
              ))}
            </div>
            {hasFilmsStep ? (
              <button className="btn-primary" onClick={handleEnergyNext}>
                הבא <ArrowIcon />
              </button>
            ) : (
              <button className="btn-gold" onClick={handleEnergyNext}>
                <CheckIcon />
                שלח תשובות
              </button>
            )}
          </>
        )}

        {/* Step 4: Known films */}
        {step === 4 && hasFilmsStep && (
          <>
            <h2 className="question-title">הכרת סרטים — ראית את הסרט הזה?</h2>
            <p className="film-progress">
              סרט {filmIndex + 1} מתוך {films.length}
            </p>
            <div className="film-card" key={films[filmIndex].tmdbId}>
              {films[filmIndex].posterPath ? (
                <img
                  src={`${TMDB_IMG}${films[filmIndex].posterPath}`}
                  alt={`פוסטר של ${films[filmIndex].title}`}
                  className="film-card-poster"
                />
              ) : (
                <div className="film-card-poster film-card-poster--empty" aria-hidden="true" />
              )}
              <p className="film-card-title">
                {films[filmIndex].title}
                {films[filmIndex].releaseYear && (
                  <span className="film-card-year"> ({films[filmIndex].releaseYear})</span>
                )}
              </p>
            </div>
            <div className="film-actions">
              <button className="btn-gold film-action-btn" onClick={() => handleFilmAnswer('liked')}>
                ראיתי ואהבתי
              </button>
              <button className="btn-primary film-action-btn" onClick={() => handleFilmAnswer('seen')}>
                ראיתי
              </button>
              <button className="btn-ghost film-action-btn" onClick={() => handleFilmAnswer('no')}>
                לא ראיתי
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
