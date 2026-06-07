import { QRCodeSVG } from 'qrcode.react';

interface Props {
  roomCode: string;
}

export default function QRCodeDisplay({ roomCode }: Props) {
  const joinUrl = `${window.location.origin}/join?room=${roomCode}`;
  return (
    <div className="qr-wrapper">
      <QRCodeSVG value={joinUrl} size={200} />
      <p className="qr-hint">סרוק או עבור ל: /join?room={roomCode}</p>
    </div>
  );
}
