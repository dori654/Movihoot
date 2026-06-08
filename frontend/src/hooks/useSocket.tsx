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

const SocketContext = createContext<Socket | null>(null);

// One Socket.io connection for the whole app lifetime — page navigation must
// NOT disconnect it, otherwise the server treats every route change as the
// participant leaving the session (see SessionsGateway.handleDisconnect)
export function SocketProvider({ children }: { children: ReactNode }) {
  const socketRef = useRef<Socket | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    const instance = io(SOCKET_URL, { transports: ['websocket'] });
    socketRef.current = instance;
    setSocket(instance);
    return () => { instance.disconnect(); };
  }, []);

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  const socket = useContext(SocketContext);

  const emit = useCallback(<T,>(event: string, data: T) => {
    socket?.emit(event, data);
  }, [socket]);

  const on = useCallback(<T,>(event: string, handler: (data: T) => void) => {
    socket?.on(event, handler);
    return () => { socket?.off(event, handler); };
  }, [socket]);

  return { emit, on, socket };
}
