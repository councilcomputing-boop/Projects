import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const AGE_GATE_KEY = 'cardCountingAgeConfirmed';
const WELCOME_KEY = 'cardCountingWelcomeSeen';

/**
 * Two sequential first-run overlays, ported from the live app: an 18+ age gate (shown
 * once ever, blocks entirely if declined — no way past, matching real behavior), then a
 * one-time welcome screen offering to create an account vs. continue as a guest. Both
 * gates are route-independent so they can appear over any page, matching how they
 * behave in the live app's tab-based version.
 */
export function EntryGates() {
  const navigate = useNavigate();
  const [ageConfirmed, setAgeConfirmed] = useState(() => localStorage.getItem(AGE_GATE_KEY) === '1');
  const [ageDeclined, setAgeDeclined] = useState(false);
  const [welcomeSeen, setWelcomeSeen] = useState(() => localStorage.getItem(WELCOME_KEY) === '1');

  if (ageDeclined) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-ink px-6" role="dialog" aria-label="Access restricted">
        <div className="max-w-sm text-center">
          <p className="font-serif text-2xl font-bold text-gold-soft">Access Restricted</p>
          <p className="mt-3 text-sm text-parch/70">
            CountDracula is intended for players 18 and older. Come back when you're of age.
          </p>
        </div>
      </div>);

  }

  if (!ageConfirmed) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-ink px-6" role="dialog" aria-label="Before you enter">
        <div className="w-full max-w-sm rounded-2xl bg-parch p-6 text-center">
          <p className="font-serif text-xl font-bold text-charcoal">Before You Enter</p>
          <p className="mt-3 text-sm text-charcoal-soft">
            CountDracula involves simulated blackjack wagering with a virtual currency. You must be 18 or older to
            continue.
          </p>
          <div className="mt-5 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => { localStorage.setItem(AGE_GATE_KEY, '1'); setAgeConfirmed(true); }}
              className="w-full rounded-xl bg-maroon-800 py-3 text-sm font-bold text-gold shadow-card">
              I am 18 or older
            </button>
            <button
              type="button"
              onClick={() => setAgeDeclined(true)}
              className="w-full rounded-xl bg-parch-mute py-3 text-sm font-bold text-charcoal-soft">
              I am under 18
            </button>
          </div>
        </div>
      </div>);

  }

  if (!welcomeSeen) {
    const dismiss = () => { localStorage.setItem(WELCOME_KEY, '1'); setWelcomeSeen(true); };
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/95 px-6" role="dialog" aria-label="Welcome">
        <div className="w-full max-w-sm rounded-2xl bg-parch p-6 text-center">
          <p className="font-serif text-xl font-bold text-charcoal">Welcome to CountDracula</p>
          <p className="mt-3 text-sm text-charcoal-soft">
            Create an account to keep your Blood Drops synced across devices, or jump right in as a guest — every
            game mode is fully playable either way.
          </p>
          <div className="mt-5 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => { dismiss(); navigate('/profile'); }}
              className="w-full rounded-xl bg-maroon-800 py-3 text-sm font-bold text-gold shadow-card">
              Create Account
            </button>
            <button type="button" onClick={dismiss} className="w-full rounded-xl bg-parch-mute py-3 text-sm font-bold text-charcoal-soft">
              Continue as Guest
            </button>
          </div>
        </div>
      </div>);

  }

  return null;
}
