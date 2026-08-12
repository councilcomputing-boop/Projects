import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { auth, fdb } from '../lib/firebase';

const DEALER_KEY = 'cardCountingTrainerDealerState';

interface DropsState {
  drops: number;
  dropsHigh: number;
  disclaimerAckAt: number | null;
}

function readDropsFromStorage(): DropsState {
  try {
    const raw = localStorage.getItem(DEALER_KEY);
    if (!raw) return { drops: 1000, dropsHigh: 1000, disclaimerAckAt: null };
    const parsed = JSON.parse(raw);
    return {
      drops: typeof parsed.drops === 'number' ? parsed.drops : 1000,
      dropsHigh: typeof parsed.dropsHigh === 'number' ? parsed.dropsHigh : 1000,
      disclaimerAckAt: parsed.disclaimerAckAt ?? null
    };
  } catch {
    return { drops: 1000, dropsHigh: 1000, disclaimerAckAt: null };
  }
}

/** Merge-writes just the drops fields into whatever's already saved under this key, so
    this never clobbers the game-engine fields (shoe, hand, stats, ...) the blackjack
    hook persists to the same localStorage key. */
function writeDropsToStorage(patch: DropsState) {
  try {
    const raw = localStorage.getItem(DEALER_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    localStorage.setItem(DEALER_KEY, JSON.stringify({ ...parsed, ...patch }));
  } catch {
    localStorage.setItem(DEALER_KEY, JSON.stringify(patch));
  }
}

interface DropsContextValue extends DropsState {
  signedIn: boolean;
  addDrops: (amount: number) => void;
  spendDrops: (amount: number) => boolean;
  ackDisclaimer: () => void;
}

const DropsContext = createContext<DropsContextValue | null>(null);

/**
 * The one real balance shared everywhere it's shown or spent (header badge, the
 * blackjack table, Card Backs, the Store) — a single source of truth instead of each
 * screen keeping its own copy. Owns the Firestore sync (drops/dropsHigh/disclaimerAckAt
 * only, matching firestore.rules exactly): one-shot bootstrap read + a real-time
 * listener for the rest of the session, debounced (~3.5s) pushes plus an immediate
 * flush on tab-hide. A snapshot identical to current local state is a no-op, which
 * doubles as the "ignore echoes of our own push" guard.
 */
export function DropsProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DropsState>(readDropsFromStorage);
  const [uid, setUid] = useState<string | null>(() => auth.currentUser?.uid ?? null);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged((u) => setUid(u?.uid ?? null));
    return unsub;
  }, []);

  useEffect(() => {
    writeDropsToStorage(state);
  }, [state]);

  useEffect(() => {
    if (!uid) return;
    const ref = fdb.collection('users').doc(uid);
    let cancelled = false;

    ref.get().then((snap) => {
      if (cancelled) return;
      if (snap.exists) {
        const data = snap.data()!;
        setState((prev) => ({
          drops: typeof data.drops === 'number' ? data.drops : prev.drops,
          dropsHigh: Math.max(prev.dropsHigh, prev.drops, data.dropsHigh || 0),
          disclaimerAckAt: data.disclaimerAckAt ?? prev.disclaimerAckAt
        }));
      } else {
        setState((prev) => {
          ref.set({ drops: prev.drops, dropsHigh: prev.dropsHigh, disclaimerAckAt: prev.disclaimerAckAt }, { merge: true }).catch(() => {});
          return prev;
        });
      }
    }).catch(() => {});

    const unsub = ref.onSnapshot((snap) => {
      if (!snap.exists) return;
      const data = snap.data()!;
      setState((prev) => {
        if (data.drops === prev.drops && data.dropsHigh === prev.dropsHigh && data.disclaimerAckAt === prev.disclaimerAckAt) return prev;
        return {
          drops: typeof data.drops === 'number' ? data.drops : prev.drops,
          dropsHigh: Math.max(prev.dropsHigh, prev.drops, data.dropsHigh || 0),
          disclaimerAckAt: data.disclaimerAckAt ?? prev.disclaimerAckAt
        };
      });
    }, () => {});

    return () => { cancelled = true; unsub(); };
  }, [uid]);

  const pushTimer = useRef<number | null>(null);
  useEffect(() => {
    if (!uid) return;
    if (pushTimer.current) window.clearTimeout(pushTimer.current);
    pushTimer.current = window.setTimeout(() => {
      fdb.collection('users').doc(uid).set(
        { drops: state.drops, dropsHigh: state.dropsHigh, disclaimerAckAt: state.disclaimerAckAt },
        { merge: true }
      ).catch(() => {});
    }, 3500);
    return () => { if (pushTimer.current) window.clearTimeout(pushTimer.current); };
  }, [uid, state.drops, state.dropsHigh, state.disclaimerAckAt]);

  useEffect(() => {
    function flushOnHide() {
      if (document.visibilityState !== 'hidden' || !uid) return;
      fdb.collection('users').doc(uid).set(
        { drops: state.drops, dropsHigh: state.dropsHigh, disclaimerAckAt: state.disclaimerAckAt },
        { merge: true }
      ).catch(() => {});
    }
    document.addEventListener('visibilitychange', flushOnHide);
    return () => document.removeEventListener('visibilitychange', flushOnHide);
  }, [uid, state.drops, state.dropsHigh, state.disclaimerAckAt]);

  function addDrops(amount: number) {
    if (amount === 0) return;
    setState((prev) => ({ ...prev, drops: prev.drops + amount, dropsHigh: Math.max(prev.dropsHigh, prev.drops + amount) }));
  }
  function spendDrops(amount: number): boolean {
    if (state.drops < amount) return false;
    setState((prev) => ({ ...prev, drops: prev.drops - amount }));
    return true;
  }
  function ackDisclaimer() {
    setState((prev) => ({ ...prev, disclaimerAckAt: Date.now() }));
  }

  return (
    <DropsContext.Provider value={{ ...state, signedIn: !!uid, addDrops, spendDrops, ackDisclaimer }}>
      {children}
    </DropsContext.Provider>);

}

export function useDrops(): DropsContextValue {
  const ctx = useContext(DropsContext);
  if (!ctx) throw new Error('useDrops must be used inside DropsProvider');
  return ctx;
}
