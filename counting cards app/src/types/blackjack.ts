export type Suit = 'spades' | 'hearts' | 'diamonds' | 'clubs';

export type Rank = 'A' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K';

export interface PlayingCardData {
  id: string;
  rank: Rank;
  suit: Suit;
}

export type DrillPhase = 'idle' | 'running' | 'guess' | 'result';

export interface SessionRecord {
  id: string;
  label: string;
  accuracy: number;
  cardsPerMinute: number;
  date: string;
}