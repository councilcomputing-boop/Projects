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

// ── Classic/Peek + Quiz Practice engine ──

export type Action = 'H' | 'S' | 'D' | 'P';
export type SubHandStage = 'pending' | 'active' | 'stood' | 'bust';
export type HandOutcomeReason =
'bust' | 'both-blackjack' | 'dealer-blackjack' | 'player-blackjack' | 'dealer-bust' | 'higher-total' | 'lower-total' | 'tie';
export type Outcome = 'win' | 'lose' | 'push' | 'blackjack' | null;

export interface DecisionRecord {
  playerTotal: number;
  soft: boolean;
  dealerUpRank: Rank;
  action: Action;
  recommended: Action;
  correct: boolean;
}

export interface SubHand {
  cards: PlayingCardData[];
  doubled: boolean;
  stage: SubHandStage;
  result: Outcome;
  reason: HandOutcomeReason | null;
  bet: number;
  isAceSplit: boolean;
  movesCorrect: number;
  movesTotal: number;
  decisions: DecisionRecord[];
}

export type HandStage = 'player' | 'dealer' | 'done';

export interface Hand {
  id: number;
  dealerUp: PlayingCardData | null;
  dealerHole: PlayingCardData | null;
  dealerExtra: PlayingCardData[];
  holeRevealed: boolean;
  stage: HandStage;
  hands: SubHand[];
  activeIndex: number;
}

export interface HandHistoryEntry {
  result: Outcome;
  reason: HandOutcomeReason | null;
  correct: number;
  total: number;
}

export interface DealerGameState {
  numDecks: number;
  shoe: PlayingCardData[];
  runningCount: number;
  cardsSeen: number;
  hand: Hand | null;
  quiz: { correct: number; total: number };
  quizTrue: { correct: number; total: number };
  myCount: number;
  trackOwnCount: boolean;
  strategy: { correct: number; total: number };
  coachingEnabled: boolean;
  /** The table bankroll — the pool bets/doubles/splits/peeks/tips/quiz-rewards actually
      draw from and win into, separate from the player's total Blood Drops balance until
      they buy in or cash out. */
  bankroll: number;
  currentBet: number;
  betCoachingEnabled: boolean;
  stats: { hands: number; win: number; lose: number; push: number; blackjack: number };
  handHistory: HandHistoryEntry[];
}
