import { useEffect, useState } from 'react';
import { RARITY_META, findCardBack, type CardBackItem } from '../data/store';

const STORAGE_KEY = 'cardCountingStoreState';

interface DailyBonusState {
  streak: number;
  lastClaimDate: string | null;
}
interface AdWatchState {
  count: number;
  date: string | null;
}
interface SpinWheelState {
  lastSpinDate: string | null;
}
interface CardBacksState {
  owned: string[];
  equipped: string;
  fragments: Record<string, number>;
}
interface StoreState {
  dailyBonus: DailyBonusState;
  adWatch: AdWatchState;
  spinWheel: SpinWheelState;
  cardBacks: CardBacksState;
  autoEquipNewBacks: boolean;
  /** Normalized (uppercase) promo codes already redeemed on this device. */
  redeemedCodes: string[];
  /** Fragment counts as of the last time the Card Backs shop was visited, per back id --
      lets the shop animate only newly-earned shards flying in instead of replaying every
      already-seen one on every visit. */
  lastSeenFragments: Record<string, number>;
}

function defaultState(): StoreState {
  return {
    dailyBonus: { streak: 0, lastClaimDate: null },
    adWatch: { count: 0, date: null },
    spinWheel: { lastSpinDate: null },
    cardBacks: { owned: ['classic'], equipped: 'classic', fragments: {} },
    autoEquipNewBacks: false,
    redeemedCodes: [],
    lastSeenFragments: {}
  };
}

function loadState(): StoreState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    const base = defaultState();
    return {
      dailyBonus: { ...base.dailyBonus, ...parsed.dailyBonus },
      adWatch: { ...base.adWatch, ...parsed.adWatch },
      spinWheel: { ...base.spinWheel, ...parsed.spinWheel },
      cardBacks: { ...base.cardBacks, ...parsed.cardBacks },
      autoEquipNewBacks: Boolean(parsed.autoEquipNewBacks),
      redeemedCodes: Array.isArray(parsed.redeemedCodes) ? parsed.redeemedCodes : [],
      lastSeenFragments: parsed.lastSeenFragments && typeof parsed.lastSeenFragments === 'object' ? parsed.lastSeenFragments : {}
    };
  } catch {
    return defaultState();
  }
}

export function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

export interface AwardResult {
  unlocked: boolean;
  alreadyOwned?: boolean;
  back: CardBackItem;
  have: number;
  need: number;
}

// Mirrors the live app's storeState (localStorage: cardCountingStoreState) — everything
// here is per-device, never synced to Firestore, matching real behavior exactly.
export function useCardBackStore() {
  const [state, setState] = useState<StoreState>(loadState);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  /** Awards one fragment of `back`, unlocking it if that completes the set. */
  const awardFragment = (back: CardBackItem): AwardResult => {
    const need = RARITY_META[back.rarity].fragmentsNeeded;
    let result: AwardResult;
    setState((prev) => {
      if (prev.cardBacks.owned.includes(back.id)) {
        result = { unlocked: false, alreadyOwned: true, back, have: need, need };
        return prev;
      }
      const have = Math.min(need, (prev.cardBacks.fragments[back.id] || 0) + 1);
      if (have >= need) {
        const fragments = { ...prev.cardBacks.fragments };
        delete fragments[back.id];
        result = { unlocked: true, back, have, need };
        return {
          ...prev,
          cardBacks: {
            ...prev.cardBacks,
            fragments,
            owned: [...prev.cardBacks.owned, back.id],
            equipped: prev.autoEquipNewBacks ? back.id : prev.cardBacks.equipped
          }
        };
      }
      result = { unlocked: false, back, have, need };
      return { ...prev, cardBacks: { ...prev.cardBacks, fragments: { ...prev.cardBacks.fragments, [back.id]: have } } };
    });
    return result!;
  };

  /** Direct-buy: costs the full listed price and forfeits any partial fragment progress.
      If already owned, this just equips it — no cost. Caller is responsible for
      checking/deducting the drops balance before calling. */
  const buyOrEquipCardBack = (id: string) => {
    setState((prev) => {
      if (prev.cardBacks.owned.includes(id)) {
        return { ...prev, cardBacks: { ...prev.cardBacks, equipped: id } };
      }
      const fragments = { ...prev.cardBacks.fragments };
      delete fragments[id];
      return {
        ...prev,
        cardBacks: { ...prev.cardBacks, fragments, owned: [...prev.cardBacks.owned, id], equipped: id }
      };
    });
  };

  const equipCardBack = (id: string) => {
    setState((prev) => ({ ...prev, cardBacks: { ...prev.cardBacks, equipped: id } }));
  };

  const setAutoEquip = (value: boolean) => {
    setState((prev) => ({ ...prev, autoEquipNewBacks: value }));
  };

  const markAdWatched = () => {
    const today = todayStr();
    setState((prev) => {
      const count = prev.adWatch.date === today ? prev.adWatch.count + 1 : 1;
      return { ...prev, adWatch: { count, date: today } };
    });
  };

  const markSpinUsed = () => {
    setState((prev) => ({ ...prev, spinWheel: { lastSpinDate: todayStr() } }));
  };

  /** Records `have` as the seen fragment count for `backId` (only ever moves forward). */
  const markFragmentsSeen = (backId: string, have: number) => {
    setState((prev) => {
      if ((prev.lastSeenFragments[backId] || 0) >= have) return prev;
      return { ...prev, lastSeenFragments: { ...prev.lastSeenFragments, [backId]: have } };
    });
  };

  const hasRedeemed = (code: string) => state.redeemedCodes.includes(code.trim().toUpperCase());

  const markCodeRedeemed = (code: string) => {
    const normalized = code.trim().toUpperCase();
    setState((prev) => prev.redeemedCodes.includes(normalized) ? prev : { ...prev, redeemedCodes: [...prev.redeemedCodes, normalized] });
  };

  const claimDailyBonus = () => {
    const today = todayStr();
    setState((prev) => {
      if (prev.dailyBonus.lastClaimDate === today) return prev;
      let streak = 1;
      if (prev.dailyBonus.lastClaimDate) {
        const last = new Date(prev.dailyBonus.lastClaimDate);
        const now = new Date(today);
        const days = Math.round((now.getTime() - last.getTime()) / 86400000);
        streak = days > 1 ? 1 : prev.dailyBonus.streak + 1;
      }
      return { ...prev, dailyBonus: { streak, lastClaimDate: today } };
    });
  };

  const equippedBack = findCardBack(state.cardBacks.equipped);
  const adWatchCountToday = state.adWatch.date === todayStr() ? state.adWatch.count : 0;
  const spinAvailableToday = state.spinWheel.lastSpinDate !== todayStr();
  const dailyBonusAvailableToday = state.dailyBonus.lastClaimDate !== todayStr();
  const nextStreak = dailyBonusAvailableToday ? state.dailyBonus.streak + 1 : state.dailyBonus.streak;
  const dailyBonusAmount = Math.min(200 + (Math.max(1, nextStreak) - 1) * 50, 500);

  return {
    ...state,
    equippedBack,
    adWatchCountToday,
    spinAvailableToday,
    dailyBonusAvailableToday,
    dailyBonusAmount,
    awardFragment,
    buyOrEquipCardBack,
    equipCardBack,
    setAutoEquip,
    markAdWatched,
    markSpinUsed,
    claimDailyBonus,
    hasRedeemed,
    markCodeRedeemed,
    markFragmentsSeen
  };
}
