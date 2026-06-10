import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { io, type Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_URL as string ?? 'http://localhost:3000';

const ACK_TIMEOUT_MS = 8000;

export type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';

// Server ack envelope for WS events (see backend sessions/ws.utils.ts)
export type WsAck<T = object> =
  | ({ ok: true } & T)
  | { ok: false; code: string; message: string };

interface SocketContextValue {
  socket: Socket | null;
  status: ConnectionStatus;
}

const SocketContext = createContext<SocketContextValue>({ socket: null, status: 'connecting' });

// One Socket.io connection for the whole app lifetime — page navigation must
// NOT disconnect it, otherwise the server treats every route change as the
// participant leaving the session (see SessionsGateway.handleDisconnect)
export function SocketProvider({ children }: { children: ReactNode }) {
  const socketRef = useRef<Socket | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('connecting');

  useEffect(() => {
    const instance = io(SOCKET_URL, { transports: ['websocket'] });
    instance.on('connect', () => setStatus('connected'));
    instance.on('disconnect', () => setStatus('reconnecting'));
    instance.io.on('reconnect_attempt', () => setStatus('reconnecting'));
    instance.io.on('reconnect_failed', () => setStatus('disconnected'));
    socketRef.current = instance;
    setSocket(instance);
    return () => { instance.disconnect(); };
  }, []);

  return (
    <SocketContext.Provider value={{ socket, status }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const { socket, status } = useContext(SocketContext);

  const emit = useCallback(<T,>(event: string, data: T) => {
    socket?.emit(event, data);
  }, [socket]);

  // Emits and resolves with the server's ack; rejects on timeout/no connection
  const emitWithAck = useCallback(async <R, T = unknown>(event: string, data: T): Promise<R> => {
    if (!socket) throw new Error('socket not ready');
    return socket.timeout(ACK_TIMEOUT_MS).emitWithAck(event, data) as Promise<R>;
  }, [socket]);

  const on = useCallback(<T,>(event: string, handler: (data: T) => void) => {
    socket?.on(event, handler);
    return () => { socket?.off(event, handler); };
  }, [socket]);

  return { emit, emitWithAck, on, socket, status };
}
