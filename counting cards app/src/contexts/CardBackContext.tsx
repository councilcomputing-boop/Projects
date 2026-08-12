import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { CardBackItem, cardBacks, getCardBack } from '../data/store';

interface CardBackContextValue {
  equipped: CardBackItem;
  equippedId: string;
  equip: (id: string) => void;
  ownedIds: string[];
  isOwned: (id: string) => boolean;
  unlock: (id: string) => void;
}

const CardBackContext = createContext<CardBackContextValue | null>(null);

export function CardBackProvider({ children }: {children: React.ReactNode;}) {
  const [equippedId, setEquippedId] = useState('classic');
  const [ownedIds, setOwnedIds] = useState<string[]>(() =>
  cardBacks.filter((back) => back.owned).map((back) => back.id)
  );

  const unlock = useCallback((id: string) => {
    setOwnedIds((prev) => prev.includes(id) ? prev : [...prev, id]);
  }, []);

  const value = useMemo(
    () => ({
      equippedId,
      equipped: getCardBack(equippedId),
      equip: setEquippedId,
      ownedIds,
      isOwned: (id: string) => ownedIds.includes(id),
      unlock
    }),
    [equippedId, ownedIds, unlock]
  );

  return <CardBackContext.Provider value={value}>{children}</CardBackContext.Provider>;
}

export function useCardBack(): CardBackContextValue {
  const context = useContext(CardBackContext);
  if (!context) {
    throw new Error('useCardBack must be used inside CardBackProvider');
  }
  return context;
}