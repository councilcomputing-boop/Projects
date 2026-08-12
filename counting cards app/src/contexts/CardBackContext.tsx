import { createContext, useContext, type ReactNode } from 'react';
import { useCardBackStore } from '../hooks/useCardBackStore';

type CardBackContextValue = ReturnType<typeof useCardBackStore>;

const CardBackContext = createContext<CardBackContextValue | null>(null);

// A single shared instance of useCardBackStore, so every screen (Card Backs, Store, and
// later the blackjack table's face-down card rendering) reads/writes the same collection
// state instead of each maintaining its own copy.
export function CardBackProvider({ children }: { children: ReactNode }) {
  const value = useCardBackStore();
  return <CardBackContext.Provider value={value}>{children}</CardBackContext.Provider>;
}

export function useCardBack(): CardBackContextValue {
  const context = useContext(CardBackContext);
  if (!context) {
    throw new Error('useCardBack must be used inside CardBackProvider');
  }
  return context;
}
