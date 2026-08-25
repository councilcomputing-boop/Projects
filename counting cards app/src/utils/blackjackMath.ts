import { Action, PlayingCardData, Rank } from '../types/blackjack';

export function rankValue(rank: Rank): number {
  if (rank === 'A') return 11;
  if (rank === 'K' || rank === 'Q' || rank === 'J' || rank === '10') return 10;
  return Number(rank);
}

export function handTotal(cards: PlayingCardData[]): number {
  let total = cards.reduce((sum, card) => sum + rankValue(card.rank), 0);
  let aces = cards.filter((card) => card.rank === 'A').length;
  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }
  return total;
}

/** Same math as handTotal, but also reports whether an ace is still counted as 11
    (i.e. the hand is "soft") — needed to pick the right strategy table row. */
export function softTotalInfo(cards: PlayingCardData[]): { total: number; soft: boolean } {
  let total = cards.reduce((sum, card) => sum + rankValue(card.rank), 0);
  let aces = cards.filter((card) => card.rank === 'A').length;
  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }
  return { total, soft: aces > 0 && total <= 21 };
}

export function isBlackjack(cards: PlayingCardData[]): boolean {
  return cards.length === 2 && handTotal(cards) === 21;
}

export function trueCount(running: number, decksLeft: number): number {
  const safe = Math.max(0.5, decksLeft);
  return running / safe;
}

// Rounds to the nearest 0.5 — the real app rounds both the exact true count and a
// player's typed answer to this granularity before comparing them for correctness.
export function roundToHalf(n: number): number {
  return Math.round(n * 2) / 2;
}

// Decks-remaining options offered everywhere a player picks how many decks are left
// (Manual mode's live count, Deck Math's calculator and practice problems): 8 down to
// 0.5 in half-deck steps.
export const DECKS_LEFT_OPTIONS: number[] = (() => {
  const opts: number[] = [];
  for (let d = 8; d >= 0.5; d -= 0.5) opts.push(d);
  return opts;
})();

export function fmtSigned(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
}

// ── Basic strategy (multi-deck, dealer stands on soft 17, no double-after-split,
//    no surrender) — exact tables from the live app. Each 10-char string is indexed by
//    dealerIdx(dealerUpRank): columns are dealer 2,3,4,5,6,7,8,9,10,A. ──
const HARD_STRATEGY: Record<number, string> = {
  8: 'HHHHHHHHHH', 9: 'HDDDDHHHHH', 10: 'DDDDDDDDHH', 11: 'DDDDDDDDDH',
  12: 'HHSSSHHHHH', 13: 'SSSSSHHHHH', 14: 'SSSSSHHHHH', 15: 'SSSSSHHHHH',
  16: 'SSSSSHHHHH', 17: 'SSSSSSSSSS'
};
const SOFT_STRATEGY: Record<number, string> = {
  13: 'HHHDDHHHHH', 14: 'HHHDDHHHHH', 15: 'HHDDDHHHHH', 16: 'HHDDDHHHHH',
  17: 'HDDDDHHHHH', 18: 'DDDDDSSHHH', 19: 'SSSSSSSSSS', 20: 'SSSSSSSSSS'
};
const PAIR_STRATEGY: Record<string, string> = {
  A: 'PPPPPPPPPP', '10': 'SSSSSSSSSS', '9': 'PPPPPSPPSS', '8': 'PPPPPPPPPP',
  '7': 'PPPPPPHHHH', '6': 'HPPPPHHHHH', '4': 'HHHHHHHHHH',
  '3': 'HHPPPPHHHH', '2': 'HHPPPPHHHH'
};

export function pairKey(rank: Rank): string {
  return rank === '10' || rank === 'J' || rank === 'Q' || rank === 'K' ? '10' : rank;
}

export function dealerIdx(rank: Rank): number {
  if (rank === 'A') return 9;
  if (rank === '10' || rank === 'J' || rank === 'Q' || rank === 'K') return 8;
  return parseInt(rank, 10) - 2;
}

export const ACTION_LABELS: Record<Action, string> = { H: 'Hit', S: 'Stand', D: 'Double', P: 'Split' };

export function basicStrategyAction(cards: PlayingCardData[], dealerUpRank: Rank, canDouble: boolean, canSplit: boolean): Action {
  const idx = dealerIdx(dealerUpRank);
  if (canSplit && cards.length === 2 && pairKey(cards[0].rank) === pairKey(cards[1].rank)) {
    const key = pairKey(cards[0].rank);
    if (key !== '5' && PAIR_STRATEGY[key]) {
      const action = PAIR_STRATEGY[key][idx] as Action;
      if (action === 'P') return 'P';
      if (action === 'D') return canDouble ? 'D' : 'H';
      return action;
    }
  }
  const { total, soft } = softTotalInfo(cards);
  if (soft && total >= 13 && total <= 20) {
    const action = SOFT_STRATEGY[Math.min(total, 20)][idx] as Action;
    return action === 'D' ? canDouble ? 'D' : 'H' : action;
  }
  const capped = Math.max(8, Math.min(total, 17));
  const action = HARD_STRATEGY[capped][idx] as Action;
  return action === 'D' ? canDouble ? 'D' : 'H' : action;
}

