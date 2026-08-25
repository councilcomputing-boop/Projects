import { useEffect, useState } from 'react';

const STORAGE_KEY = 'cardCountingTrainerState';

interface ManualState {
  runningCount: number;
  cardsSeen: number;
  decksLeft: number;
}

const DEFAULT_STATE: ManualState = { runningCount: 0, cardsSeen: 0, decksLeft: 6 };

function loadState(): ManualState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_STATE };
    const parsed = JSON.parse(raw);
    return {
      runningCount: Number(parsed.runningCount) || 0,
      cardsSeen: Number(parsed.cardsSeen) || 0,
      decksLeft: Number(parsed.decksLeft) || DEFAULT_STATE.decksLeft
    };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

// Mirrors the live app's Manual mode exactly: decksLeft is picked by the player (there's
// no simulated shoe here, just a physical deck they're eyeballing), and only
// runningCount/cardsSeen reset when they hit Reset — decksLeft is left alone.
export function useManualCount() {
  const [state, setState] = useState<ManualState>(loadState);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const tap = (value: number) => {
    setState((prev) => ({
      ...prev,
      runningCount: prev.runningCount + value,
      cardsSeen: prev.cardsSeen + 1
    }));
  };

  const setDecksLeft = (decksLeft: number) => {
    setState((prev) => ({ ...prev, decksLeft }));
  };

  const reset = () => {
    setState((prev) => ({ ...prev, runningCount: 0, cardsSeen: 0 }));
  };

  return { ...state, tap, setDecksLeft, reset };
}
