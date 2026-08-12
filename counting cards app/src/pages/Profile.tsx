import { useState } from 'react';
import { ScreenHeader } from '../components/ScreenHeader';
import { Panel } from '../components/Panel';
import { recentSessions, weeklyAccuracy } from '../data/stats';

const summary = [
{ label: 'Accuracy', value: '89%' },
{ label: 'Cards / min', value: '112' },
{ label: 'Sessions', value: '46' },
{ label: 'Streak', value: '7d' }];


const settings = [
{ id: 'strategy', label: 'Strategy coaching', on: true },
{ id: 'bet', label: 'Bet coaching', on: true },
{ id: 'own-count', label: 'Keep my own count', on: false }];


export function Profile() {
  const [toggles, setToggles] = useState<Record<string, boolean>>(
    Object.fromEntries(settings.map((setting) => [setting.id, setting.on]))
  );

  return (
    <div className="flex flex-col gap-4">
      <ScreenHeader title="Profile" subtitle="Account & stats" backTo="/" />

      <Panel label="Account">
        <p className="text-sm text-charcoal-soft">
          Signed in as <span className="font-bold text-charcoal">hayesmcneill07@gmail.com</span>
        </p>
        <button
          type="button"
          className="mt-3 w-full rounded-xl bg-parch-mute py-3 text-sm font-bold text-charcoal transition-colors hover:bg-white">
          
          Sign Out
        </button>
      </Panel>

      <Panel label="Peek / Quiz Settings">
        <ul className="flex flex-col">
          {settings.map((setting, i) =>
          <li
            key={setting.id}
            className={`flex items-center justify-between gap-4 py-3 ${i > 0 ? 'border-t border-parch-line' : ''}`}>
            
              <span className="font-serif text-base font-semibold text-charcoal">{setting.label}</span>
              <button
              type="button"
              role="switch"
              aria-checked={toggles[setting.id]}
              aria-label={setting.label}
              onClick={() => setToggles((prev) => ({ ...prev, [setting.id]: !prev[setting.id] }))}
              className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
              toggles[setting.id] ? 'bg-felt' : 'bg-parch-line'}`
              }>
              
                <span
                className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-card transition-all ${
                toggles[setting.id] ? 'left-[22px]' : 'left-0.5'}`
                } />
              
              </button>
            </li>
          )}
        </ul>
      </Panel>

      <Panel label="Overall Stats">
        <div className="grid grid-cols-2 gap-2">
          {summary.map((item) =>
          <div key={item.label} className="rounded-xl bg-parch-mute px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-charcoal-soft">{item.label}</p>
              <p className="tabular mt-1 font-serif text-3xl font-semibold leading-none text-charcoal">{item.value}</p>
            </div>
          )}
        </div>
      </Panel>

      <Panel label="Accuracy By Day">
        <ul className="grid grid-cols-7 items-end gap-2" style={{ height: '124px' }}>
          {weeklyAccuracy.map((entry, i) =>
          <li key={`${entry.day}-${i}`} className="flex h-full flex-col items-center justify-end gap-2">
              <span
              className={`w-full rounded-t-md ${i === weeklyAccuracy.length - 1 ? 'bg-blood-deep' : 'bg-gold/60'}`}
              style={{ height: `${entry.value}%` }}
              aria-hidden="true" />
            
              <span className="font-serif text-xs font-semibold text-charcoal-soft">{entry.day}</span>
              <span className="sr-only">{`${entry.value}% accuracy`}</span>
            </li>
          )}
        </ul>
      </Panel>

      <Panel label="Recent Sessions">
        <ul>
          {recentSessions.map((session, i) =>
          <li key={session.id} className={`flex items-center gap-4 py-3 ${i > 0 ? 'border-t border-parch-line' : ''}`}>
              <span className="flex-1">
                <span className="block font-serif text-base font-semibold text-charcoal">{session.label}</span>
                <span className="mt-0.5 block text-xs text-charcoal-soft">{session.date}</span>
              </span>
              <span className="text-right">
                <span className="tabular block font-serif text-xl font-semibold leading-none text-charcoal">
                  {session.accuracy}%
                </span>
                <span className="tabular mt-1 block text-[11px] text-charcoal-soft">{session.cardsPerMinute} cpm</span>
              </span>
            </li>
          )}
        </ul>
      </Panel>
    </div>);

}