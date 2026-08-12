import { useEffect } from 'react';
import { RotateCcwIcon } from 'lucide-react';
import { ScreenHeader } from '../components/ScreenHeader';
import { Panel } from '../components/Panel';
import { formatCount } from '../utils/deck';
import { trueCount, DECKS_LEFT_OPTIONS } from '../utils/blackjackMath';
import { useManualCount } from '../hooks/useManualCount';

const TAPS: { value: number; label: string; caption: string }[] = [
{ value: 1, label: '+1', caption: '2 – 6' },
{ value: 0, label: '0', caption: '7 – 9' },
{ value: -1, label: '−1', caption: '10 – A' }];

export function Manual() {
  const { runningCount, cardsSeen, decksLeft, tap, setDecksLeft, reset } = useManualCount();
  const tc = trueCount(runningCount, decksLeft);

  // Real app's shortcuts: Up = +1, Down = -1, Right = 0. Ignored while an input/select
  // is focused so typing in the decks-left dropdown doesn't also tap the count.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (event.key === 'ArrowUp') { event.preventDefault(); tap(1); }
      else if (event.key === 'ArrowDown') { event.preventDefault(); tap(-1); }
      else if (event.key === 'ArrowRight') { event.preventDefault(); tap(0); }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [tap]);

  return (
    <div className="flex flex-col gap-4">
      <ScreenHeader title="Manual" subtitle="Count a real deck" backTo="/" />

      <Panel ariaLabel="Live count">
        <div className="flex items-center justify-between gap-3">
          <p className="font-serif text-sm font-semibold uppercase tracking-[0.16em] text-gold-deep">Live Count</p>
          <label>
            <span className="sr-only">Decks left</span>
            <select
              value={decksLeft}
              onChange={(event) => setDecksLeft(Number(event.target.value))}
              className="rounded-lg bg-white px-3 py-1.5 text-sm font-bold text-charcoal shadow-card">
              {DECKS_LEFT_OPTIONS.map((count) =>
              <option key={count} value={count}>
                  {count} deck{count !== 1 ? 's' : ''}
                </option>
              )}
            </select>
          </label>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-gold/25 px-4 py-4 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gold-deep">Running</p>
            <p className="tabular mt-1 font-serif text-5xl font-semibold leading-none text-charcoal">
              {formatCount(runningCount)}
            </p>
          </div>
          <div className="rounded-xl bg-parch-mute px-4 py-4 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-charcoal-soft">True</p>
            <p className="tabular mt-1 font-serif text-5xl font-semibold leading-none text-charcoal">
              {formatCount(Number(tc.toFixed(1)))}
            </p>
          </div>
        </div>

        <p className="mt-3 text-center text-xs text-charcoal-soft">
          <span className="tabular font-bold text-charcoal">{cardsSeen}</span> cards counted
        </p>
      </Panel>

      <Panel label="Tap Each Card You See">
        <div className="grid grid-cols-3 gap-3">
          {TAPS.map((t) =>
          <button
            key={t.label}
            type="button"
            onClick={() => tap(t.value)}
            className={`flex flex-col items-center gap-1 rounded-2xl py-6 shadow-card transition-colors ${
            t.value === 1 ?
            'bg-white text-charcoal hover:bg-gold/30' :
            t.value === 0 ?
            'bg-parch-mute text-charcoal hover:bg-white' :
            'bg-maroon-800 text-gold-soft hover:bg-maroon-700'}`
            }>
              <span className="tabular font-serif text-4xl font-semibold leading-none">{t.label}</span>
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] opacity-70">{t.caption}</span>
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={reset}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-parch-mute py-3 text-sm font-bold text-charcoal transition-colors hover:bg-white">
          <RotateCcwIcon size={16} strokeWidth={2} aria-hidden="true" />
          Reset Count
        </button>

        <p className="mt-3 text-center text-xs text-charcoal-soft">
          Keyboard: <span className="font-bold text-charcoal">↑</span> = +1 ·{' '}
          <span className="font-bold text-charcoal">↓</span> = −1 ·{' '}
          <span className="font-bold text-charcoal">→</span> = 0
        </p>
      </Panel>
    </div>);

}
