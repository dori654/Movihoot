interface Props { participants: string[] }

export default function ParticipantList({ participants }: Props) {
  return (
    <div className="participant-list">
      <div className="participant-list-header">
        <span className="participant-list-title">משתתפים</span>
        <span className="participant-count-badge">{participants.length}</span>
      </div>

      {participants.length === 0 ? (
        <p className="participant-empty">ממתין למשתתפים...</p>
      ) : (
        <ul className="participant-items" role="list">
          {participants.map((name, i) => (
            <li key={name} className="participant-item" style={{ animationDelay: `${i * 60}ms` }}>
              <span className="participant-dot" aria-hidden="true" />
              {name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
