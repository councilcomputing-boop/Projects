import { PlayingCardData, Rank, Suit } from '../types/blackjack';

const SUITS: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs'];
const RANKS: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

export const SUIT_GLYPHS: Record<Suit, string> = {
  spades: '♠',
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣'
};

export function isRedSuit(suit: Suit): boolean {
  return suit === 'hearts' || suit === 'diamonds';
}

export function hiLoValue(rank: Rank): number {
  if (rank === '2' || rank === '3' || rank === '4' || rank === '5' || rank === '6') return 1;
  if (rank === '7' || rank === '8' || rank === '9') return 0;
  return -1;
}

export function buildDeck(): PlayingCardData[] {
  const deck: PlayingCardData[] = [];
  SUITS.forEach((suit) => {
    RANKS.forEach((rank) => {
      deck.push({ id: `${rank}-${suit}`, rank, suit });
    });
  });
  return deck;
}

export function shuffle(cards: PlayingCardData[]): PlayingCardData[] {
  const next = [...cards];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

export function formatCount(value: number): string {
  if (value > 0) return `+${value}`;
  return `${value}`;
}