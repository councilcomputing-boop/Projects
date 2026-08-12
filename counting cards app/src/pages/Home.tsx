import React from 'react';
import { Link } from 'react-router-dom';
import { Panel } from '../components/Panel';
import { BloodDrop } from '../components/BloodDrop';
import { gameModes } from '../data/modes';

export function Home() {
  return (
    <div className="flex flex-col gap-4">
      <nav aria-label="Game modes" className="grid grid-cols-2 gap-3">
        {gameModes.map(({ to, label, meta, Icon }) =>
        <Link
          key={to}
          to={to}
          className="flex flex-col items-center gap-1.5 rounded-2xl bg-parch px-3 py-5 text-center shadow-panel transition-colors hover:bg-parch-light">
          
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-parch-mute text-maroon-800">
              <Icon size={20} strokeWidth={1.75} aria-hidden="true" />
            </span>
            <span className="text-sm font-bold leading-tight text-charcoal">{label}</span>
            <span className="text-[11px] leading-tight text-charcoal-soft">{meta}</span>
          </Link>
        )}
      </nav>

      <Panel ariaLabel="Blood drops" className="py-4">
        <div className="flex items-center justify-between">
          <span className="font-serif text-sm font-semibold uppercase tracking-[0.18em] text-gold-deep">Blood Drops</span>
          <span className="flex items-center gap-1.5">
            <BloodDrop className="h-4 w-4 text-blood" />
            <span className="tabular font-serif text-2xl font-semibold leading-none text-gold-deep">279,062</span>
          </span>
        </div>
        <Link
          to="/store"
          className="mt-3 block w-full rounded-xl bg-white py-3 text-center text-sm font-bold text-charcoal shadow-card transition-colors hover:bg-parch-light">
          
          Claim Daily Bonus (+250)
        </Link>
      </Panel>
    </div>);

}