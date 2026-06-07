import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSocket } from '../hooks/useSocket';
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

const STEPS      = 4;
const STEP_LABELS = ['מצב רוח', "ז'אנרים", 'אורך', 'אנרגיה'];

interface LocationState     { roomCode: string; nickname: string }
interface AllAnsweredPayload { results: MovieResult[] }

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
  const { emit, on } = useSocket();

  const { roomCode, nickname } = (location.state as LocationState | null) ?? {
    roomCode: '',
    nickname: 'אורח',
  };

  const [step, setStep]           = useState(0);
  const [mood, setMood]           = useState('');
  const [genres, setGenres]       = useState<string[]>([]);
  const [length, setLength]       = useState<'short' | 'medium' | 'long'>('medium');
  const [energyLevel, setEnergy]  = useState<'low' | 'medium' | 'high'>('medium');
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const offAll = on<AllAnsweredPayload>('all_answered', ({ results }) => {
      void navigate('/results', { state: { results } });
    });
    return offAll;
  }, [on, navigate]);

  const toggleGenre = (g: string) => {
    setGenres((prev) => prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]);
  };

  const handleSubmit = () => {
    emit('answers_submitted', {
      roomCode,
      nickname,
      answers: { mood, genres, length, energyLevel, knownFilms: [] },
    });
    setSubmitted(true);
  };

  const progress = (step / STEPS) * 100;

  /* ---- Submitted state ---- */
  if (submitted) {
    return (
      <div className="questionnaire-page">
        <h1 className="logo submitted-logo">MOVIHOOT</h1>
        <div className="card submitted-card">
          <div className="submitted-state">
            <div className="check-circle">
              <CheckIcon />
            </div>
            <h2>תשובות נשלחו!</h2>
            <p className="submitted-desc">Claude מנתח את העדפות הקבוצה...</p>
            <div className="waiting-status waiting-status--full">
              <div className="spinner" />
              ממתין לשאר המשתתפים
            </div>
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
          שלב {step + 1} מתוך {STEPS} — {STEP_LABELS[step]}
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
            <button className="btn-gold" onClick={handleSubmit}>
              <CheckIcon />
              שלח תשובות
            </button>
          </>
        )}
      </div>
    </div>
  );
}
