import { QRCodeSVG } from 'qrcode.react';

interface Props { roomCode: string }

export default function QRCodeDisplay({ roomCode }: Props) {
  const joinUrl = `${window.location.origin}/join?room=${roomCode}`;
  return (
    <QRCodeSVG
      value={joinUrl}
      size={180}
      bgColor="#ffffff"
      fgColor="#0F0F23"
      level="M"
    />
  );
}
