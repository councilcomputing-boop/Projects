import { useEffect, useState } from 'react';
import { auth } from '../lib/firebase';
import type firebase from 'firebase/compat/app';

function authFriendlyError(code: string): string {
  switch (code) {
    case 'auth/invalid-email':return 'That email address doesn\'t look right.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'Email or password is incorrect.';
    case 'auth/email-already-in-use':return 'An account already exists with that email.';
    case 'auth/weak-password':return 'Password should be at least 6 characters.';
    default:return 'Something went wrong. Try again.';
  }
}

export function useAuth() {
  const [user, setUser] = useState<firebase.User | null>(() => auth.currentUser);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged((u) => {
      setUser(u);
      setLoading(false);
    });
    return unsub;
  }, []);

  async function signIn(email: string, password: string) {
    try {
      await auth.signInWithEmailAndPassword(email, password);
      return { ok: true as const };
    } catch (e: any) {
      return { ok: false as const, message: authFriendlyError(e?.code) };
    }
  }

  async function signUp(email: string, password: string) {
    try {
      await auth.createUserWithEmailAndPassword(email, password);
      return { ok: true as const };
    } catch (e: any) {
      return { ok: false as const, message: authFriendlyError(e?.code) };
    }
  }

  async function signOut() {
    await auth.signOut();
  }

  async function resetPassword(email: string) {
    try {
      await auth.sendPasswordResetEmail(email);
      return { ok: true as const };
    } catch (e: any) {
      return { ok: false as const, message: authFriendlyError(e?.code) };
    }
  }

  return { user, loading, signIn, signUp, signOut, resetPassword };
}
