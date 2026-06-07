import { useState, useEffect } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  signOut,
  type User,
} from 'firebase/auth';
import { auth } from '../firebase/firebase.config';

const provider = new GoogleAuthProvider();

export function useAuth() {
  const [user, setUser]       = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    // Handle redirect result on page load (signInWithRedirect flow)
    void getRedirectResult(auth).catch(() => {
      // No redirect result — normal page load, ignore
    });

    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signIn = async () => {
    setError(null);
    try {
      // Try popup first; fall back to redirect if popup is blocked
      await signInWithPopup(auth, provider);
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? '';
      if (code === 'auth/popup-blocked' || code === 'auth/popup-closed-by-user') {
        // Redirect flow — page will reload, result handled in useEffect
        await signInWithRedirect(auth, provider);
      } else {
        setError(code || 'התחברות נכשלה');
        throw err;
      }
    }
  };

  const logOut = () => signOut(auth);

  return { user, loading, error, signIn, logOut };
}
