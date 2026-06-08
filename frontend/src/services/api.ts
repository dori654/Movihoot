import axios from 'axios';
import { auth } from '../firebase/firebase.config';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL as string ?? 'http://localhost:3000',
});

// Attach Firebase ID token to every request
api.interceptors.request.use(async (config) => {
  const user = auth.currentUser;
  if (user) {
    const token = await user.getIdToken();
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export interface CreateSessionResponse {
  roomCode: string;
}

export interface SessionInfo {
  roomCode: string;
  status: 'lobby' | 'active' | 'done';
  participants: string[];
}

export const createSession = () =>
  api.post<CreateSessionResponse>('/sessions').then((r) => r.data);

export const getSession = (roomCode: string) =>
  api.get<SessionInfo>(`/sessions/${roomCode}`).then((r) => r.data);

export const startSession = (roomCode: string) =>
  api.patch(`/sessions/${roomCode}/start`);

export default api;
