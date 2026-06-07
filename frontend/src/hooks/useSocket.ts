import { useEffect, useRef, useCallback } from 'react';
import { io, type Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_URL as string ?? 'http://localhost:3000';

export function useSocket() {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const socket = io(SOCKET_URL, { transports: ['websocket'] });
    socketRef.current = socket;
    return () => { socket.disconnect(); };
  }, []);

  const emit = useCallback(<T>(event: string, data: T) => {
    socketRef.current?.emit(event, data);
  }, []);

  const on = useCallback(<T>(event: string, handler: (data: T) => void) => {
    socketRef.current?.on(event, handler);
    return () => { socketRef.current?.off(event, handler); };
  }, []);

  return { emit, on, socket: socketRef };
}