// True-count deviations from basic strategy (Illustrious 18 minus Insurance — this app
// has no insurance mechanic). These use the classic published TC thresholds even though
// this engine is S17/DAS-off (real EV-optimal thresholds run a bit higher) — kept the
// classic numbers since this is a trainer, not an EV tool.
interface CountDeviation {
  type: 'hard' | 'pair';
  total?: number;
  rank?: string;
  dealer: Rank;
  dir: 'gte' | 'lte';
  tc: number;
  action: Action;
}
const COUNT_DEVIATIONS: CountDeviation[] = [
{ type: 'hard', total: 16, dealer: '10', dir: 'gte', tc: 0, action: 'S' }, // base H
{ type: 'hard', total: 15, dealer: '10', dir: 'gte', tc: 4, action: 'S' }, // base H
{ type: 'hard', total: 16, dealer: '9', dir: 'gte', tc: 5, action: 'S' }, // base H
{ type: 'hard', total: 12, dealer: '2', dir: 'gte', tc: 3, action: 'S' }, // base H
{ type: 'hard', total: 12, dealer: '3', dir: 'gte', tc: 2, action: 'S' }, // base H
{ type: 'hard', total: 10, dealer: '10', dir: 'gte', tc: 4, action: 'D' }, // base H
{ type: 'hard', total: 10, dealer: 'A', dir: 'gte', tc: 4, action: 'D' }, // base H
{ type: 'hard', total: 11, dealer: 'A', dir: 'gte', tc: 1, action: 'D' }, // base H
{ type: 'hard', total: 9, dealer: '2', dir: 'gte', tc: 1, action: 'D' }, // base H
{ type: 'hard', total: 9, dealer: '7', dir: 'gte', tc: 3, action: 'D' }, // base H
{ type: 'pair', rank: '10', dealer: '5', dir: 'gte', tc: 5, action: 'P' }, // base S
{ type: 'pair', rank: '10', dealer: '6', dir: 'gte', tc: 4, action: 'P' }, // base S
{ type: 'hard', total: 13, dealer: '2', dir: 'lte', tc: -1, action: 'H' }, // base S
{ type: 'hard', total: 13, dealer: '3', dir: 'lte', tc: -2, action: 'H' }, // base S
{ type: 'hard', total: 12, dealer: '4', dir: 'lte', tc: 0, action: 'H' }, // base S
{ type: 'hard', total: 12, dealer: '5', dir: 'lte', tc: -2, action: 'H' }, // base S
{ type: 'hard', total: 12, dealer: '6', dir: 'lte', tc: -1, action: 'H' }]; // base S

function findCountDeviation(cards: PlayingCardData[], dealerUpRank: Rank, canSplit: boolean): CountDeviation | null {
  const dIdx = dealerIdx(dealerUpRank);
  if (canSplit && cards.length === 2 && pairKey(cards[0].rank) === pairKey(cards[1].rank)) {
    const key = pairKey(cards[0].rank);
    const hit = COUNT_DEVIATIONS.find((e) => e.type === 'pair' && e.rank === key && dealerIdx(e.dealer) === dIdx);
    if (hit) return hit;
  }
  const { total, soft } = softTotalInfo(cards);
  if (soft) return null; // no soft-total entries in this subset
  return COUNT_DEVIATIONS.find((e) => e.type === 'hard' && e.total === total && dealerIdx(e.dealer) === dIdx) || null;
}

export interface DeviationResult {
  action: Action;
  base: Action;
  active: boolean;
}

export function deviationAction(cards: PlayingCardData[], dealerUpRank: Rank, trueCountValue: number, canDouble: boolean, canSplit: boolean): DeviationResult {
  const base = basicStrategyAction(cards, dealerUpRank, canDouble, canSplit);
  const entry = findCountDeviation(cards, dealerUpRank, canSplit);
  if (!entry) return { action: base, base, active: false };
  const met = entry.dir === 'gte' ? trueCountValue >= entry.tc : trueCountValue <= entry.tc;
  if (!met) return { action: base, base, active: false };
  let action = entry.action;
  if (action === 'D' && !canDouble) action = 'H';
  return { action, base, active: true };
}

export function strategyTipMessage(result: DeviationResult): string {
  if (!result.active) return 'The book says: ' + ACTION_LABELS[result.base];
  if (result.action === result.base) return 'The book and the count agree: ' + ACTION_LABELS[result.action];
  return `The count says: ${ACTION_LABELS[result.action]} (the book alone would say ${ACTION_LABELS[result.base]})`;
}

/** Recommended bet size in units (1 unit = BET_STEP drops) for a given true count —
    used to grade Quiz-mode bets and to phrase the Peek-mode bet tip. */
export function recommendedUnits(tc: number): number {
  if (tc >= 4) return 8;
  if (tc >= 3) return 4;
  if (tc >= 2) return 2;
  return 1;
}
