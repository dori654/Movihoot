import { useSocket } from '../hooks/useSocket';
import './ConnectionBanner.css';

export default function ConnectionBanner() {
  const { status } = useSocket();

  if (status === 'connected' || status === 'connecting') return null;

  return (
    <div className="connection-banner" role="status">
      <div className="spinner" />
      {status === 'reconnecting'
        ? 'החיבור לשרת נותק — מתחבר מחדש...'
        : 'החיבור לשרת אבד — רעננו את הדף'}
    </div>
  );
}
