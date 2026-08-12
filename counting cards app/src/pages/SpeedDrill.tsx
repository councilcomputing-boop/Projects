import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckIcon, MinusIcon, PauseIcon, PlayIcon, PlusIcon, RotateCcwIcon, XIcon } from 'lucide-react';
import { ScreenHeader } from '../components/ScreenHeader';
import { PlayingCard } from '../components/PlayingCard';
import { Panel } from '../components/Panel';
import { SPEED_OPTIONS, useSpeedDrill } from '../hooks/useSpeedDrill';
import { formatCount } from '../utils/deck';

export function SpeedDrill() {
  const drill = useSpeedDrill();
  const { phase, currentCard } = drill;
  const showGuess = phase === 'guess' || phase === 'result';
  const progress = Math.round(drill.cardsSeen / drill.roundLength * 100);

  return (
    <div className="flex flex-col">
      <ScreenHeader title="Speed Drill" subtitle="Beat the clock · Hi-Lo" backTo="/" />

      <Panel ariaLabel="Speed drill">
        <div className="flex items-center justify-between">
          <p className="font-serif text-sm font-semibold uppercase tracking-[0.16em] text-gold-deep">
            1 deck shoe · {drill.roundLength - drill.cardsSeen} left
          </p>
          <span className="tabular rounded-full bg-parch-mute px-3 py-1 text-xs font-semibold text-charcoal">
            {progress}%
          </span>
        </div>

        <div className="mt-3 h-1 w-full rounded-full bg-parch-line" role="presentation">
          <div
            className="h-1 rounded-full bg-blood-deep transition-all duration-300"
            style={{ width: `${progress}%` }} />
          
        </div>

        <div className="mx-auto mt-6 w-full max-w-[236px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentCard.id}
              initial={{ opacity: 0, y: 14, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -14, scale: 0.97 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}>
              
              <PlayingCard card={currentCard} />
            </motion.div>
          </AnimatePresence>
        </div>

        {showGuess ?
        <section aria-label="Enter your count" className="mt-6">
            <p className="text-center text-[11px] font-semibold uppercase tracking-[0.16em] text-charcoal-soft">
              Your running count
            </p>
            <div className="mt-4 flex items-center justify-center gap-6">
              <button
              type="button"
              onClick={() => drill.setGuess(drill.guess - 1)}
              disabled={phase === 'result'}
              aria-label="Decrease count"
              className="flex h-12 w-12 items-center justify-center rounded-full bg-maroon-800 text-gold transition-colors hover:bg-maroon-700 disabled:opacity-40">
              
                <MinusIcon size={18} strokeWidth={2.25} aria-hidden="true" />
              </button>
              <span className="tabular min-w-[4.5rem] text-center font-serif text-6xl font-semibold leading-none text-charcoal">
                {formatCount(drill.guess)}
              </span>
              <button
              type="button"
              onClick={() => drill.setGuess(drill.guess + 1)}
              disabled={phase === 'result'}
              aria-label="Increase count"
              className="flex h-12 w-12 items-center justify-center rounded-full bg-maroon-800 text-gold transition-colors hover:bg-maroon-700 disabled:opacity-40">
              
                <PlusIcon size={18} strokeWidth={2.25} aria-hidden="true" />
              </button>
            </div>

            {phase === 'guess' ?
          <button
            type="button"
            onClick={drill.submitGuess}
            className="mt-6 w-full rounded-xl bg-white py-4 text-base font-bold text-charcoal shadow-card transition-colors hover:bg-parch-light">
            
                Submit Count
              </button> :

          <div className="mt-6 flex flex-col gap-3">
                <div
              className={`flex items-center gap-3 rounded-xl px-4 py-4 ${
              drill.isCorrect ? 'bg-felt/10 ring-1 ring-felt/40' : 'bg-blood-deep/10 ring-1 ring-blood-deep/30'}`
              }>
              
                  <span
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white ${
                drill.isCorrect ? 'bg-felt' : 'bg-blood-deep'}`
                }>
                
                    {drill.isCorrect ?
                <CheckIcon size={16} strokeWidth={2.5} aria-hidden="true" /> :

                <XIcon size={16} strokeWidth={2.5} aria-hidden="true" />
                }
                  </span>
                  <p className="flex-1 font-serif text-base font-semibold text-charcoal">
                    {drill.isCorrect ?
                'Correct — your instincts sharpen, mortal.' :
                'Off the count. Do not disappoint me again.'}
                    <span className="tabular ml-1 text-gold-deep">True {formatCount(drill.trueCount)}</span>
                  </p>
                </div>
                <button
              type="button"
              onClick={drill.start}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-white py-4 text-base font-bold text-charcoal shadow-card transition-colors hover:bg-parch-light">
              
                  <RotateCcwIcon size={17} strokeWidth={2} aria-hidden="true" />
                  Shuffle New Shoe
                </button>
              </div>
          }
          </section> :

        <section aria-label="Drill controls" className="mt-6">
            <div className="grid grid-cols-3 gap-2">
              {SPEED_OPTIONS.map((option) =>
            <button
              key={option.label}
              type="button"
              onClick={() => drill.setSpeedMs(option.ms)}
              aria-pressed={drill.speedMs === option.ms}
              className={`rounded-xl py-3 text-xs font-bold uppercase tracking-[0.12em] transition-colors ${
              drill.speedMs === option.ms ?
              'bg-maroon-800 text-gold' :
              'bg-parch-mute text-charcoal-soft hover:text-charcoal'}`
              }>
              
                  {option.label}
                </button>
            )}
            </div>
            <button
            type="button"
            onClick={phase === 'running' ? drill.pause : drill.cardsSeen > 1 ? drill.resume : drill.start}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-white py-4 text-base font-bold text-charcoal shadow-card transition-colors hover:bg-parch-light">
            
              {phase === 'running' ?
            <>
                  <PauseIcon size={17} strokeWidth={2} aria-hidden="true" />
                  Pause
                </> :

            <>
                  <PlayIcon size={17} strokeWidth={2} aria-hidden="true" />
                  {drill.cardsSeen > 1 ? 'Resume' : 'Deal'}
                </>
            }
            </button>
          </section>
        }
      </Panel>
    </div>);

}