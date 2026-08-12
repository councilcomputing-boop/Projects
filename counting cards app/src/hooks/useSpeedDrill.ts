import { useEffect, useRef, useState } from 'react';
import { PlayingCardData } from '../types/blackjack';
import { buildDeck, hiLoValue, shuffle } from '../utils/deck';

const SPEED_KEY = 'cardCountingTrainerSpeedState';
const MID_DRILL_ASK_EVERY = 8;
const MID_DRILL_ASK_CHANCE = 0.3;

export type SpeedPace = 2000 | 1000 | 700 | 500 | 'manual';
export const SPEED_OPTIONS: { label: string; pace: SpeedPace }[] = [
{ label: '1 card / 2s', pace: 2000 },
{ label: '1 card / 1s', pace: 1000 },
{ label: '1 card / 0.7s', pace: 700 },
{ label: '1 card / 0.5s', pace: 500 },
{ label: 'Manual', pace: 'manual' }];

interface RunRecord {
  ms: number;
  correct: boolean;
}
interface SpeedState {
  bestTimeMs: number | null;
  history: RunRecord[];
}

function loadSpeedState(): SpeedState {
  try {
    const raw = localStorage.getItem(SPEED_KEY);
    if (!raw) return { bestTimeMs: null, history: [] };
    const parsed = JSON.parse(raw);
    return { bestTimeMs: typeof parsed.bestTimeMs === 'number' ? parsed.bestTimeMs : null, history: Array.isArray(parsed.history) ? parsed.history : [] };
  } catch {
    return { bestTimeMs: null, history: [] };
  }
}

type Stage = 'setup' | 'countdown' | 'running' | 'midQuiz' | 'answer' | 'result';

export function useSpeedDrill() {
  const [pace, setPace] = useState<SpeedPace>(1000);
  const [stage, setStage] = useState<Stage>('setup');
  const [countdown, setCountdown] = useState(3);
  const [deck, setDeck] = useState<PlayingCardData[]>([]);
  const [index, setIndex] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [answer, setAnswer] = useState(0);
  const [lastResultCorrect, setLastResultCorrect] = useState(false);
  const [lastExpectedSum, setLastExpectedSum] = useState(0);
  const [speedState, setSpeedState] = useState<SpeedState>(loadSpeedState);

  const startTimeRef = useRef(0);
  const cardsSinceAskRef = useRef(0);

  useEffect(() => {
    localStorage.setItem(SPEED_KEY, JSON.stringify(speedState));
  }, [speedState]);

  // Warn before leaving mid-drill (tab close/reload) — a resume-across-reload isn't
  // supported, matching the real app.
  useEffect(() => {
    if (stage === 'setup' || stage === 'result') return;
    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = '';
    }
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [stage]);

  function start() {
    // A single shuffled 52-card deck with exactly one card secretly removed. Since a
    // full deck's Hi-Lo values always sum to 0, the 51 remaining cards' running count
    // equals the negative of the hidden card's value — this is what makes the drill
    // genuinely test tracking a count through a fast sequence, not just memorizing.
    const full = shuffle(buildDeck());
    full.splice(Math.floor(Math.random() * full.length), 1);
    setDeck(full);
    setIndex(0);
    setAnswer(0);
    cardsSinceAskRef.current = 0;
    setCountdown(3);
    setStage('countdown');
  }

  // 3-2-1 countdown before cards start flashing.
  useEffect(() => {
    if (stage !== 'countdown') return;
    if (countdown <= 0) {
      startTimeRef.current = performance.now();
      setStage('running');
      return;
    }
    const t = window.setTimeout(() => setCountdown((c) => c - 1), 700);
    return () => window.clearTimeout(t);
  }, [stage, countdown]);

  function maybeAskMidDrill(): boolean {
    cardsSinceAskRef.current += 1;
    if (index + 1 >= deck.length) return false; // no cards left after this one
    if (cardsSinceAskRef.current >= MID_DRILL_ASK_EVERY && Math.random() < MID_DRILL_ASK_CHANCE) {
      cardsSinceAskRef.current = 0;
      setStage('midQuiz');
      return true;
    }
    return false;
  }

  function showNext() {
    if (index + 1 >= deck.length) {
      setElapsedMs(performance.now() - startTimeRef.current);
      setStage('answer');
      return;
    }
    setIndex((i) => i + 1);
  }

  // Auto-advance on timed paces; manual pace waits for a tap (advanceManually).
  useEffect(() => {
    if (stage !== 'running' || pace === 'manual') return;
    const t = window.setTimeout(() => {
      if (!maybeAskMidDrill()) showNext();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, pace);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, index, pace]);

  function advanceManually() {
    if (stage !== 'running' || pace !== 'manual') return;
    if (!maybeAskMidDrill()) showNext();
  }

  const countSoFar = deck.slice(0, index + 1).reduce((sum, c) => sum + hiLoValue(c.rank), 0);

  function continueMidDrill() {
    setStage('running');
    showNext();
  }

  function submitAnswer() {
    const shownSum = deck.reduce((sum, c) => sum + hiLoValue(c.rank), 0);
    const correct = answer === shownSum;
    setLastResultCorrect(correct);
    setLastExpectedSum(shownSum);
    setSpeedState((prev) => {
      const history = [{ ms: elapsedMs, correct }, ...prev.history].slice(0, 20);
      const bestTimeMs = correct && (prev.bestTimeMs === null || elapsedMs < prev.bestTimeMs) ? elapsedMs : prev.bestTimeMs;
      return { bestTimeMs, history };
    });
    setStage('result');
  }

  function stopDrill() {
    setStage('setup');
  }

  return {
    pace,
    setPace,
    stage,
    countdown,
    deck,
    index,
    currentCard: deck[index],
    elapsedMs,
    answer,
    setAnswer,
    lastResultCorrect,
    lastExpectedSum,
    midQuizCountSoFar: countSoFar,
    speedState,
    start,
    advanceManually,
    continueMidDrill,
    submitAnswer,
    stopDrill
  };
}
