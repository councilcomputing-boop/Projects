import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlayingCardData, Hand, SubHand, DealerGameState, Action, Rank, Outcome, HandOutcomeReason } from '../types/blackjack';
import { buildShoe, hiLoValue } from '../utils/deck';
import { useDrops } from '../contexts/DropsContext';
import { useCardBack } from '../contexts/CardBackContext';
import type { AwardResult } from './useCardBackStore';
import {
  Rarity,
  rollFragmentTarget,
  rollWeighted,
  rollSkillChestFragmentCount,
  skillMultiplierForStreak,
  SKILL_BAR_THRESHOLD,
  SKILL_CHEST_TIER_ODDS,
  SKILL_CHEST_FRAGMENT_ODDS } from
'../data/store';
import {
  handTotal,
  softTotalInfo,
  isBlackjack,
  basicStrategyAction,
  deviationAction,
  strategyTipMessage,
  ACTION_LABELS,
  pairKey,
  trueCount as calcTrueCount,
  recommendedUnits } from
'../utils/blackjackMath';

// Peek and Quiz Practice each get their own independent table -- separate shoe, hand,
// bankroll, bet, and stats -- rather than sharing one save under a single key.
function storageKeyFor(allowPeek: boolean) {
  return allowPeek ? 'cardCountingTrainerDealerState_peek' : 'cardCountingTrainerDealerState_quiz';
}
export const BET_MIN = 5, BET_MAX = 1000, BET_STEP = 5;
export const PEEK_COST = 10, PEEK_REVEAL_MS = 3000;
export const STRATEGY_TIP_COST = 15, BET_TIP_COST = 15, QUIZ_REWARD = 15;
const DEALER_DRAW_DELAY_MS = 650;
const RESHUFFLE_PENETRATION = 0.25;

function clampBet(n: number) {
  const rounded = Math.round(n / BET_STEP) * BET_STEP;
  return Math.max(BET_MIN, Math.min(BET_MAX, rounded));
}

function defaultDealerState(numDecks = 6): DealerGameState {
  return {
    numDecks,
    shoe: buildShoe(numDecks),
    runningCount: 0,
    cardsSeen: 0,
    hand: null,
    quiz: { correct: 0, total: 0 },
    quizTrue: { correct: 0, total: 0 },
    myCount: 0,
    trackOwnCount: false,
    strategy: { correct: 0, total: 0 },
    coachingEnabled: true,
    bankroll: 0,
    skillProgress: 0,
    skillStreak: 0,
    currentBet: 25,
    betCoachingEnabled: true,
    stats: { hands: 0, win: 0, lose: 0, push: 0, blackjack: 0 },
    handHistory: []
  };
}

function loadState(allowPeek: boolean): DealerGameState {
  try {
    const raw = localStorage.getItem(storageKeyFor(allowPeek));
    if (!raw) return defaultDealerState();
    const parsed = JSON.parse(raw);
    const base = defaultDealerState(parsed.numDecks || 6);
    const shoeOk = Array.isArray(parsed.shoe) && parsed.shoe.length > 0;
    return { ...base, ...parsed, shoe: shoeOk ? parsed.shoe : base.shoe };
  } catch {
    return defaultDealerState();
  }
}

function canDoubleNow(hand: Hand, cur: SubHand) {
  return cur.cards.length === 2 && hand.hands.length === 1;
}
function canSplitNow(hand: Hand, cur: SubHand) {
  return (
    cur.cards.length === 2 &&
    hand.hands.length === 1 &&
    pairKey(cur.cards[0].rank) === pairKey(cur.cards[1].rank));

}

interface DrawResult {
  state: DealerGameState;
  card: PlayingCardData;
}

/** Pops one card off the shoe (counting it into runningCount/cardsSeen if requested),
    silently topping the shoe up with a fresh build if it runs dry mid-hand — matches the
    real app's behavior exactly (a full reshuffle only happens between hands). */
