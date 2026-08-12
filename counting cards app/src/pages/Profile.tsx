import { useState } from 'react';
import { ScreenHeader } from '../components/ScreenHeader';
import { Panel } from '../components/Panel';
import { useAuth } from '../hooks/useAuth';
import { useDealerGame } from '../hooks/useDealerGame';
import { useCardBack } from '../contexts/CardBackContext';

export function Profile() {
  const { user, signIn, signUp, signOut, resetPassword } = useAuth();
  const game = useDealerGame(true);
  const { autoEquipNewBacks, setAutoEquip } = useCardBack();

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authMessage, setAuthMessage] = useState<string | null>(null);

  const totalHands = game.stats.hands;
  const accuracy = game.strategy.total > 0 ? Math.round(game.strategy.correct / game.strategy.total * 100) : 0;

  const settings = [
  { id: 'strategy', label: 'Strategy coaching', on: game.coachingEnabled, toggle: game.setCoachingEnabled },
  { id: 'bet', label: 'Bet coaching', on: game.betCoachingEnabled, toggle: game.setBetCoachingEnabled },
  { id: 'own-count', label: 'Keep my own count', on: game.trackOwnCount, toggle: game.setTrackOwnCount },
  { id: 'auto-equip', label: 'Auto-equip new card backs', on: autoEquipNewBacks, toggle: setAutoEquip }];

  async function handleSubmit() {
    if (!email || !password) { setAuthError('Enter your email and password.'); return; }
    setBusy(true);
    setAuthError(null);
    const result = mode === 'signup' ? await signUp(email, password) : await signIn(email, password);
    setBusy(false);
    if (!result.ok) setAuthError(result.message);
  }

  async function handleReset() {
    if (!email) { setAuthError('Enter your email above first.'); return; }
    const result = await resetPassword(email);
    if (result.ok) setAuthMessage('Password reset email sent — check your inbox.');else
    setAuthError(result.message);
  }

  return (
    <div className="flex flex-col gap-4">
      <ScreenHeader title="Profile" subtitle="Account & stats" backTo="/" />

      <Panel label="Account">
        {user ?
        <>
            <p className="text-sm text-charcoal-soft">
              Signed in as <span className="font-bold text-charcoal">{user.email}</span>
            </p>
            <button
            type="button"
            onClick={() => signOut()}
            className="mt-3 w-full rounded-xl bg-parch-mute py-3 text-sm font-bold text-charcoal transition-colors hover:bg-white">
              Sign Out
            </button>
          </> :

        <>
            <div className="flex gap-2">
              <button
              type="button"
              onClick={() => { setMode('signin'); setAuthError(null); }}
              className={`flex-1 rounded-lg py-2 text-xs font-bold ${mode === 'signin' ? 'bg-maroon-800 text-gold' : 'bg-parch-mute text-charcoal'}`}>
                Sign In
              </button>
              <button
              type="button"
              onClick={() => { setMode('signup'); setAuthError(null); }}
              className={`flex-1 rounded-lg py-2 text-xs font-bold ${mode === 'signup' ? 'bg-maroon-800 text-gold' : 'bg-parch-mute text-charcoal'}`}>
                Create Account
              </button>
            </div>
            <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            autoComplete="email"
            className="mt-3 w-full rounded-xl bg-white px-4 py-3 text-sm text-charcoal shadow-card" />
            <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            className="mt-2 w-full rounded-xl bg-white px-4 py-3 text-sm text-charcoal shadow-card" />
            {authError && <p className="mt-2 text-center text-xs font-semibold text-blood-deep">{authError}</p>}
            {authMessage && <p className="mt-2 text-center text-xs font-semibold text-felt">{authMessage}</p>}
            <button
            type="button"
            onClick={handleSubmit}
            disabled={busy}
            className="mt-3 w-full rounded-xl bg-white py-3 text-sm font-bold text-charcoal shadow-card disabled:opacity-50">
              {busy ? 'Working…' : mode === 'signup' ? 'Create Account' : 'Sign In'}
            </button>
            {mode === 'signin' &&
          <button type="button" onClick={handleReset} className="mt-2 w-full text-center text-xs font-semibold text-charcoal-soft underline">
                Forgot password?
              </button>
          }
          </>
        }
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
              aria-checked={setting.on}
              aria-label={setting.label}
              onClick={() => setting.toggle(!setting.on)}
              className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
              setting.on ? 'bg-felt' : 'bg-parch-line'}`
              }>
                <span
                className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-card transition-all ${
                setting.on ? 'left-[22px]' : 'left-0.5'}`
                } />
              </button>
            </li>
          )}
        </ul>
      </Panel>

      <Panel label="Overall Stats">
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-parch-mute px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-charcoal-soft">Hands Played</p>
            <p className="tabular mt-1 font-serif text-3xl font-semibold leading-none text-charcoal">{totalHands}</p>
          </div>
          <div className="rounded-xl bg-parch-mute px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-charcoal-soft">Strategy Accuracy</p>
            <p className="tabular mt-1 font-serif text-3xl font-semibold leading-none text-charcoal">{accuracy}%</p>
          </div>
          <div className="rounded-xl bg-parch-mute px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-charcoal-soft">Win / Loss / Push</p>
            <p className="tabular mt-1 font-serif text-xl font-semibold leading-none text-charcoal">
              {game.stats.win} / {game.stats.lose} / {game.stats.push}
            </p>
          </div>
          <div className="rounded-xl bg-parch-mute px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-charcoal-soft">Blackjacks</p>
            <p className="tabular mt-1 font-serif text-3xl font-semibold leading-none text-charcoal">{game.stats.blackjack}</p>
          </div>
          <div className="rounded-xl bg-parch-mute px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-charcoal-soft">Quiz Accuracy</p>
            <p className="tabular mt-1 font-serif text-xl font-semibold leading-none text-charcoal">
              RC {game.quiz.total ? Math.round(game.quiz.correct / game.quiz.total * 100) : 0}% · TC {game.quizTrue.total ? Math.round(game.quizTrue.correct / game.quizTrue.total * 100) : 0}%
            </p>
          </div>
          <div className="rounded-xl bg-parch-mute px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-charcoal-soft">Blood Drops</p>
            <p className="tabular mt-1 font-serif text-xl font-semibold leading-none text-charcoal">
              {game.drops.toLocaleString()} / {game.dropsHigh.toLocaleString()}
            </p>
          </div>
        </div>
      </Panel>

      <Panel label="Recent Hands">
        {game.handHistory.length === 0 ?
        <p className="text-sm text-charcoal-soft">No hands played yet.</p> :

        <ul>
            {game.handHistory.slice(0, 10).map((h, i) =>
          <li key={i} className={`flex items-center gap-4 py-3 ${i > 0 ? 'border-t border-parch-line' : ''}`}>
                <span className="flex-1 font-serif text-base font-semibold capitalize text-charcoal">
                  {h.result ?? 'Unknown'}
                </span>
                <span className="tabular text-sm text-charcoal-soft">
                  {h.total > 0 ? `${h.correct}/${h.total} moves correct` : 'No decisions (natural)'}
                </span>
              </li>
          )}
          </ul>
        }
      </Panel>
    </div>);

}
