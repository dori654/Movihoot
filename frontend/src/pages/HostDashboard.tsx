import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useSocket } from '../hooks/useSocket';
import { createSession, startSession } from '../services/api';
import QRCodeDisplay from '../components/QRCode';
import ParticipantList from '../components/ParticipantList';
import './HostDashboard.css';

interface UserJoinedPayload { nickname: string; count: number }
interface UserLeftPayload   { nickname: string }

/* ---------- SVG icons ---------- */
function FilmIcon() {
  return (
    <svg className="film-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"/>
      <line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/>
      <line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/>
      <line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="17" x2="22" y2="17"/>
      <line x1="17" y1="7" x2="22" y2="7"/>
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <polygon points="5 3 19 12 5 21 5 3"/>
    </svg>
  );
}

function LogOutIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <polyline points="16 17 21 12 16 7"/>
      <line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  );
}

export default function HostDashboard() {
  const { user, loading, signIn, logOut } = useAuth();
  const { emit, on } = useSocket();
  const navigate = useNavigate();

  const [roomCode, setRoomCode]         = useState<string | null>(null);
  const [participants, setParticipants] = useState<string[]>([]);
  const [creating, setCreating]         = useState(false);

  useEffect(() => {
    if (!roomCode) return;

    const offJoined  = on<UserJoinedPayload>('user_joined', ({ nickname }) => {
      setParticipants((prev) => prev.includes(nickname) ? prev : [...prev, nickname]);
    });
    const offLeft    = on<UserLeftPayload>('user_left', ({ nickname }) => {
      setParticipants((prev) => prev.filter((n) => n !== nickname));
    });
    const offStarted = on('session_started', () => { void navigate('/q'); });

    return () => { offJoined(); offLeft(); offStarted(); };
  }, [roomCode, on, navigate]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const { roomCode: code } = await createSession();
      setRoomCode(code);
    } finally {
      setCreating(false);
    }
  };

  const handleStart = async () => {
    if (!roomCode) return;
    await startSession(roomCode);
    emit('start_session', { roomCode });
  };

  /* ---- Loading ---- */
  if (loading) {
    return (
      <div className="page-center">
        <div className="spinner spinner--lg" />
      </div>
    );
  }

  /* ---- Sign-in screen ---- */
  if (!user) {
    return (
      <div className="page-center">
        <div className="card signin-card">
          <FilmIcon />
          <h1 className="logo">MOVIHOOT</h1>
          <div className="neon-divider" />
          <p className="signin-tagline">
            בחרו סרטים ביחד — ענו על שאלות, Claude ממליץ על 5 סרטים מושלמים לקבוצה
          </p>
          <button className="btn-google" onClick={() => void signIn()} aria-label="התחבר עם Google">
            <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            המשך עם Google
          </button>
        </div>
      </div>
    );
  }

  /* ---- Create session screen ---- */
  if (!roomCode) {
    return (
      <div className="page">
        <header className="host-header">
          <h1 className="logo">MOVIHOOT</h1>
          <div className="host-user-pill">
            <div className="host-user-avatar" aria-hidden="true">
              {user.displayName?.charAt(0).toUpperCase() ?? 'H'}
            </div>
            <span className="host-username">{user.displayName}</span>
            <button className="btn-ghost btn-ghost--sm" onClick={() => void logOut()} aria-label="יציאה">
              <LogOutIcon />
            </button>
          </div>
        </header>

        <div className="card create-session-card animate-fade-in-up">
          <FilmIcon />
          <h2>צור סשן חדש</h2>
          <p className="create-session-desc">
            משתתפים יסרקו קוד QR או יזינו קוד חדר כדי להצטרף
          </p>
          <button className="btn-gold" onClick={() => void handleCreate()} disabled={creating}>
            {creating
              ? <><div className="spinner" />יוצר חדר...</>
              : <><PlayIcon />צור חדר</>}
          </button>
        </div>
      </div>
    );
  }

  /* ---- Active session screen ---- */
  return (
    <div className="page">
      <header className="host-header">
        <h1 className="logo">MOVIHOOT</h1>
        <button className="btn-ghost" onClick={() => void logOut()} aria-label="יציאה">
          <LogOutIcon />
          יציאה
        </button>
      </header>

      <div className="host-main">
        <div className="card card-glow room-code-display">
          <p className="room-code-label">קוד חדר</p>
          <span className="room-code-value">{roomCode}</span>
          <div className="qr-frame">
            <QRCodeDisplay roomCode={roomCode} />
          </div>
          <p className="qr-hint">סרוק כדי להצטרף</p>
        </div>

        <div className="session-right-col">
          <div className="card">
            <ParticipantList participants={participants} />
          </div>
          <button
            className="btn-gold"
            onClick={() => void handleStart()}
            disabled={participants.length === 0}
          >
            <PlayIcon />
            התחל סשן ({participants.length} משתתפים)
          </button>
        </div>
      </div>
    </div>
  );
}
