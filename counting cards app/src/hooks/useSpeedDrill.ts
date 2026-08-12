import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DrillPhase, PlayingCardData } from '../types/blackjack';
import { buildDeck, hiLoValue, shuffle } from '../utils/deck';

const ROUND_LENGTH = 20;

export const SPEED_OPTIONS = [
{ label: 'Slow', ms: 1600 },
{ label: 'Normal', ms: 1000 },
{ label: 'Fast', ms: 600 }];


export function useSpeedDrill() {
  const [deck, setDeck] = useState<PlayingCardData[]>(() => shuffle(buildDeck()).slice(0, ROUND_LENGTH));
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<DrillPhase>('idle');
  const [speedMs, setSpeedMs] = useState(1000);
  const [guess, setGuess] = useState(0);
  const timer = useRef<number | null>(null);

  const currentCard = deck[Math.min(index, deck.length - 1)];

  const trueCount = useMemo(
    () => deck.slice(0, Math.min(index + 1, deck.length)).reduce((sum, card) => sum + hiLoValue(card.rank), 0),
    [deck, index]
  );

  const clearTimer = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  useEffect(() => {
    if (phase !== 'running') return;
    timer.current = window.setTimeout(() => {
      setIndex((prev) => {
        if (prev + 1 >= deck.length) {
          setPhase('guess');
          return prev;
        }
        return prev + 1;
      });
    }, speedMs);
    return clearTimer;
  }, [phase, index, speedMs, deck.length, clearTimer]);

  const start = useCallback(() => {
    clearTimer();
    setDeck(shuffle(buildDeck()).slice(0, ROUND_LENGTH));
    setIndex(0);
    setGuess(0);
    setPhase('running');
  }, [clearTimer]);

  const pause = useCallback(() => {
    clearTimer();
    setPhase('idle');
  }, [clearTimer]);

  const resume = useCallback(() => setPhase('running'), []);

  const submitGuess = useCallback(() => setPhase('result'), []);

  const isCorrect = guess === trueCount;

  return {
    currentCard,
    cardsSeen: index + 1,
    roundLength: deck.length,
    phase,
    speedMs,
    setSpeedMs,
    trueCount,
    guess,
    setGuess,
    start,
    pause,
    resume,
    submitGuess,
    isCorrect
  };
}