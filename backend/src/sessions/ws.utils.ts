import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';

export type WsErrorCode =
  | 'INVALID_PAYLOAD'
  | 'ROOM_NOT_FOUND'
  | 'SESSION_NOT_JOINABLE'
  | 'SESSION_NOT_ACTIVE'
  | 'SESSION_EXPIRED'
  | 'NICKNAME_TAKEN'
  | 'NOT_PARTICIPANT'
  | 'NOT_HOST'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR';

export interface WsError {
  ok: false;
  code: WsErrorCode;
  message: string;
}

export type WsAck<T = object> = ({ ok: true } & T) | WsError;

// User-facing messages — the frontend renders these directly
const WS_ERROR_MESSAGES: Record<WsErrorCode, string> = {
  INVALID_PAYLOAD: 'הנתונים שנשלחו אינם תקינים',
  ROOM_NOT_FOUND: 'החדר לא נמצא — בדקו את הקוד ונסו שוב',
  SESSION_NOT_JOINABLE: 'הסשן כבר התחיל — לא ניתן להצטרף',
  SESSION_NOT_ACTIVE: 'הסשן אינו פעיל כרגע',
  SESSION_EXPIRED: 'הסשן פג תוקף — צרו חדר חדש',
  NICKNAME_TAKEN: 'הכינוי כבר תפוס בחדר הזה — בחרו כינוי אחר',
  NOT_PARTICIPANT: 'אינך רשום בסשן הזה',
  NOT_HOST: 'רק מארח הסשן יכול לבצע פעולה זו',
  RATE_LIMITED: 'יותר מדי פעולות — נסו שוב בעוד רגע',
  INTERNAL_ERROR: 'משהו השתבש בשרת — נסו שוב',
};

export function wsError(code: WsErrorCode): WsError {
  return { ok: false, code, message: WS_ERROR_MESSAGES[code] };
}

// Validates a raw WS payload against a class-validator DTO.
// Returns the typed instance, or null if validation failed.
export function validatePayload<T extends object>(
  dtoClass: new () => T,
  payload: unknown,
): T | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const instance = plainToInstance(dtoClass, payload);
  const errors = validateSync(instance, {
    whitelist: true,
    forbidUnknownValues: false,
  });
  return errors.length === 0 ? instance : null;
}

// Sliding-window rate limiter keyed by socket id
export class SocketRateLimiter {
  private readonly events = new Map<string, number[]>();

  constructor(
    private readonly maxEvents = 10,
    private readonly windowMs = 5_000,
  ) {}

  allow(socketId: string): boolean {
    const now = Date.now();
    const recent = (this.events.get(socketId) ?? []).filter(
      (t) => now - t < this.windowMs,
    );
    if (recent.length >= this.maxEvents) {
      this.events.set(socketId, recent);
      return false;
    }
    recent.push(now);
    this.events.set(socketId, recent);
    return true;
  }

  forget(socketId: string): void {
    this.events.delete(socketId);
  }
}
