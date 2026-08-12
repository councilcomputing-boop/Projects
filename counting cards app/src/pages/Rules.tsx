import React from 'react';
import { ScreenHeader } from '../components/ScreenHeader';
import { Panel } from '../components/Panel';
import { OrnateDivider } from '../components/GothicMotifs';

const values = [
{ range: '2 · 3 · 4 · 5 · 6', value: '+1', note: 'Low cards leave the shoe rich' },
{ range: '7 · 8 · 9', value: '0', note: 'Neutral — ignore them' },
{ range: '10 · J · Q · K · A', value: '−1', note: 'High cards leave the shoe poor' }];


const steps = [
{ title: 'Keep the running count', body: 'Add the Hi-Lo value of every card you see as it leaves the shoe.' },
{ title: 'Divide by decks remaining', body: 'Running count ÷ decks left = true count. That is your real edge.' },
{ title: 'Bet with the count', body: 'True count +2 or higher, raise. At or below 0, bet the minimum.' },
{ title: 'Never lose the count', body: 'Reset to zero the moment a new shoe is shuffled.' }];


export function Rules() {
  return (
    <div className="flex flex-col gap-5">
      <ScreenHeader title="Rules" subtitle="Learn the Hi-Lo system" backTo="/" />

      <Panel label="Card Values">
        <ul>
          {values.map((row, i) =>
          <li key={row.range} className={`flex items-center gap-4 py-3 ${i > 0 ? 'border-t border-parch-line' : ''}`}>
              <span className="flex-1">
                <span className="block font-serif text-base font-semibold text-charcoal">{row.range}</span>
                <span className="mt-0.5 block text-xs text-charcoal-soft">{row.note}</span>
              </span>
              <span className="tabular font-serif text-2xl font-semibold text-gold-deep">{row.value}</span>
            </li>
          )}
        </ul>
      </Panel>

      <Panel label="How To Count">
        <ol className="flex flex-col gap-4">
          {steps.map((step, i) =>
          <li key={step.title} className="flex gap-3">
              <span className="tabular flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-maroon-800 font-serif text-sm font-semibold text-gold">
                {i + 1}
              </span>
              <span>
                <span className="block font-serif text-base font-semibold text-charcoal">{step.title}</span>
                <span className="mt-1 block text-sm text-charcoal-soft">{step.body}</span>
              </span>
            </li>
          )}
        </ol>
        <OrnateDivider tone="light" className="mt-5" />
        <p className="mt-4 text-center font-serif text-sm italic text-charcoal-soft">
          He never loses count. Neither should you.
        </p>
      </Panel>
    </div>);

}