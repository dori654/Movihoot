import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useSocket } from '../hooks/useSocket';
import ParticipantList from '../components/ParticipantList';

interface UserJoinedPayload {
  nickname: string;
  count: number;
}

interface UserLeftPayload {
  nickname: string;
}

export default function Lobby() {
  const { emit, on } = useSocket();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [roomCode, setRoomCode] = useState(() => searchParams.get('room') ?? '');
  const [nickname, setNickname] = useState('');
  const [joined, setJoined] = useState(false);
  const [participants, setParticipants] = useState<string[]>([]);

  useEffect(() => {
    if (!joined) return;

    const offJoined = on<UserJoinedPayload>('user_joined', ({ nickname: n }) => {
      setParticipants((prev) => (prev.includes(n) ? prev : [...prev, n]));
    });

    const offLeft = on<UserLeftPayload>('user_left', ({ nickname: n }) => {
      setParticipants((prev) => prev.filter((p) => p !== n));
    });

    const offStarted = on('session_started', () => {
      void navigate('/q', { state: { roomCode, nickname } });
    });

    return () => {
      offJoined();
      offLeft();
      offStarted();
    };
  }, [joined, roomCode, nickname, on, navigate]);

  const handleJoin = () => {
    if (!roomCode.trim() || !nickname.trim()) return;
    emit('join_session', { roomCode: roomCode.toUpperCase(), nickname });
    setParticipants((prev) => [...prev, nickname]);
    setJoined(true);
  };

  if (!joined) {
    return (
      <div className="center-page">
        <h1>🎬 Movihoot</h1>
        <h2>הצטרף לסשן</h2>
        <input
          placeholder="קוד חדר (6 ספרות)"
          value={roomCode}
          onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
          maxLength={6}
        />
        <input
          placeholder="כינוי"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          maxLength={20}
        />
        <button
          onClick={handleJoin}
          disabled={roomCode.length !== 6 || nickname.length === 0}
        >
          הצטרף
        </button>
      </div>
    );
  }

  return (
    <div className="lobby">
      <h1>🎬 Movihoot</h1>
      <h2>ממתין שהמארח יתחיל...</h2>
      <p>חדר: <strong>{roomCode}</strong></p>
      <ParticipantList participants={participants} />
    </div>
  );
}