function drawCard(state: DealerGameState, countIt: boolean): DrawResult {
  let shoe = state.shoe;
  if (shoe.length === 0) shoe = buildShoe(state.numDecks);
  const card = shoe[shoe.length - 1];
  const nextShoe = shoe.slice(0, -1);
  return {
    card,
    state: {
      ...state,
      shoe: nextShoe,
      runningCount: countIt ? state.runningCount + hiLoValue(card.rank) : state.runningCount,
      cardsSeen: countIt ? state.cardsSeen + 1 : state.cardsSeen
    }
  };
}

function maybeReshuffle(state: DealerGameState): DealerGameState {
  if (state.shoe.length < state.numDecks * 52 * RESHUFFLE_PENETRATION) {
    return { ...state, shoe: buildShoe(state.numDecks), runningCount: 0, cardsSeen: 0, hand: null };
  }
  return state;
}

function dealerCardsOf(hand: Hand): PlayingCardData[] {
  const cards: PlayingCardData[] = [];
  if (hand.dealerUp) cards.push(hand.dealerUp);
  if (hand.dealerHole) cards.push(hand.dealerHole);
  cards.push(...hand.dealerExtra);
  return cards;
}

function describeOutcome(reason: HandOutcomeReason, handLabel: string): string {
  switch (reason) {
    case 'bust':return `${handLabel} busted over 21.`;
    case 'both-blackjack':return `${handLabel} and the dealer both had blackjack — push.`;
    case 'dealer-blackjack':return `The dealer had blackjack.`;
    case 'player-blackjack':return `${handLabel} had blackjack — paid 3:2.`;
    case 'dealer-bust':return `The dealer busted over 21.`;
    case 'higher-total':return `${handLabel} beat the dealer's total.`;
    case 'lower-total':return `The dealer's total beat ${handLabel}.`;
    case 'tie':return `${handLabel} tied the dealer — push.`;
  }
}

function resolveHand(state: DealerGameState): DealerGameState {
  if (!state.hand) return state;
  const dealerTotal = handTotal(dealerCardsOf(state.hand));
  const dealerBJ = isBlackjack(dealerCardsOf(state.hand));

  let bankroll = state.bankroll;
  let win = 0, lose = 0, push = 0, blackjack = 0;
  const resolvedHands: SubHand[] = state.hand.hands.map((h) => {
    const playerTotal = handTotal(h.cards);
    let result: Outcome, reason: HandOutcomeReason, payout: number;
    if (playerTotal > 21) {
      result = 'lose';reason = 'bust';payout = 0;
    } else if (dealerBJ && isBlackjack(h.cards) && state.hand!.hands.length === 1) {
      result = 'push';reason = 'both-blackjack';payout = h.bet;
    } else if (dealerBJ) {
      result = 'lose';reason = 'dealer-blackjack';payout = 0;
    } else if (isBlackjack(h.cards) && state.hand!.hands.length === 1) {
      result = 'blackjack';reason = 'player-blackjack';payout = Math.round(h.bet * 2.5);
    } else if (dealerTotal > 21) {
      result = 'win';reason = 'dealer-bust';payout = h.bet * 2;
    } else if (playerTotal > dealerTotal) {
      result = 'win';reason = 'higher-total';payout = h.bet * 2;
    } else if (playerTotal < dealerTotal) {
      result = 'lose';reason = 'lower-total';payout = 0;
    } else {
      result = 'push';reason = 'tie';payout = h.bet;
    }
    bankroll += payout;
    if (result === 'win') win += 1;else
    if (result === 'lose') lose += 1;else
    if (result === 'push') push += 1;else
    if (result === 'blackjack') blackjack += 1;
    return { ...h, stage: playerTotal > 21 ? 'bust' : 'stood', result, reason };
  });

  const totalCorrect = resolvedHands.reduce((s, h) => s + h.movesCorrect, 0);
  const totalMoves = resolvedHands.reduce((s, h) => s + h.movesTotal, 0);
  const primary = resolvedHands[0];
  const handHistory = [
  { result: primary.result, reason: primary.reason, correct: totalCorrect, total: totalMoves },
  ...state.handHistory].
  slice(0, 30);

  return {
    ...state,
    bankroll,
    hand: { ...state.hand, hands: resolvedHands, stage: 'done', holeRevealed: true },
    stats: {
      hands: state.stats.hands + 1,
      win: state.stats.win + win,
      lose: state.stats.lose + lose,
      push: state.stats.push + push,
      blackjack: state.stats.blackjack + blackjack
    },
    handHistory
  };
}

