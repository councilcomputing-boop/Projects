import { PlayingCardData, Rank } from '../types/blackjack';

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

export function isBlackjack(cards: PlayingCardData[]): boolean {
  return cards.length === 2 && handTotal(cards) === 21;
}

export function trueCount(running: number, decksLeft: number): number {
  const safe = Math.max(0.5, decksLeft);
  return Math.round(running / safe * 10) / 10;
}

export function betAdvice(tc: number, unit: number): {units: number;text: string;} {
  if (tc >= 4) return { units: unit * 4, text: 'The shoe is rich — press your bet hard this hand.' };
  if (tc >= 2) return { units: unit * 2, text: 'Count favors you — raise your bet.' };
  if (tc >= 1) return { units: Math.round(unit * 1.5), text: 'Slight edge to you — a small raise is fair.' };
  return { units: unit, text: "The count doesn't favor you right now — keep it to a minimum bet." };
}

export function strategyAdvice(player: PlayingCardData[], dealerUp: PlayingCardData): 'hit' | 'stand' | 'double' {
  const total = handTotal(player);
  const up = rankValue(dealerUp.rank);
  if (player.length === 2 && (total === 10 || total === 11) && up <= 9) return 'double';
  if (total >= 17) return 'stand';
  if (total >= 13 && up <= 6) return 'stand';
  if (total === 12 && up >= 4 && up <= 6) return 'stand';
  return 'hit';
}