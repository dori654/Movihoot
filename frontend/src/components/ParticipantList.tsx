interface Props {
  participants: string[];
}

export default function ParticipantList({ participants }: Props) {
  return (
    <div className="participant-list">
      <h3>משתתפים ({participants.length})</h3>
      <ul>
        {participants.map((name) => (
          <li key={name}>👤 {name}</li>
        ))}
      </ul>
    </div>
  );
}
