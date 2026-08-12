import React from 'react';
import { BloodDrop } from './BloodDrop';

export const BADGE_LOGO_URL = "/44c82c18-ac72-4429-8db5-22e7dbdaf567.jpg";


export function AppHeader({ drops }: {drops: string;}) {
  return (
    <header className="flex items-center gap-3 border-b border-maroon-600/70 bg-maroon-800 px-5 py-3">
      <img
        src={BADGE_LOGO_URL}
        alt="CountDracula badge"
        className="h-11 w-11 shrink-0 rounded-full object-cover ring-1 ring-gold/60" />
      
      <div className="min-w-0 flex-1">
        <p className="font-serif text-xl leading-none tracking-wide text-gold-soft">
          Count<span className="text-gold">Dracula</span>
        </p>
        <p className="mt-1 truncate font-serif text-[11px] italic text-parch/60">He never loses count · Hi-Lo System</p>
      </div>
      <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-maroon-700 px-3 py-1.5 shadow-gold">
        <BloodDrop className="h-3.5 w-3.5 text-blood" />
        <span className="tabular font-serif text-sm font-semibold text-gold-soft">{drops}</span>
      </span>
    </header>);

}