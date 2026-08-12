import { useEffect, useRef, useState } from 'react';
import { PlayingCardData, Hand, SubHand, DealerGameState, Action, Rank, Outcome, HandOutcomeReason } from '../types/blackjack';
import { buildShoe, hiLoValue } from '../utils/deck';
import { auth, fdb } from '../lib/firebase';
import {
  handTotal,
  softTotalInfo,
  isBlackjack,
  basicStrategyAction,
  deviationAction,
  pairKey,
  trueCount as calcTrueCount,
  recommendedUnits } from
'../utils/blackjackMath';

const DEALER_KEY = 'cardCountingTrainerDealerState';
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
    drops: 1000,
    dropsHigh: 1000,
    currentBet: 25,
    betCoachingEnabled: true,
    stats: { hands: 0, win: 0, lose: 0, push: 0, blackjack: 0 },
    handHistory: [],
    disclaimerAckAt: null
  };
}

function loadState(): DealerGameState {
  try {
    const raw = localStorage.getItem(DEALER_KEY);
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

  let drops = state.drops;
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
    drops += payout;
    if (result === 'win') win += 1;else
    if (result === 'lose') lose += 1;else
    if (result === 'push') push += 1;else
    if (result === 'blackjack') blackjack += 1;
    return { ...h, stage: playerTotal > 21 ? 'bust' : 'stood', result, reason };
  });

  const dropsHigh = Math.max(state.dropsHigh, drops);
  const totalCorrect = resolvedHands.reduce((s, h) => s + h.movesCorrect, 0);
  const totalMoves = resolvedHands.reduce((s, h) => s + h.movesTotal, 0);
  const primary = resolvedHands[0];
  const handHistory = [
  { result: primary.result, reason: primary.reason, correct: totalCorrect, total: totalMoves },
  ...state.handHistory].
  slice(0, 30);

  return {
    ...state,
    drops,
    dropsHigh,
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
  const [state, setState] = useState<DealerGameState>(loadState);
  const [isPeeking, setIsPeeking] = useState(false);
  const [betEstablished, setBetEstablished] = useState(false);
  const [showBetSetup, setShowBetSetup] = useState(false);
  const [strategyTipUsedKey, setStrategyTipUsedKey] = useState<string | null>(null);
  const [betTipUsedThisHand, setBetTipUsedThisHand] = useState(false);
  const [coachMessage, setCoachMessage] = useState<string | null>(null);
  const [betTipResult, setBetTipResult] = useState<string | null>(null);
  const [strategyTipResult, setStrategyTipResult] = useState<string | null>(null);
  const [quizOpen, setQuizOpen] = useState(false);
  const [quizType, setQuizType] = useState<'running' | 'true'>('running');
  const [quizFeedback, setQuizFeedback] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);

  const cardsSinceQuiz = useRef(0);
  const pendingQuizResume = useRef<(() => void) | null>(null);
  const trueCountAtBet = useRef(0);

  useEffect(() => {
    localStorage.setItem(DEALER_KEY, JSON.stringify(state));
  }, [state]);

  // ── Firestore sync: only drops/dropsHigh/disclaimerAckAt ever sync, matching the real
  //    app exactly and matching firestore.rules' allowed client-writable field set.
  //    One-shot bootstrap read + a real-time listener for the rest of the session;
  //    outbound pushes are debounced ~3.5s. A snapshot that matches what's already in
  //    local state is treated as a no-op (covers both "it's an echo of our own push"
  //    and "genuinely already in sync" — either way there's nothing to apply). ──
  const [uid, setUid] = useState<string | null>(() => auth.currentUser?.uid ?? null);
  useEffect(() => {
    const unsub = auth.onAuthStateChanged((u) => setUid(u?.uid ?? null));
    return unsub;
  }, []);

  useEffect(() => {
    if (!uid) return;
    const ref = fdb.collection('users').doc(uid);
    let cancelled = false;

    ref.get().then((snap) => {
      if (cancelled) return;
      if (snap.exists) {
        const data = snap.data()!;
        setState((prev) => ({
          ...prev,
          drops: typeof data.drops === 'number' ? data.drops : prev.drops,
          dropsHigh: Math.max(prev.dropsHigh, prev.drops, data.dropsHigh || 0),
          disclaimerAckAt: data.disclaimerAckAt ?? prev.disclaimerAckAt
        }));
      } else {
        setState((prev) => {
          ref.set({ drops: prev.drops, dropsHigh: prev.dropsHigh, disclaimerAckAt: prev.disclaimerAckAt }, { merge: true }).catch(() => {});
          return prev;
        });
      }
    }).catch(() => {});

    const unsub = ref.onSnapshot((snap) => {
      if (!snap.exists) return;
      const data = snap.data()!;
      setState((prev) => {
        if (data.drops === prev.drops && data.dropsHigh === prev.dropsHigh && data.disclaimerAckAt === prev.disclaimerAckAt) return prev;
        return {
          ...prev,
          drops: typeof data.drops === 'number' ? data.drops : prev.drops,
          dropsHigh: Math.max(prev.dropsHigh, prev.drops, data.dropsHigh || 0),
          disclaimerAckAt: data.disclaimerAckAt ?? prev.disclaimerAckAt
        };
      });
    }, () => {});

    return () => { cancelled = true; unsub(); };
  }, [uid]);

  const pushTimer = useRef<number | null>(null);
  useEffect(() => {
    if (!uid) return;
    if (pushTimer.current) window.clearTimeout(pushTimer.current);
    pushTimer.current = window.setTimeout(() => {
      fdb.collection('users').doc(uid).set(
        { drops: state.drops, dropsHigh: state.dropsHigh, disclaimerAckAt: state.disclaimerAckAt },
        { merge: true }
      ).catch(() => {});
    }, 3500);
    return () => { if (pushTimer.current) window.clearTimeout(pushTimer.current); };
  }, [uid, state.drops, state.dropsHigh, state.disclaimerAckAt]);

  useEffect(() => {
    function flushOnHide() {
      if (document.visibilityState !== 'hidden' || !uid) return;
      fdb.collection('users').doc(uid).set(
        { drops: state.drops, dropsHigh: state.dropsHigh, disclaimerAckAt: state.disclaimerAckAt },
        { merge: true }
      ).catch(() => {});
    }
    document.addEventListener('visibilitychange', flushOnHide);
    return () => document.removeEventListener('visibilitychange', flushOnHide);
  }, [uid, state.drops, state.dropsHigh, state.disclaimerAckAt]);

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
        drops: prev.drops + (correct ? QUIZ_REWARD : 0)
      }));
      setQuizFeedback(
        (correct ? 'Exact.' : 'Off the count.') + ` True count is ${roundedCorrect}.` + (correct ? ` (+${QUIZ_REWARD} 🩸)` : '')
      );
    } else {
      const correct = rawAnswer === state.runningCount;
      setState((prev) => ({
        ...prev,
        quiz: { correct: prev.quiz.correct + (correct ? 1 : 0), total: prev.quiz.total + 1 },
        drops: prev.drops + (correct ? QUIZ_REWARD : 0)
      }));
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
    if (state.drops < state.currentBet) { setCoachMessage("You don't have enough Blood Drops for that bet."); return; }

    setState((prev) => {
      let s = maybeReshuffle(prev);
      const bet = s.currentBet;
      s = { ...s, drops: s.drops - bet };

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
        setCoachMessage(matched ? 'Bet matched the count.' : `The count suggested ~${rec * BET_STEP} 🩸 this hand.`);
        return prev;
      });
    }
    setBetTipUsedThisHand(false);
    setStrategyTipUsedKey(null);
    setBetTipResult(null);
    setStrategyTipResult(null);
    checkQuizThenResume(() => {});
  }

  // ── Strategy grading ──
  function gradeMove(cur: SubHand, action: Action, canDouble: boolean, canSplit: boolean, dealerUpRank: Rank) {
    const recommended = basicStrategyAction(cur.cards, dealerUpRank, canDouble, canSplit);
    const { total, soft } = softTotalInfo(cur.cards);
    const correct = action === recommended;
    const decision = { playerTotal: total, soft, dealerUpRank, action, recommended, correct };
    setState((prev) => ({ ...prev, strategy: { correct: prev.strategy.correct + (correct ? 1 : 0), total: prev.strategy.total + 1 } }));
    if (state.coachingEnabled) {
      setCoachMessage(correct ? 'Correct — the book agrees.' : `Book says ${recommended === 'H' ? 'Hit' : recommended === 'S' ? 'Stand' : recommended === 'D' ? 'Double' : 'Split'}.`);
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
      const bust = handTotal(cards) > 21;
      const updated: SubHand = { ...c, cards, stage: bust ? 'bust' : 'active', movesCorrect: c.movesCorrect + (decision.correct ? 1 : 0), movesTotal: c.movesTotal + 1, decisions: [...c.decisions, decision] };
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
    if (!canDoubleNow(hand, cur) || state.drops < cur.bet) return;
    const decision = gradeMove(cur, 'D', true, canSplitNow(hand, cur), hand.dealerUp!.rank);
    setState((prev) => {
      const { card, state: s } = drawCard({ ...prev, drops: prev.drops - cur.bet }, true);
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
    if (!canSplitNow(hand, cur) || state.drops < cur.bet) return;
    const decision = gradeMove(cur, 'P', canDoubleNow(hand, cur), true, hand.dealerUp!.rank);
    const isAces = cur.cards[0].rank === 'A';

    setState((prev) => {
      let s: DealerGameState = { ...prev, drops: prev.drops - cur.bet };
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
    if (state.drops < PEEK_COST) { setCoachMessage('Not enough Blood Drops to peek.'); return; }
    setState((prev) => ({ ...prev, drops: prev.drops - PEEK_COST }));
    setIsPeeking(true);
    window.setTimeout(() => setIsPeeking(false), PEEK_REVEAL_MS);
  }

  // ── Bet tip (Peek mode, count-aware) / Strategy tip (both modes) ──
  function requestBetTip() {
    if (betTipUsedThisHand || !state.hand) return;
    if (state.drops < BET_TIP_COST) { setBetTipResult('Not enough Blood Drops.'); return; }
    setState((prev) => ({ ...prev, drops: prev.drops - BET_TIP_COST }));
    setBetTipUsedThisHand(true);
    const rec = recommendedUnits(trueCountNow);
    const actualUnits = Math.round(state.currentBet / BET_STEP);
    setBetTipResult(Math.abs(actualUnits - rec) <= 1 ? 'Your bet matched the count.' : `The count suggests ~${rec * BET_STEP} 🩸 this hand.`);
  }

  function requestStrategyTip() {
    if (!state.hand) return;
    const hand = state.hand;
    const cur = hand.hands[hand.activeIndex];
    const key = `${hand.id}:${hand.activeIndex}:${cur.cards.length}`;
    if (strategyTipUsedKey === key) return;
    if (allowPeek && state.drops < STRATEGY_TIP_COST) { setStrategyTipResult('Not enough Blood Drops.'); return; }
    if (allowPeek) setState((prev) => ({ ...prev, drops: prev.drops - STRATEGY_TIP_COST }));
    setStrategyTipUsedKey(key);
    const canDouble = canDoubleNow(hand, cur);
    const canSplit = canSplitNow(hand, cur);
    if (allowPeek) {
      const result = deviationAction(cur.cards, hand.dealerUp!.rank, trueCountNow, canDouble, canSplit);
      setStrategyTipResult(
        !result.active ?
        'The book says: ' + (result.base === 'H' ? 'Hit' : result.base === 'S' ? 'Stand' : result.base === 'D' ? 'Double' : 'Split') :
        result.action === result.base ?
        'The book and the count agree.' :
        'The count disagrees with the book here.'
      );
    } else {
      const rec = basicStrategyAction(cur.cards, hand.dealerUp!.rank, canDouble, canSplit);
      setStrategyTipResult('The book says: ' + (rec === 'H' ? 'Hit' : rec === 'S' ? 'Stand' : rec === 'D' ? 'Double' : 'Split'));
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

  function ackDisclaimer() {
    setState((prev) => ({ ...prev, disclaimerAckAt: Date.now() }));
  }

  /** Credits drops (from a Store purchase, chest refund, quiz reward, etc.) and bumps
      the high-water mark if this is a new high. */
  function addDrops(amount: number) {
    setState((prev) => ({ ...prev, drops: prev.drops + amount, dropsHigh: Math.max(prev.dropsHigh, prev.drops + amount) }));
  }

  /** Attempts to spend drops; returns false (and leaves state untouched) if the balance
      is too low, so callers can show an affordability message instead of going negative. */
  function spendDrops(amount: number): boolean {
    if (state.drops < amount) return false;
    setState((prev) => ({ ...prev, drops: prev.drops - amount }));
    return true;
  }

  return {
    ...state,
    trueCount: trueCountNow,
    isPeeking,
    betEstablished,
    showBetSetup,
    setShowBetSetup,
    betTipUsedThisHand,
    betTipResult,
    strategyTipResult,
    coachMessage,
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
    ackDisclaimer,
    addDrops,
    spendDrops,
    signedIn: !!uid,
    describeOutcome
  };
}
