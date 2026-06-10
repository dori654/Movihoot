import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSocket, type WsAck } from '../hooks/useSocket';
import ParticipantList from '../components/ParticipantList';
import './Lobby.css';

interface UserJoinedPayload { nickname: string; count: number }
interface UserLeftPayload   { nickname: string }
type JoinAck = WsAck<{ participants: string[] }>;

export const PARTICIPANT_STORAGE_KEY = 'movihoot_participant';

function UserIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="5" y1="12" x2="19" y2="12"/>
      <polyline points="12 5 19 12 12 19"/>
    </svg>
  );
}

export default function Lobby() {
  const { emitWithAck, on, status } = useSocket();
  const navigate       = useNavigate();
  const [searchParams] = useSearchParams();

  const [roomCode, setRoomCode]         = useState(() => searchParams.get('room') ?? '');
  const [nickname, setNickname]         = useState('');
  const [joined, setJoined]             = useState(false);
  const [joining, setJoining]           = useState(false);
  const [joinError, setJoinError]       = useState<string | null>(null);
  const [hostAway, setHostAway]         = useState(false);
  const [participants, setParticipants] = useState<string[]>([]);

  useEffect(() => {
    if (!joined) return;

    const offJoined  = on<UserJoinedPayload>('user_joined', ({ nickname: n }) => {
      setParticipants((prev) => (prev.includes(n) ? prev : [...prev, n]));
    });
    const offLeft    = on<UserLeftPayload>('user_left', ({ nickname: n }) => {
      setParticipants((prev) => prev.filter((p) => p !== n));
    });
    const offStarted = on('session_started', () => {
      void navigate('/q', { state: { roomCode, nickname } });
    });
    const offHostLeft = on('host_left', () => setHostAway(true));
    const offHostBack = on('host_back', () => setHostAway(false));

    return () => { offJoined(); offLeft(); offStarted(); offHostLeft(); offHostBack(); };
  }, [joined, roomCode, nickname, on, navigate]);

  // Re-register with the server after a reconnect — the server forgets the
  // socket-to-nickname mapping when the old socket drops
  useEffect(() => {
    if (!joined || status !== 'connected') return;
    emitWithAck<JoinAck>('join_session', { roomCode, nickname })
      .then((ack) => { if (ack.ok) setParticipants(ack.participants); })
      .catch(() => { /* banner already shows the connection problem */ });
  }, [joined, status, roomCode, nickname, emitWithAck]);

  const handleJoin = async () => {
    const code = roomCode.trim().toUpperCase();
    if (code.length !== 6 || !nickname.trim()) return;

    setJoining(true);
    setJoinError(null);
    try {
      const ack = await emitWithAck<JoinAck>('join_session', { roomCode: code, nickname });
      if (!ack.ok) {
        setJoinError(ack.message);
        return;
      }
      sessionStorage.setItem(PARTICIPANT_STORAGE_KEY, JSON.stringify({ roomCode: code, nickname }));
      setParticipants(ack.participants);
      setJoined(true);
    } catch {
      setJoinError('החיבור לשרת נכשל — בדקו שהשרת פועל ונסו שוב');
    } finally {
      setJoining(false);
    }
  };

  /* ---- Join form ---- */
  if (!joined) {
    return (
      <div className="page-center">
        <div className="card lobby-card animate-fade-in-up">
          <div className="lobby-header">
            <h1 className="logo">MOVIHOOT</h1>
            <p className="lobby-subtitle">הצטרף לסשן</p>
          </div>

          <div className="lobby-form">
            <div className="input-group">
              <label className="input-label" htmlFor="room-code">קוד חדר</label>
              <input
                id="room-code"
                className="input-field input-room-code"
                placeholder="XXXXXX"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                maxLength={6}
                autoComplete="off"
                spellCheck={false}
              />
            </div>

            <div className="input-group">
              <label className="input-label" htmlFor="nickname">
                <span className="label-with-icon">
                  <UserIcon /> כינוי
                </span>
              </label>
              <input
                id="nickname"
                className="input-field"
                placeholder="השם שלך בסשן"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                maxLength={20}
                onKeyDown={(e) => { if (e.key === 'Enter') void handleJoin(); }}
              />
            </div>

            {joinError && (
              <p className="form-error" role="alert">{joinError}</p>
            )}

            <button
              className="btn-gold btn-gold--mt"
              onClick={() => void handleJoin()}
              disabled={roomCode.length !== 6 || nickname.length === 0 || joining}
            >
              {joining
                ? <><div className="spinner" />מצטרף...</>
                : <><ArrowIcon />הצטרף</>}
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ---- Waiting room ---- */
  return (
    <div className="page-center">
      <div className="waiting-room animate-fade-in-up">
        <div className="waiting-room-header">
          <h1 className="logo">MOVIHOOT</h1>
          <p className="waiting-room-code">
            חדר: <strong className="room-code-highlight">{roomCode}</strong>
          </p>
        </div>

        <div className="card card-glow">
          <ParticipantList participants={participants} />
        </div>

        {hostAway && (
          <p className="form-error" role="alert">המארח התנתק — ממתינים שיחזור...</p>
        )}

        <div className="waiting-status">
          <div className="spinner" />
          ממתינים שהמארח יתחיל את הסשן...
        </div>
      </div>
    </div>
  );
}
