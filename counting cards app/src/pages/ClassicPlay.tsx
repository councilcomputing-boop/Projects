import React, { useState } from 'react';
import { CheckIcon, EyeIcon, EyeOffIcon, MinusIcon, PlusIcon } from 'lucide-react';
import { ScreenHeader } from '../components/ScreenHeader';
import { Panel } from '../components/Panel';
import { HandRow } from '../components/HandRow';
import { DealerSpeech } from '../components/DealerSpeech';
import { BloodDrop } from '../components/BloodDrop';
import { useBlackjack } from '../hooks/useBlackjack';
import { betAdvice, handTotal, strategyAdvice } from '../utils/blackjackMath';
import { formatCount } from '../utils/deck';

interface ClassicPlayProps {
  allowPeek: boolean;
}

const DECK_OPTIONS = [1, 2, 6, 8];

export function ClassicPlay({ allowPeek }: ClassicPlayProps) {
  const game = useBlackjack(6);
  const [peeking, setPeeking] = useState(false);
  const [guess, setGuess] = useState(0);
  const [quizResult, setQuizResult] = useState<'correct' | 'wrong' | null>(null);
  const [score, setScore] = useState({ correct: 0, total: 0 });

  const settled = game.phase === 'settled';
  const dealt = game.dealer.length > 0;
  const quizOpen = !allowPeek && settled && quizResult === null;
  const advice = betAdvice(game.trueCount, game.bet);

  const dealerTotal = !dealt ?
  '—' :
  settled ?
  `${handTotal(game.dealer)}` :
  `${handTotal(game.dealer.slice(0, 1))} showing`;
  const playerTotal = dealt ? `${handTotal(game.player)} · bet ${game.bet}` : '—';

  const outcomeLabel =
  game.outcome === 'blackjack' ?
  'Blackjack!' :
  game.outcome === 'win' ?
  'You Win' :
  game.outcome === 'push' ?
  'Push' :
  game.outcome === 'bust' ?
  'You Bust' :
  'Dealer Wins';

  const dealerLine = settled ?
  game.outcome === 'win' || game.outcome === 'blackjack' ?
  'Your instincts sharpen, mortal.' :
  game.outcome === 'push' ?
  'A stalemate. Neither of us feeds.' :
  'The house drinks first.' :
  game.phase === 'player' ?
  `Basic strategy: ${strategyAdvice(game.player, game.dealer[0]).toUpperCase()}.` :
  allowPeek ?
  advice.text :
  'Set your bet. The shoe is waiting.';

  const checkQuiz = () => {
    const correct = guess === game.running;
    setQuizResult(correct ? 'correct' : 'wrong');
    setScore((prev) => ({ correct: prev.correct + (correct ? 1 : 0), total: prev.total + 1 }));
  };

  const nextHand = () => {
    setQuizResult(null);
    setGuess(0);
    game.nextHand();
  };

  return (
    <div className="flex flex-col gap-4">
      <ScreenHeader
        title={allowPeek ? 'Classic / Peek' : 'Quiz Practice'}
        subtitle={allowPeek ? 'Play hands, peek allowed' : 'Count stays hidden'}
        backTo="/" />
      

      <Panel ariaLabel="Blackjack table" className="p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="font-serif text-xs font-semibold uppercase tracking-[0.14em] text-gold-deep">
            {game.decks} deck shoe · {game.cardsLeft} left
          </p>
          <label>
            <span className="sr-only">Decks in shoe</span>
            <select
              value={game.decks}
              onChange={(event) => game.shuffleShoe(Number(event.target.value))}
              className="rounded-lg bg-white px-2 py-1.5 text-xs font-bold text-charcoal shadow-card">
              
              {DECK_OPTIONS.map((count) =>
              <option key={count} value={count}>
                  {count} deck{count > 1 ? 's' : ''}
                </option>
              )}
            </select>
          </label>
        </div>

        {/* Table: big hands on the left, dealer hints and controls in the rail */}
        <div className="mt-3 grid grid-cols-[1fr_112px] gap-3 rounded-2xl bg-felt p-3">
          <div className="flex min-w-0 flex-col gap-2">
            <HandRow title="Dealer" cards={game.dealer} total={dealerTotal} hideSecond={game.holeHidden} hasHole />
            <HandRow title="You" cards={game.player} total={playerTotal} />
            <p
              className={`flex h-9 items-center justify-center rounded-lg font-serif text-base font-semibold ${
              !settled ?
              'text-parch/50' :
              game.outcome === 'win' || game.outcome === 'blackjack' ?
              'bg-gold/30 text-gold-soft' :
              game.outcome === 'push' ?
              'bg-parch/20 text-parch' :
              'bg-blood-deep/30 text-parch'}`
              }>
              
              {settled ? outcomeLabel : dealt ? 'Your move' : 'Deal to begin'}
            </p>
          </div>

          <aside className="flex flex-col gap-2">
            <DealerSpeech
              message={dealerLine}
              tone={settled ? game.outcome === 'win' || game.outcome === 'blackjack' ? 'good' : 'bad' : 'neutral'} />
            

            {allowPeek ?
            <>
                <button
                type="button"
                onClick={() => setPeeking((prev) => !prev)}
                aria-pressed={peeking}
                className="flex items-center justify-center gap-1.5 rounded-lg bg-gold py-2 text-[11px] font-bold uppercase tracking-[0.1em] text-maroon-900 transition-colors hover:bg-gold-deep hover:text-parch">
                
                  {peeking ? <EyeOffIcon size={14} strokeWidth={2.5} /> : <EyeIcon size={14} strokeWidth={2.5} />}
                  Peek
                </button>
                <div className="rounded-lg bg-parch/95 px-2 py-2 text-center">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-charcoal-soft">Run / True</p>
                  <p className="tabular font-serif text-lg font-semibold leading-tight text-charcoal">
                    {peeking ? `${formatCount(game.running)} / ${formatCount(game.trueCount)}` : '• / •'}
                  </p>
                </div>
              </> :

            <div className="rounded-lg bg-parch/95 px-2 py-2 text-center">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-charcoal-soft">Quiz score</p>
                <p className="tabular font-serif text-lg font-semibold leading-tight text-charcoal">
                  {score.correct}/{score.total}
                </p>
              </div>
            }

            <div className="mt-auto rounded-lg bg-maroon-800 px-2 py-2 text-center">
              <p className="flex items-center justify-center gap-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-parch/60">
                Bet
                <BloodDrop className="h-2.5 w-2.5 text-blood" />
              </p>
              <p className="tabular font-serif text-lg font-semibold leading-tight text-gold-soft">{game.bet}</p>
              <div className="mt-1.5 flex justify-center gap-1.5">
                <button
                  type="button"
                  onClick={() => game.setBet(Math.max(25, game.bet - 25))}
                  disabled={game.phase !== 'betting'}
                  aria-label="Lower bet"
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-maroon-600 text-gold disabled:opacity-40">
                  
                  <MinusIcon size={13} strokeWidth={2.5} />
                </button>
                <button
                  type="button"
                  onClick={() => game.setBet(game.bet + 25)}
                  disabled={game.phase !== 'betting'}
                  aria-label="Raise bet"
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-maroon-600 text-gold disabled:opacity-40">
                  
                  <PlusIcon size={13} strokeWidth={2.5} />
                </button>
              </div>
            </div>
          </aside>
        </div>

        {/* Fixed-height action area so the layout never jumps between phases */}
        <div className="mt-3 flex min-h-[112px] flex-col gap-2">
          {quizOpen ?
          <div className="rounded-xl bg-parch-mute px-3 py-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-charcoal-soft">
                  Running count?
                </p>
                <div className="flex items-center gap-3">
                  <button
                  type="button"
                  onClick={() => setGuess(guess - 1)}
                  aria-label="Decrease count"
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-maroon-800 text-gold">
                  
                    <MinusIcon size={14} strokeWidth={2.5} />
                  </button>
                  <span className="tabular min-w-[2.5rem] text-center font-serif text-2xl font-semibold leading-none text-charcoal">
                    {formatCount(guess)}
                  </span>
                  <button
                  type="button"
                  onClick={() => setGuess(guess + 1)}
                  aria-label="Increase count"
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-maroon-800 text-gold">
                  
                    <PlusIcon size={14} strokeWidth={2.5} />
                  </button>
                </div>
              </div>
              <button
              type="button"
              onClick={checkQuiz}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-white py-3 text-sm font-bold text-charcoal shadow-card">
              
                <CheckIcon size={15} strokeWidth={2.5} />
                Check Count
              </button>
            </div> :
          game.phase === 'betting' ?
          <button
            type="button"
            onClick={game.deal}
            className="w-full rounded-xl bg-white py-4 text-base font-bold text-charcoal shadow-card transition-colors hover:bg-parch-light">
            
              Deal Hand
            </button> :
          game.phase === 'player' ?
          <div className="grid grid-cols-3 gap-2">
              <button
              type="button"
              onClick={game.hit}
              className="rounded-xl bg-white py-4 text-sm font-bold text-charcoal shadow-card transition-colors hover:bg-parch-light">
              
                Hit
              </button>
              <button
              type="button"
              onClick={game.stand}
              className="rounded-xl bg-white py-4 text-sm font-bold text-charcoal shadow-card transition-colors hover:bg-parch-light">
              
                Stand
              </button>
              <button
              type="button"
              onClick={game.double}
              disabled={game.player.length !== 2}
              className="rounded-xl bg-white py-4 text-sm font-bold text-charcoal shadow-card transition-colors hover:bg-parch-light disabled:opacity-40">
              
                Double
              </button>
            </div> :

          <button
            type="button"
            onClick={nextHand}
            className="w-full rounded-xl bg-white py-4 text-base font-bold text-charcoal shadow-card transition-colors hover:bg-parch-light">
            
              Next Hand
            </button>
          }

          {!allowPeek && quizResult &&
          <p
            className={`rounded-xl px-3 py-2 text-center font-serif text-sm font-semibold ${
            quizResult === 'correct' ? 'bg-felt/15 text-felt' : 'bg-blood-deep/15 text-blood-deep'}`
            }>
            
              {quizResult === 'correct' ? 'Exact count.' : 'Off the count.'} Running{' '}
              <span className="tabular">{formatCount(game.running)}</span>
            </p>
          }

          <button
            type="button"
            onClick={() => {
              setQuizResult(null);
              setGuess(0);
              game.shuffleShoe();
            }}
            className="w-full rounded-xl bg-parch-mute py-3 text-sm font-bold text-charcoal transition-colors hover:bg-white">
            
            Shuffle New Shoe
          </button>
        </div>
      </Panel>
    </div>);

}