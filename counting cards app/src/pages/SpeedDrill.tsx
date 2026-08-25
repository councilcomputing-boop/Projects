import { AnimatePresence, motion } from 'framer-motion';
import { CheckIcon, MinusIcon, PlusIcon, RotateCcwIcon, XIcon } from 'lucide-react';
import { ScreenHeader } from '../components/ScreenHeader';
import { PlayingCard } from '../components/PlayingCard';
import { Panel } from '../components/Panel';
import { SPEED_OPTIONS, useSpeedDrill } from '../hooks/useSpeedDrill';
import { formatCount } from '../utils/deck';

export function SpeedDrill() {
  const drill = useSpeedDrill();
  const { stage } = drill;

  return (
    <div className="flex flex-col">
      <ScreenHeader title="Speed Drill" subtitle="Beat the clock · Hi-Lo" backTo="/" />

      <Panel ariaLabel="Speed drill">
        <p className="text-center text-xs text-charcoal-soft">
          51 cards flash by one at a time — one card is secretly held back. Keep the running count in your head; you'll
          answer for it at the end.
        </p>

        <div className="mt-3 flex items-center justify-between text-xs font-semibold text-charcoal-soft">
          <span>
            Best: {drill.speedState.bestTimeMs !== null ? `${(drill.speedState.bestTimeMs / 1000).toFixed(2)}s` : '—'}
          </span>
          <span>
            {drill.speedState.history.slice(0, 6).map((h, i) =>
            <span key={i} className="tabular ml-2">
                {(h.ms / 1000).toFixed(1)}s{h.correct ? '✓' : '✗'}
              </span>
            )}
          </span>
        </div>

        {stage === 'setup' &&
        <section className="mt-6">
            <div className="grid grid-cols-3 gap-2">
              {SPEED_OPTIONS.map((option) =>
            <button
              key={option.label}
              type="button"
              onClick={() => drill.setPace(option.pace)}
              aria-pressed={drill.pace === option.pace}
              className={`rounded-xl py-3 text-xs font-bold uppercase tracking-[0.1em] transition-colors ${
              drill.pace === option.pace ?
              'bg-maroon-800 text-gold' :
              'bg-parch-mute text-charcoal-soft hover:text-charcoal'}`
              }>
                  {option.label}
                </button>
            )}
            </div>
            <button
            type="button"
            onClick={drill.start}
            className="mt-4 w-full rounded-xl bg-white py-4 text-base font-bold text-charcoal shadow-card transition-colors hover:bg-parch-light">
              Start Drill
            </button>
          </section>
        }

        {stage === 'countdown' &&
        <div className="mt-10 text-center font-serif text-6xl font-bold text-gold-deep">{drill.countdown || 'Go!'}</div>
        }

        {(stage === 'running' || stage === 'midQuiz') && drill.currentCard &&
        <>
            <p className="mt-4 text-center text-xs font-semibold text-charcoal-soft">
              Card {drill.index + 1} of {drill.deck.length}
            </p>
            <div className="mx-auto mt-2 w-full max-w-[180px]">
              <AnimatePresence mode="wait">
                <motion.div
                key={drill.currentCard.id}
                initial={{ opacity: 0, y: 14, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -14, scale: 0.97 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}>
                  <PlayingCard card={drill.currentCard} />
                </motion.div>
              </AnimatePresence>
            </div>
            {drill.pace === 'manual' && stage === 'running' &&
          <button
            type="button"
            onClick={drill.advanceManually}
            className="mt-4 w-full rounded-xl bg-white py-3 text-sm font-bold text-charcoal shadow-card">
                Tap for Next Card
              </button>
          }
            <button type="button" onClick={drill.stopDrill} className="mt-3 w-full rounded-xl bg-parch-mute py-2 text-xs font-bold text-charcoal-soft">
              Stop Drill
            </button>
          </>
        }

        {stage === 'midQuiz' &&
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/90 px-6" role="dialog" aria-label="Count so far">
            <div className="w-full max-w-xs rounded-2xl bg-parch p-5 text-center">
              {!drill.midQuizSubmitted ?
            <>
                  <p className="font-serif text-sm font-semibold uppercase tracking-[0.12em] text-gold-deep">What's the count so far?</p>
                  <div className="mt-4 flex items-center justify-center gap-6">
                    <button
                  type="button"
                  onClick={() => drill.setMidQuizAnswer(drill.midQuizAnswer - 1)}
                  aria-label="Decrease count"
                  className="flex h-12 w-12 items-center justify-center rounded-full bg-maroon-800 text-gold transition-colors hover:bg-maroon-700">
                      <MinusIcon size={18} strokeWidth={2.25} aria-hidden="true" />
                    </button>
                    <span className="tabular min-w-[4.5rem] text-center font-serif text-5xl font-semibold leading-none text-charcoal">
                      {formatCount(drill.midQuizAnswer)}
                    </span>
                    <button
                  type="button"
                  onClick={() => drill.setMidQuizAnswer(drill.midQuizAnswer + 1)}
                  aria-label="Increase count"
                  className="flex h-12 w-12 items-center justify-center rounded-full bg-maroon-800 text-gold transition-colors hover:bg-maroon-700">
                      <PlusIcon size={18} strokeWidth={2.25} aria-hidden="true" />
                    </button>
                  </div>
                  <button type="button" onClick={drill.submitMidQuizAnswer} className="mt-4 w-full rounded-xl bg-white py-3 text-sm font-bold text-charcoal shadow-card">
                    Submit
                  </button>
                </> :

            <>
                  <p className={`font-serif text-base font-semibold ${drill.midQuizCorrect ? 'text-felt' : 'text-blood-deep'}`}>
                    {drill.midQuizCorrect ? 'Correct.' : `Off — the count is ${formatCount(drill.midQuizCountSoFar)}.`}
                  </p>
                  <button type="button" onClick={drill.continueMidDrill} className="mt-4 w-full rounded-xl bg-white py-3 text-sm font-bold text-charcoal shadow-card">
                    Continue
                  </button>
                </>
            }
            </div>
          </div>
        }

        {stage === 'answer' &&
        <section aria-label="Enter your count" className="mt-6">
            <p className="text-center text-[11px] font-semibold uppercase tracking-[0.16em] text-charcoal-soft">
              Running count of the {drill.deck.length} cards you just saw ({(drill.elapsedMs / 1000).toFixed(2)}s)
            </p>
            <div className="mt-4 flex items-center justify-center gap-6">
              <button
              type="button"
              onClick={() => drill.setAnswer(drill.answer - 1)}
              aria-label="Decrease count"
              className="flex h-12 w-12 items-center justify-center rounded-full bg-maroon-800 text-gold transition-colors hover:bg-maroon-700">
                <MinusIcon size={18} strokeWidth={2.25} aria-hidden="true" />
              </button>
              <span className="tabular min-w-[4.5rem] text-center font-serif text-6xl font-semibold leading-none text-charcoal">
                {formatCount(drill.answer)}
              </span>
              <button
              type="button"
              onClick={() => drill.setAnswer(drill.answer + 1)}
              aria-label="Increase count"
              className="flex h-12 w-12 items-center justify-center rounded-full bg-maroon-800 text-gold transition-colors hover:bg-maroon-700">
                <PlusIcon size={18} strokeWidth={2.25} aria-hidden="true" />
              </button>
            </div>
            <button
            type="button"
            onClick={drill.submitAnswer}
            className="mt-6 w-full rounded-xl bg-white py-4 text-base font-bold text-charcoal shadow-card transition-colors hover:bg-parch-light">
              Submit Count
            </button>
          </section>
        }

        {stage === 'result' &&
        <section className="mt-6 flex flex-col gap-3">
            <div
            className={`flex items-center gap-3 rounded-xl px-4 py-4 ${
            drill.lastResultCorrect ? 'bg-felt/10 ring-1 ring-felt/40' : 'bg-blood-deep/10 ring-1 ring-blood-deep/30'}`
            }>
              <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white ${
              drill.lastResultCorrect ? 'bg-felt' : 'bg-blood-deep'}`
              }>
                {drill.lastResultCorrect ? <CheckIcon size={16} strokeWidth={2.5} aria-hidden="true" /> : <XIcon size={16} strokeWidth={2.5} aria-hidden="true" />}
              </span>
              <p className="flex-1 font-serif text-base font-semibold text-charcoal">
                {drill.lastResultCorrect ? 'Correct — your instincts sharpen, mortal.' : 'Off the count. Do not disappoint me again.'}
                {!drill.lastResultCorrect &&
              <span className="tabular ml-1 text-gold-deep">
                    (true {formatCount(drill.lastExpectedSum)})
                  </span>
              }
              </p>
            </div>
            <button
            type="button"
            onClick={drill.start}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-white py-4 text-base font-bold text-charcoal shadow-card transition-colors hover:bg-parch-light">
              <RotateCcwIcon size={17} strokeWidth={2} aria-hidden="true" />
              Shuffle New Shoe
            </button>
          </section>
        }
      </Panel>
    </div>);

}
