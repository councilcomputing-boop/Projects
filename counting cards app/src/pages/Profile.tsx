import { useState } from 'react';
import { ScreenHeader } from '../components/ScreenHeader';
import { Panel } from '../components/Panel';
import { useAuth } from '../hooks/useAuth';
import { useDealerGame } from '../hooks/useDealerGame';
import { useCardBack } from '../contexts/CardBackContext';
import { findPromoCode } from '../data/promoCodes';

export function Profile() {
  const { user, signIn, signUp, signOut, resetPassword } = useAuth();
  // Peek and Quiz Practice are separate tables now (own shoe/hand/bankroll/stats), so
  // "overall" stats here mean both, added together -- not just whichever one this page
  // happens to read first.
  const gamePeek = useDealerGame(true);
  const gameQuiz = useDealerGame(false);
  const { autoEquipNewBacks, setAutoEquip, hasRedeemed, markCodeRedeemed, buyOrEquipCardBack } = useCardBack();

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authMessage, setAuthMessage] = useState<string | null>(null);

  const [codeInput, setCodeInput] = useState('');
  const [codeMessage, setCodeMessage] = useState<string | null>(null);
  const [codeIsError, setCodeIsError] = useState(false);

  function handleRedeem() {
    if (!codeInput.trim()) return;
    const promo = findPromoCode(codeInput);
    if (!promo) { setCodeIsError(true); setCodeMessage("That code isn't valid."); return; }
    if (!promo.reusable && hasRedeemed(promo.code)) { setCodeIsError(true); setCodeMessage('Already redeemed on this device.'); return; }
    if (promo.drops) gamePeek.addDrops(promo.drops);
    if (promo.cardBackId) buyOrEquipCardBack(promo.cardBackId);
    if (!promo.reusable) markCodeRedeemed(promo.code);
    setCodeIsError(false);
    setCodeMessage(`Redeemed: ${promo.description}`);
    setCodeInput('');
  }

  const totalHands = gamePeek.stats.hands + gameQuiz.stats.hands;
  const strategyCorrect = gamePeek.strategy.correct + gameQuiz.strategy.correct;
  const strategyTotal = gamePeek.strategy.total + gameQuiz.strategy.total;
  const accuracy = strategyTotal > 0 ? Math.round(strategyCorrect / strategyTotal * 100) : 0;

  // Both games' copies of these preference fields are kept in sync by toggling both at
  // once here, so "Strategy coaching" (for example) means the same thing everywhere
  // even though each table stores its own copy.
  const settings = [
  {
    id: 'strategy',
    label: 'Strategy coaching',
    on: gamePeek.coachingEnabled,
    toggle: (v: boolean) => { gamePeek.setCoachingEnabled(v); gameQuiz.setCoachingEnabled(v); }
  },
  {
    id: 'bet',
    label: 'Bet coaching',
    on: gamePeek.betCoachingEnabled,
    toggle: (v: boolean) => { gamePeek.setBetCoachingEnabled(v); gameQuiz.setBetCoachingEnabled(v); }
  },
  {
    id: 'own-count',
    label: 'Keep my own count',
    on: gamePeek.trackOwnCount,
    toggle: (v: boolean) => { gamePeek.setTrackOwnCount(v); gameQuiz.setTrackOwnCount(v); }
  },
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

      <Panel label="Redeem Code">
        <div className="flex gap-2">
          <input
            type="text"
            value={codeInput}
            onChange={(e) => { setCodeInput(e.target.value); setCodeMessage(null); }}
            onKeyDown={(e) => { if (e.key === 'Enter') handleRedeem(); }}
            placeholder="Enter a code"
            autoCapitalize="characters"
            className="min-w-0 flex-1 rounded-xl bg-white px-4 py-3 text-sm text-charcoal shadow-card" />
          <button
            type="button"
            onClick={handleRedeem}
            className="shrink-0 rounded-xl bg-maroon-800 px-5 py-3 text-sm font-bold text-gold shadow-card transition-colors hover:bg-maroon-700">
            Redeem
          </button>
        </div>
        {codeMessage &&
        <p className={`mt-2 text-center text-xs font-semibold ${codeIsError ? 'text-blood-deep' : 'text-felt'}`}>
            {codeMessage}
          </p>
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
              {gamePeek.stats.win + gameQuiz.stats.win} / {gamePeek.stats.lose + gameQuiz.stats.lose} / {gamePeek.stats.push + gameQuiz.stats.push}
            </p>
          </div>
          <div className="rounded-xl bg-parch-mute px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-charcoal-soft">Blackjacks</p>
            <p className="tabular mt-1 font-serif text-3xl font-semibold leading-none text-charcoal">{gamePeek.stats.blackjack + gameQuiz.stats.blackjack}</p>
          </div>
          <div className="rounded-xl bg-parch-mute px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-charcoal-soft">Quiz Accuracy</p>
            <p className="tabular mt-1 font-serif text-xl font-semibold leading-none text-charcoal">
              RC {gameQuiz.quiz.total ? Math.round(gameQuiz.quiz.correct / gameQuiz.quiz.total * 100) : 0}% · TC {gameQuiz.quizTrue.total ? Math.round(gameQuiz.quizTrue.correct / gameQuiz.quizTrue.total * 100) : 0}%
            </p>
          </div>
          <div className="rounded-xl bg-parch-mute px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-charcoal-soft">Blood Drops</p>
            <p className="tabular mt-1 font-serif text-xl font-semibold leading-none text-charcoal">
              {gamePeek.drops.toLocaleString()} / {gamePeek.dropsHigh.toLocaleString()}
            </p>
          </div>
        </div>
      </Panel>

      <Panel label="Recent Hands">
        {gamePeek.handHistory.length === 0 && gameQuiz.handHistory.length === 0 ?
        <p className="text-sm text-charcoal-soft">No hands played yet.</p> :

        <ul>
            {[...gamePeek.handHistory, ...gameQuiz.handHistory].slice(0, 10).map((h, i) =>
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

      <div className="flex justify-center gap-4 pb-2">
        <a href="/terms.html" className="text-xs font-semibold text-charcoal-soft underline">Terms of Service</a>
        <a href="/privacy.html" className="text-xs font-semibold text-charcoal-soft underline">Privacy Policy</a>
      </div>
    </div>);

}
