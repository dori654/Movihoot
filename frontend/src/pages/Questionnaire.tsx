import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useSocket } from '../hooks/useSocket';
import type { MovieResult } from './Results';

const GENRES = ['אקשן', 'קומדיה', 'דרמה', 'אימה', 'מדע בדיוני', 'רומנטיקה', 'תיעודי'];

interface LocationState {
  roomCode: string;
  nickname: string;
}

interface AllAnsweredPayload {
  results: MovieResult[];
}

export default function Questionnaire() {
  const location = useLocation();
  const navigate = useNavigate();
  const { emit, on } = useSocket();

  const { roomCode, nickname } = (location.state as LocationState | null) ?? {
    roomCode: '',
    nickname: 'אורח',
  };

  const [step, setStep] = useState(0);
  const [mood, setMood] = useState('');
  const [genres, setGenres] = useState<string[]>([]);
  const [length, setLength] = useState<'short' | 'medium' | 'long'>('medium');
  const [energyLevel, setEnergyLevel] = useState<'low' | 'medium' | 'high'>('medium');
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const offAll = on<AllAnsweredPayload>('all_answered', ({ results }) => {
      void navigate('/results', { state: { results } });
    });
    return offAll;
  }, [on, navigate]);

  const toggleGenre = (g: string) => {
    setGenres((prev) =>
      prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g],
    );
  };

  const handleSubmit = () => {
    emit('answers_submitted', {
      roomCode,
      nickname,
      answers: { mood, genres, length, energyLevel, knownFilms: [] },
    });
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="center-page">
        <h2>✅ תשובות נשלחו!</h2>
        <p>ממתין לשאר המשתתפים...</p>
      </div>
    );
  }

  return (
    <div className="questionnaire">
      <h1>🎬 Movihoot</h1>

      {step === 0 && (
        <div className="question">
          <h2>מה המצב רוח שלך הערב?</h2>
          {['שמח 😄', 'עייף 😴', 'הרפתקני 🌟', 'רומנטי 💕', 'מתוח 😬'].map((m) => (
            <button
              key={m}
              className={mood === m ? 'selected' : ''}
              onClick={() => setMood(m)}
            >
              {m}
            </button>
          ))}
          <button onClick={() => setStep(1)} disabled={!mood}>הבא →</button>
        </div>
      )}

      {step === 1 && (
        <div className="question">
          <h2>איזה ז׳אנר תרצה לראות?</h2>
          <div className="genre-grid">
            {GENRES.map((g) => (
              <button
                key={g}
                className={genres.includes(g) ? 'selected' : ''}
                onClick={() => toggleGenre(g)}
              >
                {g}
              </button>
            ))}
          </div>
          <button onClick={() => setStep(2)} disabled={genres.length === 0}>הבא →</button>
        </div>
      )}

      {step === 2 && (
        <div className="question">
          <h2>כמה זמן יש לך?</h2>
          {(['short', 'medium', 'long'] as const).map((l) => (
            <button
              key={l}
              className={length === l ? 'selected' : ''}
              onClick={() => setLength(l)}
            >
              {l === 'short' ? 'קצר (עד 90 דק׳)' : l === 'medium' ? 'בינוני (90-120 דק׳)' : 'ארוך (מעל 2 שעות)'}
            </button>
          ))}
          <button onClick={() => setStep(3)}>הבא →</button>
        </div>
      )}

      {step === 3 && (
        <div className="question">
          <h2>מה רמת האנרגיה שלך?</h2>
          {(['low', 'medium', 'high'] as const).map((e) => (
            <button
              key={e}
              className={energyLevel === e ? 'selected' : ''}
              onClick={() => setEnergyLevel(e)}
            >
              {e === 'low' ? 'נמוכה 🛋️' : e === 'medium' ? 'בינונית ☕' : 'גבוהה ⚡'}
            </button>
          ))}
          <button onClick={handleSubmit}>שלח תשובות ✅</button>
        </div>
      )}

      <div className="progress">שלב {step + 1} מתוך 4</div>
    </div>
  );
}
