import { useState } from 'react';
import { ScreenHeader } from '../components/ScreenHeader';
import { Panel } from '../components/Panel';
import { trueCount, roundToHalf, DECKS_LEFT_OPTIONS } from '../utils/blackjackMath';
import { formatCount } from '../utils/deck';

function randomRunningCount() {
  // Matches the live app: an integer in [-12, +12]
  return Math.floor(Math.random() * 25) - 12;
}

function randomDecksLeft() {
  return DECKS_LEFT_OPTIONS[Math.floor(Math.random() * DECKS_LEFT_OPTIONS.length)];
}

function newProblem() {
  return { running: randomRunningCount(), decksLeft: randomDecksLeft() };
}

function formatTrueCount(value: number) {
  return formatCount(Number(value.toFixed(1)));
}

export function DeckMath() {
  const [decks, setDecks] = useState(6);
  const [running, setRunning] = useState(0);
  const [problem, setProblem] = useState(newProblem);
  const [answer, setAnswer] = useState('');
  const [feedback, setFeedback] = useState<'correct' | 'wrong' | null>(null);
  const [score, setScore] = useState({ correct: 0, total: 0 });

  const expected = trueCount(problem.running, problem.decksLeft);

  const check = () => {
    const value = Number(answer);
    // The real app rounds both the exact answer and the player's guess to the nearest
    // 0.5 before comparing, so a slightly-off-but-close answer still counts.
    const ok = Number.isFinite(value) && roundToHalf(value) === roundToHalf(expected);
    setFeedback(ok ? 'correct' : 'wrong');
    setScore((prev) => ({ correct: prev.correct + (ok ? 1 : 0), total: prev.total + 1 }));
  };

  const next = () => {
    setProblem(newProblem());
    setAnswer('');
    setFeedback(null);
  };

  const handleAnswerKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && answer !== '') check();
  };

  return (
    <div className="flex flex-col gap-5">
      <ScreenHeader title="Deck Math" subtitle="Running → true count" backTo="/" />

      <Panel label="Calculator">
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-charcoal-soft">
              Decks remaining
            </span>
            <select
              value={decks}
              onChange={(event) => setDecks(Number(event.target.value))}
              className="mt-2 w-full rounded-xl bg-white px-3 py-3 text-center font-serif text-lg font-semibold text-charcoal shadow-card">
              {DECKS_LEFT_OPTIONS.map((count) =>
              <option key={count} value={count}>
                  {count}
                </option>
              )}
            </select>
          </label>
          <label className="block">
            <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-charcoal-soft">
              Running count
            </span>
            <input
              type="number"
              value={running}
              onChange={(event) => setRunning(Number(event.target.value))}
              className="tabular mt-2 w-full rounded-xl bg-white px-3 py-3 text-center font-serif text-lg font-semibold text-charcoal shadow-card" />
          </label>
        </div>
        <p className="mt-3 rounded-xl bg-gold/25 py-4 text-center font-serif text-lg font-semibold uppercase tracking-wide text-gold-deep">
          {formatCount(running)} ÷ {decks} decks = {formatTrueCount(trueCount(running, decks))} true count
        </p>
      </Panel>

      <Panel label="Practice">
        <p className="text-sm text-charcoal-soft">
          You're given a running count and decks remaining — work out the true count yourself.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-parch-mute px-4 py-4 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-charcoal-soft">Running count</p>
            <p className="tabular mt-1.5 font-serif text-4xl font-semibold leading-none text-charcoal">
              {formatCount(problem.running)}
            </p>
          </div>
          <div className="rounded-xl bg-parch-mute px-4 py-4 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-charcoal-soft">Decks left</p>
            <p className="tabular mt-1.5 font-serif text-4xl font-semibold leading-none text-charcoal">
              {problem.decksLeft}
            </p>
          </div>
        </div>

        <label className="mt-4 block">
          <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-charcoal-soft">
            Your true count
          </span>
          <input
            type="number"
            step="0.5"
            value={answer}
            onChange={(event) => setAnswer(event.target.value)}
            onKeyDown={handleAnswerKeyDown}
            placeholder="e.g. -1.5"
            className="tabular mt-2 w-full rounded-xl bg-white px-4 py-3 text-center font-serif text-lg font-semibold text-charcoal shadow-card placeholder:font-sans placeholder:text-sm placeholder:font-normal placeholder:text-charcoal-soft/60" />
        </label>

        {feedback &&
        <p
          className={`mt-3 rounded-xl px-4 py-3 text-center font-serif text-base font-semibold ${
          feedback === 'correct' ? 'bg-felt/15 text-felt' : 'bg-blood-deep/15 text-blood-deep'}`
          }>
            {feedback === 'correct' ? 'Correct.' : 'Not quite.'} True count is{' '}
            <span className="tabular">{formatTrueCount(expected)}</span>
          </p>
        }

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={check}
            disabled={answer === ''}
            className="rounded-xl bg-white py-3.5 text-sm font-bold text-charcoal shadow-card disabled:opacity-40">
            Check
          </button>
          <button
            type="button"
            onClick={next}
            className="rounded-xl bg-parch-mute py-3.5 text-sm font-bold text-charcoal transition-colors hover:bg-white">
            New Problem
          </button>
        </div>
        <p className="tabular mt-3 text-center font-serif text-sm text-charcoal-soft">
          Practice score: {score.correct}/{score.total}
        </p>
      </Panel>
    </div>);

}
