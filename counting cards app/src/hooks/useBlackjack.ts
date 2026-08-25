import { useCallback, useMemo, useState } from 'react';
import { PlayingCardData } from '../types/blackjack';
import { buildDeck, hiLoValue, shuffle } from '../utils/deck';
import { handTotal, isBlackjack, trueCount } from '../utils/blackjackMath';

export type HandPhase = 'betting' | 'player' | 'settled';
export type Outcome = 'win' | 'lose' | 'push' | 'blackjack' | 'bust' | null;

function buildShoe(decks: number): PlayingCardData[] {
  const cards: PlayingCardData[] = [];
  for (let d = 0; d < decks; d += 1) {
    buildDeck().forEach((card) => cards.push({ ...card, id: `${d}-${card.id}` }));
  }
  return shuffle(cards);
}

export function useBlackjack(initialDecks = 6) {
  const [decks, setDecks] = useState(initialDecks);
  const [shoe, setShoe] = useState<PlayingCardData[]>(() => buildShoe(initialDecks));
  const [pointer, setPointer] = useState(0);
  const [player, setPlayer] = useState<PlayingCardData[]>([]);
  const [dealer, setDealer] = useState<PlayingCardData[]>([]);
  const [holeHidden, setHoleHidden] = useState(true);
  const [phase, setPhase] = useState<HandPhase>('betting');
  const [bet, setBet] = useState(100);
  const [drops, setDrops] = useState(279062);
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [seen, setSeen] = useState<PlayingCardData[]>([]);
  const [handsPlayed, setHandsPlayed] = useState(0);

  const cardsLeft = shoe.length - pointer;
  const decksLeft = Math.round(cardsLeft / 52 * 10) / 10;
  const running = useMemo(() => seen.reduce((sum, card) => sum + hiLoValue(card.rank), 0), [seen]);
  const tc = trueCount(running, decksLeft);

  const settle = useCallback(
    (playerCards: PlayingCardData[], dealerCards: PlayingCardData[], revealed: PlayingCardData[]) => {
      const pTotal = handTotal(playerCards);
      const dTotal = handTotal(dealerCards);
      let result: Outcome;
      let delta = 0;

      if (pTotal > 21) {
        result = 'bust';
        delta = -bet;
      } else if (isBlackjack(playerCards) && !isBlackjack(dealerCards)) {
        result = 'blackjack';
        delta = Math.round(bet * 1.5);
      } else if (dTotal > 21 || pTotal > dTotal) {
        result = 'win';
        delta = bet;
      } else if (pTotal === dTotal) {
        result = 'push';
      } else {
        result = 'lose';
        delta = -bet;
      }

      setHoleHidden(false);
      setDealer(dealerCards);
      setPlayer(playerCards);
      setSeen((prev) => [...prev, ...revealed]);
      setDrops((prev) => prev + delta);
      setOutcome(result);
      setPhase('settled');
      setHandsPlayed((prev) => prev + 1);
    },
    [bet]
  );

  const deal = useCallback(() => {
    let p = pointer;
    if (shoe.length - p < 15) {
      return;
    }
    const take = () => {
      const card = shoe[p];
      p += 1;
      return card;
    };
    const playerCards = [take(), take()];
    const dealerCards = [take(), take()];
    setPointer(p);
    setPlayer(playerCards);
    setDealer(dealerCards);
    setHoleHidden(true);
    setOutcome(null);

    if (isBlackjack(playerCards) || isBlackjack(dealerCards)) {
      setSeen((prev) => [...prev, playerCards[0], playerCards[1], dealerCards[0]]);
      settle(playerCards, dealerCards, [dealerCards[1]]);
      return;
    }

    setSeen((prev) => [...prev, playerCards[0], playerCards[1], dealerCards[0]]);
    setPhase('player');
  }, [pointer, shoe, settle]);

  const playDealer = useCallback(
    (playerCards: PlayingCardData[]) => {
      let p = pointer;
      const dealerCards = [...dealer];
      const revealed: PlayingCardData[] = [dealerCards[1]];
      while (handTotal(dealerCards) < 17) {
        const card = shoe[p];
        p += 1;
        dealerCards.push(card);
        revealed.push(card);
      }
      setPointer(p);
      settle(playerCards, dealerCards, revealed);
    },
    [dealer, pointer, shoe, settle]
  );

  const hit = useCallback(() => {
    const card = shoe[pointer];
    const playerCards = [...player, card];
    setPointer(pointer + 1);
    setPlayer(playerCards);
    setSeen((prev) => [...prev, card]);
    if (handTotal(playerCards) > 21) {
      settle(playerCards, dealer, [dealer[1]]);
    }
  }, [dealer, player, pointer, settle, shoe]);

  const stand = useCallback(() => playDealer(player), [playDealer, player]);

  const double = useCallback(() => {
    const card = shoe[pointer];
    const playerCards = [...player, card];
    setPointer(pointer + 1);
    setPlayer(playerCards);
    setSeen((prev) => [...prev, card]);
    setBet((prev) => prev * 2);
    if (handTotal(playerCards) > 21) {
      settle(playerCards, dealer, [dealer[1]]);
      return;
    }
    playDealer(playerCards);
  }, [dealer, playDealer, player, pointer, settle, shoe]);

  const nextHand = useCallback(() => {
    setPhase('betting');
    setPlayer([]);
    setDealer([]);
    setOutcome(null);
  }, []);

  const shuffleShoe = useCallback(
    (nextDecks = decks) => {
      setDecks(nextDecks);
      setShoe(buildShoe(nextDecks));
      setPointer(0);
      setSeen([]);
      setPlayer([]);
      setDealer([]);
      setOutcome(null);
      setPhase('betting');
    },
    [decks]
  );

  return {
    decks,
    cardsLeft,
    decksLeft,
    running,
    trueCount: tc,
    player,
    dealer,
    holeHidden,
    phase,
    bet,
    setBet,
    drops,
    outcome,
    handsPlayed,
    deal,
    hit,
    stand,
    double,
    nextHand,
    shuffleShoe
  };
}