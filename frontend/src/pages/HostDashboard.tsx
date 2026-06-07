import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useSocket } from '../hooks/useSocket';
import { createSession, startSession } from '../services/api';
import QRCodeDisplay from '../components/QRCode';
import ParticipantList from '../components/ParticipantList';

interface UserJoinedPayload {
  nickname: string;
  count: number;
}

interface UserLeftPayload {
  nickname: string;
}

export default function HostDashboard() {
  const { user, loading, signIn, logOut } = useAuth();
  const { emit, on } = useSocket();
  const navigate = useNavigate();

  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [participants, setParticipants] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);

  // Listen for participant updates once we have a room
  useEffect(() => {
    if (!roomCode) return;

    const offJoined = on<UserJoinedPayload>('user_joined', ({ nickname }) => {
      setParticipants((prev) =>
        prev.includes(nickname) ? prev : [...prev, nickname],
      );
    });

    const offLeft = on<UserLeftPayload>('user_left', ({ nickname }) => {
      setParticipants((prev) => prev.filter((n) => n !== nickname));
    });

    const offStarted = on('session_started', () => {
      void navigate('/q');
    });

    return () => {
      offJoined();
      offLeft();
      offStarted();
    };
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

  if (loading) return <p>טוען...</p>;

  if (!user) {
    return (
      <div className="center-page">
        <h1>🎬 Movihoot</h1>
        <p>התחבר כדי ליצור סשן</p>
        <button onClick={() => void signIn()}>התחבר עם Google</button>
      </div>
    );
  }

  return (
    <div className="host-dashboard">
      <header>
        <h1>🎬 Movihoot</h1>
        <button onClick={() => void logOut()}>יציאה</button>
      </header>

      {!roomCode ? (
        <div className="create-session">
          <p>שלום, {user.displayName}!</p>
          <button onClick={() => void handleCreate()} disabled={creating}>
            {creating ? 'יוצר...' : 'צור סשן חדש'}
          </button>
        </div>
      ) : (
        <div className="session-active">
          <div className="room-code">
            <span>קוד חדר: </span>
            <strong>{roomCode}</strong>
          </div>

          <QRCodeDisplay roomCode={roomCode} />

          <ParticipantList participants={participants} />

          <button
            onClick={() => void handleStart()}
            disabled={participants.length === 0}
          >
            התחל ({participants.length} משתתפים)
          </button>
        </div>
      )}
    </div>
  );
}
