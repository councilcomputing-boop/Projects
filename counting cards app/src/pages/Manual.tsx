import React, { useMemo, useState } from 'react';
import { RotateCcwIcon, UndoIcon } from 'lucide-react';
import { ScreenHeader } from '../components/ScreenHeader';
import { Panel } from '../components/Panel';
import { formatCount } from '../utils/deck';
import { trueCount } from '../utils/blackjackMath';

const DECK_OPTIONS = [1, 2, 6, 8];
const TAPS: {value: number;label: string;caption: string;}[] = [
{ value: 1, label: '+1', caption: '2 – 6' },
{ value: 0, label: '0', caption: '7 – 9' },
{ value: -1, label: '−1', caption: '10 – A' }];


export function Manual() {
  const [decks, setDecks] = useState(6);
  const [entered, setEntered] = useState<number[]>([]);

  const running = useMemo(() => entered.reduce((sum, value) => sum + value, 0), [entered]);
  const decksLeft = Math.max(0.5, Math.round((decks * 52 - entered.length) / 52 * 10) / 10);
  const tc = trueCount(running, decksLeft);

  return (
    <div className="flex flex-col gap-4">
      <ScreenHeader title="Manual" subtitle="Count a real deck" backTo="/" />

      <Panel ariaLabel="Live count">
        <div className="flex items-center justify-between gap-3">
          <p className="font-serif text-sm font-semibold uppercase tracking-[0.16em] text-gold-deep">Live Count</p>
          <label>
            <span className="sr-only">Decks in shoe</span>
            <select
              value={decks}
              onChange={(event) => {
                setDecks(Number(event.target.value));
                setEntered([]);
              }}
              className="rounded-lg bg-white px-3 py-1.5 text-sm font-bold text-charcoal shadow-card">
              
              {DECK_OPTIONS.map((count) =>
              <option key={count} value={count}>
                  {count} deck{count > 1 ? 's' : ''}
                </option>
              )}
            </select>
          </label>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-gold/25 px-4 py-4 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gold-deep">Running</p>
            <p className="tabular mt-1 font-serif text-5xl font-semibold leading-none text-charcoal">
              {formatCount(running)}
            </p>
          </div>
          <div className="rounded-xl bg-parch-mute px-4 py-4 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-charcoal-soft">True</p>
            <p className="tabular mt-1 font-serif text-5xl font-semibold leading-none text-charcoal">
              {formatCount(tc)}
            </p>
          </div>
        </div>

        <p className="mt-3 text-center text-xs text-charcoal-soft">
          <span className="tabular font-bold text-charcoal">{entered.length}</span> cards counted ·{' '}
          <span className="tabular font-bold text-charcoal">{decksLeft}</span> decks left
        </p>
      </Panel>

      <Panel label="Tap Each Card You See">
        <div className="grid grid-cols-3 gap-3">
          {TAPS.map((tap) =>
          <button
            key={tap.label}
            type="button"
            onClick={() => setEntered((prev) => [...prev, tap.value])}
            className={`flex flex-col items-center gap-1 rounded-2xl py-6 shadow-card transition-colors ${
            tap.value === 1 ?
            'bg-white text-charcoal hover:bg-gold/30' :
            tap.value === 0 ?
            'bg-parch-mute text-charcoal hover:bg-white' :
            'bg-maroon-800 text-gold-soft hover:bg-maroon-700'}`
            }>
            
              <span className="tabular font-serif text-4xl font-semibold leading-none">{tap.label}</span>
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] opacity-70">{tap.caption}</span>
            </button>
          )}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setEntered((prev) => prev.slice(0, -1))}
            disabled={entered.length === 0}
            className="flex items-center justify-center gap-2 rounded-xl bg-white py-3 text-sm font-bold text-charcoal shadow-card disabled:opacity-40">
            
            <UndoIcon size={16} strokeWidth={2} aria-hidden="true" />
            Undo
          </button>
          <button
            type="button"
            onClick={() => setEntered([])}
            className="flex items-center justify-center gap-2 rounded-xl bg-parch-mute py-3 text-sm font-bold text-charcoal transition-colors hover:bg-white">
            
            <RotateCcwIcon size={16} strokeWidth={2} aria-hidden="true" />
            Reset Shoe
          </button>
        </div>
      </Panel>
    </div>);

}