let nextHandId = 1;

export function useDealerGame(allowPeek: boolean) {
  const dropsCtx = useDrops();
  const cardBackCtx = useCardBack();
  const navigate = useNavigate();
  const [state, setState] = useState<DealerGameState>(() => loadState(allowPeek));
  const [skillChestReveal, setSkillChestReveal] = useState<{tier: Rarity;results: AwardResult[];} | null>(null);
  const [isPeeking, setIsPeeking] = useState(false);
  const [betEstablished, setBetEstablished] = useState(false);
  const [showBetSetup, setShowBetSetup] = useState(false);
  const [strategyTipUsedKey, setStrategyTipUsedKey] = useState<string | null>(null);
  const [betTipUsedThisHand, setBetTipUsedThisHand] = useState(false);
  // Single source of truth for "the last thing Dracula said" — strategy coaching, bet
  // tip, strategy tip, and affordability messages all funnel through this one state, so
  // a stale message from an earlier action can never silently mask a newer one.
  const [hintMessage, setHintMessage] = useState<string | null>(null);
  const [quizOpen, setQuizOpen] = useState(false);
  const [quizType, setQuizType] = useState<'running' | 'true'>('running');
  const [quizFeedback, setQuizFeedback] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);

  const cardsSinceQuiz = useRef(0);
  const pendingQuizResume = useRef<(() => void) | null>(null);
  const trueCountAtBet = useRef(0);

  useEffect(() => {
    localStorage.setItem(storageKeyFor(allowPeek), JSON.stringify(state));
  }, [state, allowPeek]);

  // Kept in sync on every render (not inside an effect) so it's guaranteed current by
  // the time the unmount cleanup below reads it -- an effect with a [state] dependency
  // would only update this after commit, one render behind where React actually is
  // during teardown.
  const stateRef = useRef(state);
  stateRef.current = state;

  // Leaving the table (Quit, browser back, any other way off this page) returns
  // whatever bankroll is left to the account AND resets the table itself -- fresh
  // shoe, no hand in progress, count/stats/quiz score/skill progress all back to zero
  // -- same as walking up to a table for the first time, rather than resuming exactly
  // where a previous session left off. Preferences (coaching toggles, deck count)
  // survive the reset since those aren't table state. Deliberately does NOT go through
  // setState -- React isn't guaranteed to actually invoke a setState updater for a
  // component that's mid-unmount, which is exactly why an earlier version of this (the
  // money-only version) never fired. Reading stateRef and writing addDrops/localStorage
  // directly has no such dependency on React choosing to process the update.
  useEffect(() => {
    return () => {
      const prev = stateRef.current;
      if (prev.bankroll > 0) dropsCtx.addDrops(prev.bankroll);
      const next: DealerGameState = {
        ...defaultDealerState(prev.numDecks),
        coachingEnabled: prev.coachingEnabled,
        betCoachingEnabled: prev.betCoachingEnabled,
        trackOwnCount: prev.trackOwnCount
      };
      localStorage.setItem(storageKeyFor(allowPeek), JSON.stringify(next));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const trueCountNow = calcTrueCount(state.runningCount, Math.max(0.5, state.shoe.length / 52));

  // ── Mid-hand quiz (Quiz mode only): pauses the given continuation behind the quiz
  //    modal roughly every 3+ cards, 35% of the time, mirroring the real app. ──
  function checkQuizThenResume(after: () => void) {
    if (allowPeek) { after(); return; }
    cardsSinceQuiz.current += 1;
    if (cardsSinceQuiz.current >= 3 && Math.random() < 0.35) {
      cardsSinceQuiz.current = 0;
      pendingQuizResume.current = after;
      setQuizType(Math.random() < 0.5 ? 'true' : 'running');
      setQuizOpen(true);
      return;
    }
    after();
  }

  function submitQuizAnswer(rawAnswer: number) {
    if (quizType === 'true') {
      const roundedCorrect = Math.round(trueCountNow * 2) / 2;
      const roundedAnswer = Math.round(rawAnswer * 2) / 2;
      const correct = roundedCorrect === roundedAnswer;
      setState((prev) => ({
        ...prev,
        quizTrue: { correct: prev.quizTrue.correct + (correct ? 1 : 0), total: prev.quizTrue.total + 1 },
        bankroll: prev.bankroll + (correct ? QUIZ_REWARD : 0)
      }));
      registerSkillEvent(correct);
      setQuizFeedback(
        (correct ? 'Exact.' : 'Off the count.') + ` True count is ${roundedCorrect}.` + (correct ? ` (+${QUIZ_REWARD} 🩸)` : '')
      );
    } else {
      const correct = rawAnswer === state.runningCount;
      setState((prev) => ({
        ...prev,
        quiz: { correct: prev.quiz.correct + (correct ? 1 : 0), total: prev.quiz.total + 1 },
        bankroll: prev.bankroll + (correct ? QUIZ_REWARD : 0)
      }));
      registerSkillEvent(correct);
      setQuizFeedback(
        (correct ? 'Exact.' : 'Off the count.') + ` Running count is ${state.runningCount}.` + (correct ? ` (+${QUIZ_REWARD} 🩸)` : '')
      );
    }
  }

  function closeQuizModal() {
    setQuizOpen(false);
    setQuizFeedback(null);
    const resume = pendingQuizResume.current;
    pendingQuizResume.current = null;
    if (resume) resume();
  }

  // ── Betting ──
  function setBet(n: number) {
    setState((prev) => ({ ...prev, currentBet: clampBet(n) }));
  }
  function confirmBetSetup(amount: number) {
    setState((prev) => ({ ...prev, currentBet: clampBet(amount) }));
    setBetEstablished(true);
    setShowBetSetup(false);
  }

  function handIsIdle() {
    return !state.hand || state.hand.stage === 'done';
  }

  // ── Dealing ──
  function dealNewHand() {
    if (!betEstablished) { setShowBetSetup(true); return; }
    if (state.bankroll < state.currentBet) { setHintMessage("You don't have enough bankroll for that bet."); return; }
    setHintMessage(null);

    setState((prev) => {
      let s = maybeReshuffle(prev);
      const bet = s.currentBet;
      s = { ...s, bankroll: s.bankroll - bet };

      let playerCard1: PlayingCardData, playerCard2: PlayingCardData, dealerUp: PlayingCardData, dealerHole: PlayingCardData;
      ({ card: playerCard1, state: s } = drawCard(s, true));
      ({ card: playerCard2, state: s } = drawCard(s, true));
      ({ card: dealerUp, state: s } = drawCard(s, true));
      ({ card: dealerHole, state: s } = drawCard(s, false)); // hole card isn't counted until revealed

      trueCountAtBet.current = calcTrueCount(s.runningCount, Math.max(0.5, s.shoe.length / 52));

      const hand: Hand = {
        id: nextHandId++,
        dealerUp,
        dealerHole,
        dealerExtra: [],
        holeRevealed: false,
        stage: 'player',
        activeIndex: 0,
        hands: [
        {
          cards: [playerCard1, playerCard2],
          doubled: false,
          stage: 'active',
          result: null,
          reason: null,
          bet,
          isAceSplit: false,
          movesCorrect: 0,
          movesTotal: 0,
          decisions: []
        }]

      };

      const playerNatural = isBlackjack(hand.hands[0].cards);
      const dealerNatural = isBlackjack([dealerUp, dealerHole]);
      if (playerNatural || dealerNatural) {
        // Count the hole card now that a natural forces it to reveal immediately.
        s = { ...s, runningCount: s.runningCount + hiLoValue(dealerHole.rank), hand: { ...hand, holeRevealed: true } };
        s = resolveHand(s);
      } else {
        s = { ...s, hand };
      }
      return s;
    });

    if (!allowPeek) {
      // Grade the bet against the true count at the moment of betting (Quiz mode only).
      setState((prev) => {
        if (!prev.betCoachingEnabled) return prev;
        const rec = recommendedUnits(trueCountAtBet.current);
        const actualUnits = Math.round(prev.currentBet / BET_STEP);
        const matched = Math.abs(actualUnits - rec) <= 1;
        setHintMessage(matched ? 'Bet matched the count.' : `The count suggested about ${rec * BET_STEP} 🩸 this hand.`);
        return prev;
      });
    }
    setBetTipUsedThisHand(false);
    setStrategyTipUsedKey(null);
    checkQuizThenResume(() => {});
  }

  // ── Strategy grading ──
  function gradeMove(cur: SubHand, action: Action, canDouble: boolean, canSplit: boolean, dealerUpRank: Rank) {
    const recommended = basicStrategyAction(cur.cards, dealerUpRank, canDouble, canSplit);
    const { total, soft } = softTotalInfo(cur.cards);
    const correct = action === recommended;
    const decision = { playerTotal: total, soft, dealerUpRank, action, recommended, correct };
    setState((prev) => ({ ...prev, strategy: { correct: prev.strategy.correct + (correct ? 1 : 0), total: prev.strategy.total + 1 } }));
    registerSkillEvent(correct);
    if (state.coachingEnabled) {
      setHintMessage(correct ? 'Correct — the book agrees.' : `Book says ${recommended === 'H' ? 'Hit' : recommended === 'S' ? 'Stand' : recommended === 'D' ? 'Double' : 'Split'}.`);
    }
    return decision;
  }

  function advanceOrFinish(handAfter: Hand) {
    const cur = handAfter.hands[handAfter.activeIndex];
    if (cur.stage === 'active') return; // still going
    if (handAfter.activeIndex === 0 && handAfter.hands.length === 2 && handAfter.hands[1].stage === 'pending') {
      setState((prev) => ({ ...prev, hand: { ...handAfter, activeIndex: 1, hands: handAfter.hands.map((h, i) => i === 1 ? { ...h, stage: 'active' } : h) } }));
      return;
    }
    finishPlayerTurn(handAfter);
  }

  function finishPlayerTurn(handAfter: Hand) {
    const allBusted = handAfter.hands.every((h) => handTotal(h.cards) > 21);
    checkQuizThenResume(() => {
      setState((prev) => {
        let s = { ...prev, hand: { ...handAfter, stage: 'dealer' as const } };
        if (!s.hand!.holeRevealed) {
          s = { ...s, runningCount: s.runningCount + hiLoValue(s.hand!.dealerHole!.rank), hand: { ...s.hand!, holeRevealed: true } };
        }
        if (allBusted) {
          return resolveHand({ ...s, hand: { ...s.hand!, stage: 'done' } });
        }
        return s;
      });
    });
  }

  // Drives the dealer's card-by-card draw with the real 650ms delay between cards.
  useEffect(() => {
    if (!state.hand || state.hand.stage !== 'dealer') return;
    const dealerCards = dealerCardsOf(state.hand);
    if (handTotal(dealerCards) >= 17) {
      setState((prev) => resolveHand(prev));
      return;
    }
    const timer = window.setTimeout(() => {
      setState((prev) => {
        if (!prev.hand || prev.hand.stage !== 'dealer') return prev;
        const { card, state: s } = drawCard(prev, true);
        return { ...s, hand: { ...s.hand!, dealerExtra: [...s.hand!.dealerExtra, card] } };
      });
    }, DEALER_DRAW_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [state.hand]);

  function playerHit() {
    if (!state.hand) return;
    const hand = state.hand;
    const cur = hand.hands[hand.activeIndex];
    const decision = gradeMove(cur, 'H', canDoubleNow(hand, cur), canSplitNow(hand, cur), hand.dealerUp!.rank);
    setState((prev) => {
      const { card, state: s } = drawCard(prev, true);
      const h = s.hand!;
      const c = h.hands[h.activeIndex];
      const cards = [...c.cards, card];
      const total = handTotal(cards);
      const bust = total > 21;
      // 21 can only push or win from here -- hitting again can only hurt, so auto-stand
      // instead of leaving it sitting active for a stray extra tap to bust.
      const updated: SubHand = { ...c, cards, stage: bust ? 'bust' : total === 21 ? 'stood' : 'active', movesCorrect: c.movesCorrect + (decision.correct ? 1 : 0), movesTotal: c.movesTotal + 1, decisions: [...c.decisions, decision] };
      const nextHands = h.hands.map((x, i) => i === h.activeIndex ? updated : x);
      const handAfter = { ...h, hands: nextHands };
      window.setTimeout(() => advanceOrFinish(handAfter), 0);
      return { ...s, hand: handAfter };
    });
  }

  function playerStand() {
    if (!state.hand) return;
    const hand = state.hand;
    const cur = hand.hands[hand.activeIndex];
    const decision = gradeMove(cur, 'S', canDoubleNow(hand, cur), canSplitNow(hand, cur), hand.dealerUp!.rank);
    const updated: SubHand = { ...cur, stage: 'stood', movesCorrect: cur.movesCorrect + (decision.correct ? 1 : 0), movesTotal: cur.movesTotal + 1, decisions: [...cur.decisions, decision] };
    const handAfter = { ...hand, hands: hand.hands.map((x, i) => i === hand.activeIndex ? updated : x) };
    setState((prev) => ({ ...prev, hand: handAfter }));
    advanceOrFinish(handAfter);
  }

  function playerDouble() {
    if (!state.hand) return;
    const hand = state.hand;
    const cur = hand.hands[hand.activeIndex];
    if (!canDoubleNow(hand, cur) || state.bankroll < cur.bet) return;
    const decision = gradeMove(cur, 'D', true, canSplitNow(hand, cur), hand.dealerUp!.rank);
    setState((prev) => {
      const { card, state: s } = drawCard({ ...prev, bankroll: prev.bankroll - cur.bet }, true);
      const h = s.hand!;
      const c = h.hands[h.activeIndex];
      const cards = [...c.cards, card];
      const bust = handTotal(cards) > 21;
      const updated: SubHand = { ...c, cards, doubled: true, bet: c.bet * 2, stage: bust ? 'bust' : 'stood', movesCorrect: c.movesCorrect + (decision.correct ? 1 : 0), movesTotal: c.movesTotal + 1, decisions: [...c.decisions, decision] };
      const handAfter = { ...h, hands: h.hands.map((x, i) => i === h.activeIndex ? updated : x) };
      window.setTimeout(() => advanceOrFinish(handAfter), 0);
      return { ...s, hand: handAfter };
    });
  }

  function playerSplit() {
    if (!state.hand) return;
    const hand = state.hand;
    const cur = hand.hands[hand.activeIndex];
    if (!canSplitNow(hand, cur) || state.bankroll < cur.bet) return;
    const decision = gradeMove(cur, 'P', canDoubleNow(hand, cur), true, hand.dealerUp!.rank);
    const isAces = cur.cards[0].rank === 'A';

    setState((prev) => {
      let s: DealerGameState = { ...prev, bankroll: prev.bankroll - cur.bet };
      let cardA: PlayingCardData, cardB: PlayingCardData;
      ({ card: cardA, state: s } = drawCard(s, true));
      ({ card: cardB, state: s } = drawCard(s, true));

      const hand1: SubHand = {
        cards: [cur.cards[0], cardA],
        doubled: false,
        stage: isAces ? 'stood' : 'active',
        result: null,
        reason: null,
        bet: cur.bet,
        isAceSplit: isAces,
        movesCorrect: cur.movesCorrect + (decision.correct ? 1 : 0),
        movesTotal: cur.movesTotal + 1,
        decisions: [...cur.decisions, decision]
      };
      const hand2: SubHand = {
        cards: [cur.cards[1], cardB],
        doubled: false,
        stage: isAces ? 'stood' : 'pending',
        result: null,
        reason: null,
        bet: cur.bet,
        isAceSplit: isAces,
        movesCorrect: 0,
        movesTotal: 0,
        decisions: []
      };
      const handAfter: Hand = { ...s.hand!, hands: [hand1, hand2], activeIndex: 0 };
      window.setTimeout(() => advanceOrFinish(handAfter), 0);
      return { ...s, hand: handAfter };
    });
  }

  // ── Peek (Peek mode) ──
  function triggerPeek() {
    if (state.bankroll < PEEK_COST) { setHintMessage('Not enough bankroll to peek.'); return; }
    setState((prev) => ({ ...prev, bankroll: prev.bankroll - PEEK_COST }));
    setIsPeeking(true);
    window.setTimeout(() => setIsPeeking(false), PEEK_REVEAL_MS);
  }

  // ── Bet tip (Peek mode, count-aware) / Strategy tip (both modes) ──
  function requestBetTip() {
    if (betTipUsedThisHand || !state.hand) return;
    if (state.bankroll < BET_TIP_COST) { setHintMessage('Not enough bankroll.'); return; }
    setState((prev) => ({ ...prev, bankroll: prev.bankroll - BET_TIP_COST }));
    setBetTipUsedThisHand(true);
    const rec = recommendedUnits(trueCountNow);
    const actualUnits = Math.round(state.currentBet / BET_STEP);
    setHintMessage(Math.abs(actualUnits - rec) <= 1 ? 'Your bet matched the count.' : `The count suggests about ${rec * BET_STEP} 🩸 this hand.`);
  }

  function requestStrategyTip() {
    if (!state.hand) return;
    const hand = state.hand;
    const cur = hand.hands[hand.activeIndex];
    const key = `${hand.id}:${hand.activeIndex}:${cur.cards.length}`;
    if (strategyTipUsedKey === key) return;
    if (allowPeek && state.bankroll < STRATEGY_TIP_COST) { setHintMessage('Not enough bankroll.'); return; }
    if (allowPeek) setState((prev) => ({ ...prev, bankroll: prev.bankroll - STRATEGY_TIP_COST }));
    setStrategyTipUsedKey(key);
    const canDouble = canDoubleNow(hand, cur);
    const canSplit = canSplitNow(hand, cur);
    if (allowPeek) {
      const result = deviationAction(cur.cards, hand.dealerUp!.rank, trueCountNow, canDouble, canSplit);
      setHintMessage(strategyTipMessage(result));
    } else {
      const rec = basicStrategyAction(cur.cards, hand.dealerUp!.rank, canDouble, canSplit);
      setHintMessage('The book says: ' + ACTION_LABELS[rec]);
    }
  }

  // ── Own-count self-check (never validated) ──
  function tapOwnCount(v: number) {
    setState((prev) => ({ ...prev, myCount: prev.myCount + v }));
  }
  function resetOwnCount() {
    setState((prev) => ({ ...prev, myCount: 0 }));
  }
  function setTrackOwnCount(v: boolean) {
    setState((prev) => ({ ...prev, trackOwnCount: v }));
  }
  function setCoachingEnabled(v: boolean) {
    setState((prev) => ({ ...prev, coachingEnabled: v }));
  }
  function setBetCoachingEnabled(v: boolean) {
    setState((prev) => ({ ...prev, betCoachingEnabled: v }));
  }

  function shuffleNewShoe(numDecks = state.numDecks) {
    setState((prev) => ({ ...prev, numDecks, shoe: buildShoe(numDecks), runningCount: 0, cardsSeen: 0, hand: null }));
  }

  /** Moves `amount` from the player's total Blood Drops balance into this table's
      bankroll. Returns false (leaving both balances untouched) if they can't afford it. */
  function buyIn(amount: number): boolean {
    if (amount <= 0 || !dropsCtx.spendDrops(amount)) return false;
    setState((prev) => ({ ...prev, bankroll: prev.bankroll + amount }));
    setHintMessage(null);
    return true;
  }

  /** Returns the entire table bankroll to the player's total Blood Drops balance. */
  function cashOut() {
    if (state.bankroll <= 0) return;
    dropsCtx.addDrops(state.bankroll);
    setState((prev) => ({ ...prev, bankroll: 0 }));
  }

  // ── Skill Chest: earned by playing well, not bought (see data/store.ts) ──

  /** Rolls a chest tier, then 1-5 fragments within it, against a locally-tracked
      owned/fragments snapshot (via the pure previewAward), applying every result in one
      commitAwards() call at the end. Calling the stateful awardFragment repeatedly in a
      tight loop isn't safe -- see previewAward's doc comment -- and could leave a
      fragment silently uncredited or throw partway through. */
  function openSkillChest() {
    const tier = rollWeighted(SKILL_CHEST_TIER_ODDS);
    const fragCount = rollSkillChestFragmentCount();
    const results: AwardResult[] = [];
    let owned = [...cardBackCtx.cardBacks.owned];
    let fragments = { ...cardBackCtx.cardBacks.fragments };
    for (let i = 0; i < fragCount; i++) {
      const target = rollFragmentTarget(SKILL_CHEST_FRAGMENT_ODDS[tier], owned);
      const result = cardBackCtx.previewAward(target, owned, fragments);
      results.push(result);
      if (result.unlocked) {
        owned = [...owned, target.id];
        fragments = { ...fragments };
        delete fragments[target.id];
      } else {
        fragments = { ...fragments, [target.id]: result.have };
      }
    }
    cardBackCtx.commitAwards(results);
    setSkillChestReveal({ tier, results });
  }

  function closeSkillChestReveal() {
    setSkillChestReveal(null);
    // A skill chest always awards at least one fragment -- head to the shop to watch it
    // fill in, same as the drops-bought chests and the wheel's card segments. Tell the
    // shop where to send you back once the reveal finishes, since this interrupted an
    // actual hand in progress rather than a deliberate trip to the Store.
    navigate('/card-backs', { state: { returnTo: allowPeek ? '/peek' : '/quiz' } });
  }

  /** Called after every graded strategy move and every count-quiz answer. A correct
      one adds to the skill bar (scaled by the current streak multiplier) and opens a
      chest on fillup; an incorrect one only resets the streak — already-earned bar
      progress is never taken away. */
  function registerSkillEvent(correct: boolean) {
    if (!correct) {
      setState((prev) => prev.skillStreak === 0 ? prev : { ...prev, skillStreak: 0 });
      return;
    }
    const streak = state.skillStreak + 1;
    const nextProgress = state.skillProgress + skillMultiplierForStreak(streak);
    if (nextProgress >= SKILL_BAR_THRESHOLD) {
      setState((prev) => ({ ...prev, skillStreak: streak, skillProgress: nextProgress - SKILL_BAR_THRESHOLD }));
      openSkillChest();
    } else {
      setState((prev) => ({ ...prev, skillStreak: streak, skillProgress: nextProgress }));
    }
  }

  return {
    ...state,
    trueCount: trueCountNow,
    isPeeking,
    betEstablished,
    showBetSetup,
    setShowBetSetup,
    betTipUsedThisHand,
    hintMessage,
    quizOpen,
    quizType,
    quizFeedback,
    reviewOpen,
    setReviewOpen,
    handIsIdle,
    setBet,
    confirmBetSetup,
    dealNewHand,
    playerHit,
    playerStand,
    playerDouble,
    playerSplit,
    canDoubleNow: state.hand ? canDoubleNow(state.hand, state.hand.hands[state.hand.activeIndex]) : false,
    canSplitNow: state.hand ? canSplitNow(state.hand, state.hand.hands[state.hand.activeIndex]) : false,
    triggerPeek,
    requestBetTip,
    requestStrategyTip,
    submitQuizAnswer,
    closeQuizModal,
    tapOwnCount,
    resetOwnCount,
    setTrackOwnCount,
    setCoachingEnabled,
    setBetCoachingEnabled,
    shuffleNewShoe,
    needsBuyIn: state.bankroll <= 0,
    buyIn,
    cashOut,
    skillChestReveal,
    closeSkillChestReveal,
    ...dropsCtx,
    describeOutcome
  };
}
