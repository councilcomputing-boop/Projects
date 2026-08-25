import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckIcon, EyeIcon, EyeOffIcon, MinusIcon, PlusIcon, LightbulbIcon, DoorOpenIcon } from 'lucide-react';
import { ScreenHeader } from '../components/ScreenHeader';
import { Panel } from '../components/Panel';
import { HandRow } from '../components/HandRow';
import { DealerSpeech } from '../components/DealerSpeech';
import { BloodDrop } from '../components/BloodDrop';
import { SkillChestReveal } from '../components/SkillChestReveal';
import { emitDropsFly } from '../components/FlyingDrops';
import { useDealerGame, BET_MIN, BET_MAX, BET_STEP, PEEK_COST, STRATEGY_TIP_COST } from '../hooks/useDealerGame';
import { handTotal } from '../utils/blackjackMath';
import { formatCount } from '../utils/deck';
import { SKILL_BAR_THRESHOLD, skillMultiplierForStreak } from '../data/store';

interface ClassicPlayProps {
  allowPeek: boolean;
}

const DECK_OPTIONS = [1, 2, 4, 6, 8];

export function ClassicPlay({ allowPeek }: ClassicPlayProps) {
  const game = useDealerGame(allowPeek);
  const [betInput, setBetInput] = useState(25);
  const [buyInInput, setBuyInInput] = useState(500);
  // Draft text for the between-hands bet field while it's focused -- keeps it decoupled
  // from game.currentBet (which snaps to the nearest BET_STEP on every change) so typing
  // a multi-digit amount doesn't get its digits reordered by a mid-type snap. null means
  // "not editing," so the field just shows game.currentBet.
  const [betDraft, setBetDraft] = useState<string | null>(null);
  const [quizAnswer, setQuizAnswer] = useState(0);
  const [reviewOpen, setReviewOpen] = useState(false);

  const hand = game.hand;
  const dealt = !!hand;
  const settled = hand?.stage === 'done';
  const cur = hand ? hand.hands[hand.activeIndex] : null;
  const dealerCards = hand ? [hand.dealerUp, hand.dealerHole, ...hand.dealerExtra].filter(Boolean) as typeof hand.dealerExtra : [];

  const bankrollRef = useRef<HTMLDivElement>(null);
  const dealerRef = useRef<HTMLDivElement>(null);

  // The bankroll badge is both endpoints -- it flies out from there when a bet is
  // placed (it visibly subtracts) and flies back into it on a win/push (it visibly
  // adds), with Dracula's portrait as the other side of the transaction. A clean loss
  // needs no second animation: the bankroll already dropped by the bet at deal time and
  // doesn't change again. Seeded to the current hand id/stage at mount so an
  // already-in-progress or already-settled hand loaded from storage doesn't replay.
  const dealtFlyRef = useRef<number | null>(hand?.id ?? null);
  useEffect(() => {
    if (!hand || dealtFlyRef.current === hand.id) return;
    dealtFlyRef.current = hand.id;
    if (bankrollRef.current && dealerRef.current) {
      emitDropsFly(bankrollRef.current.getBoundingClientRect(), dealerRef.current.getBoundingClientRect());
    }
  }, [hand?.id]);

  const settledFlyRef = useRef<number | null>(hand && hand.stage === 'done' ? hand.id : null);
  useEffect(() => {
    if (!hand || hand.stage !== 'done' || settledFlyRef.current === hand.id) return;
    settledFlyRef.current = hand.id;
    const lost = hand.hands[0].result === 'lose';
    if (!lost && dealerRef.current && bankrollRef.current) {
      emitDropsFly(dealerRef.current.getBoundingClientRect(), bankrollRef.current.getBoundingClientRect());
    }
  }, [hand?.stage, hand?.id]);

  // Real app's shortcuts: H/S/D/P for Hit/Stand/Double/Split, Space/Enter to deal a new
  // hand when idle — ignored while an input is focused or the quiz modal is open.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || game.quizOpen) return;
      const key = event.key.toLowerCase();
      if (dealt && !settled) {
        if (key === 'h') { event.preventDefault(); game.playerHit(); }
        else if (key === 's') { event.preventDefault(); game.playerStand(); }
        else if (key === 'd') { event.preventDefault(); game.playerDouble(); }
        else if (key === 'p') { event.preventDefault(); game.playerSplit(); }
      } else if (game.handIsIdle() && (event.key === ' ' || event.key === 'Enter')) {
        event.preventDefault();
        game.dealNewHand();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealt, settled, game.quizOpen]);

  const dealerTotalLabel = !dealt ?
  '—' :
  settled || hand!.holeRevealed ?
  `${handTotal(dealerCards)}` :
  `${handTotal([hand!.dealerUp!])} showing`;

  const outcomeLabel = (result: typeof cur extends null ? never : NonNullable<typeof cur>['result']) =>
  result === 'blackjack' ? 'Blackjack!' : result === 'win' ? 'You Win' : result === 'push' ? 'Push' : 'Dealer Wins';

  const bannerText = !dealt ?
  'Deal to begin' :
  settled ?
  outcomeLabel(hand!.hands[0].result) :
  'Your move';

  const bannerTone = !settled ? '' : hand!.hands[0].result === 'win' || hand!.hands[0].result === 'blackjack' ? 'good' : hand!.hands[0].result === 'push' ? 'neutral' : 'bad';

  const dealerLine =
  game.hintMessage ||
  (settled ?
  bannerTone === 'good' ? 'Your instincts sharpen, mortal.' :
  bannerTone === 'neutral' ? 'A stalemate. Neither of us feeds.' :
  'The house drinks first.' :
  dealt ?
  'Choose your move.' :
  'Set your bet. The shoe is waiting.');

  const handlePresetBet = (amount: number) => setBetInput(amount);

  return (
    <div className="flex flex-col gap-4">
      <ScreenHeader
        title={allowPeek ? 'Classic / Peek' : 'Quiz Practice'}
        subtitle={allowPeek ? 'Play hands, peek allowed' : 'Count stays hidden'}
        backTo="/"
        backLabel="Quit" />

      <Panel ariaLabel="Blackjack table" className="p-4">
        <Link
          to="/"
          className="mb-2 flex items-center justify-center gap-1.5 rounded-lg bg-blood-deep py-2 text-xs font-bold uppercase tracking-[0.1em] text-parch transition-colors hover:bg-blood-deep/80">
          <DoorOpenIcon size={14} strokeWidth={2.5} aria-hidden="true" />
          Quit Table
        </Link>

        <div className="flex items-center justify-between gap-3">
          <p className="font-serif text-xs font-semibold uppercase tracking-[0.14em] text-gold-deep">
            {game.numDecks} deck shoe · {game.shoe.length} left
          </p>
          <label>
            <span className="sr-only">Decks in shoe</span>
            <select
              value={game.numDecks}
              onChange={(event) => {
                if (!game.handIsIdle() && !window.confirm('Shuffle a new shoe mid-hand? Your current hand will be discarded.')) return;
                game.shuffleNewShoe(Number(event.target.value));
              }}
              className="rounded-lg bg-white px-2 py-1.5 text-xs font-bold text-charcoal shadow-card">
              {DECK_OPTIONS.map((count) =>
              <option key={count} value={count}>
                  {count} deck{count > 1 ? 's' : ''}
                </option>
              )}
            </select>
          </label>
        </div>

        <div ref={bankrollRef} className="mt-2 flex items-center justify-center gap-2 rounded-lg bg-maroon-700 px-3 py-1.5 text-gold-soft shadow-gold">
          <BloodDrop className="h-3.5 w-3.5 text-blood" />
          <span className="tabular font-serif text-sm font-semibold">{game.bankroll.toLocaleString()} at the table</span>
          {game.bankroll > 0 && game.handIsIdle() &&
          <button
            type="button"
            onClick={game.cashOut}
            className="ml-1 rounded-full bg-maroon-900/60 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-parch/80 hover:text-parch">
              Cash Out
            </button>
          }
        </div>

        <div className="mt-2">
          <div className="flex items-center justify-between text-[9px] font-bold uppercase tracking-[0.1em] text-gold">
            <span>Skill Chest Progress</span>
            {game.skillStreak >= 5 &&
            <span>🔥 x{skillMultiplierForStreak(game.skillStreak)}</span>
            }
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-maroon-900">
            <div
              className="h-full rounded-full bg-gold transition-[width] duration-500 ease-out"
              style={{ width: `${Math.min(100, game.skillProgress / SKILL_BAR_THRESHOLD * 100)}%` }} />
          </div>
        </div>

        <div className="mt-3 grid grid-cols-[1fr_112px] gap-3 rounded-2xl bg-felt p-3">
          <div className="flex min-w-0 flex-col gap-2">
            <HandRow title="Dealer" cards={dealerCards} total={dealerTotalLabel} hideSecond={!hand?.holeRevealed} hasHole />
            {hand?.hands.map((h, i) =>
            <HandRow
              key={i}
              title={hand.hands.length > 1 ? `Hand ${i + 1}${hand.activeIndex === i && !settled ? ' •' : ''}` : 'You'}
              cards={h.cards}
              total={dealt ? `${handTotal(h.cards)} · bet ${h.bet}` : '—'} />
            ) ?? <HandRow title="You" cards={[]} total="—" />}
            <button
              type="button"
              onClick={() => settled && setReviewOpen(true)}
              disabled={!settled}
              className={`flex h-9 items-center justify-center rounded-lg font-serif text-base font-semibold ${
              !settled ?
              'text-parch/50' :
              bannerTone === 'good' ?
              'bg-gold/30 text-gold-soft' :
              bannerTone === 'neutral' ?
              'bg-parch/20 text-parch' :
              'bg-blood-deep/30 text-parch'}`
              }>
              {bannerText}{settled ? ' — tap to review' : ''}
            </button>
          </div>

          <aside className="flex flex-col gap-2">
            <div ref={dealerRef}>
              <DealerSpeech message={dealerLine} tone={!settled ? 'neutral' : bannerTone === 'good' ? 'good' : bannerTone === 'bad' ? 'bad' : 'neutral'} />
            </div>

            {allowPeek ?
            <>
                <button
                type="button"
                onClick={game.triggerPeek}
                className="flex items-center justify-center gap-1 rounded-lg bg-gold py-2 text-[10px] font-bold uppercase tracking-[0.08em] text-maroon-900 transition-colors hover:bg-gold-deep hover:text-parch">
                  {game.isPeeking ? <EyeOffIcon size={13} strokeWidth={2.5} /> : <EyeIcon size={13} strokeWidth={2.5} />}
                  Peek ({PEEK_COST}🩸)
                </button>
                <div className="rounded-lg bg-parch/95 px-2 py-2 text-center">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-charcoal-soft">Run / True</p>
                  <p className="tabular font-serif text-lg font-semibold leading-tight text-charcoal">
                    {game.isPeeking ? `${formatCount(game.runningCount)} / ${formatCount(Number(game.trueCount.toFixed(1)))}` : '• / •'}
                  </p>
                </div>
              </> :

            <div className="rounded-lg bg-parch/95 px-2 py-2 text-center">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-charcoal-soft">Quiz score</p>
                <p className="tabular font-serif text-lg font-semibold leading-tight text-charcoal">
                  RC {game.quiz.correct}/{game.quiz.total} · TC {game.quizTrue.correct}/{game.quizTrue.total}
                </p>
              </div>
            }

            <div className="rounded-lg bg-maroon-800 px-2 py-2 text-center">
              <p className="flex items-center justify-center gap-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-parch/60">
                Bet
                <BloodDrop className="h-2.5 w-2.5 text-blood" />
              </p>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={9}
                disabled={!game.handIsIdle()}
                value={betDraft ?? String(game.currentBet)}
                onFocus={() => setBetDraft(String(game.currentBet))}
                onChange={(event) => setBetDraft(event.target.value.replace(/\D/g, ''))}
                onBlur={() => {
                  if (betDraft !== null) game.setBet(Number(betDraft) || BET_MIN);
                  setBetDraft(null);
                }}
                onKeyDown={(event) => {if (event.key === 'Enter') (event.target as HTMLInputElement).blur();}}
                aria-label="Custom bet amount"
                className="tabular mt-1 w-full rounded-lg bg-maroon-900/50 py-1 text-center font-serif text-lg font-semibold text-gold-soft disabled:opacity-60" />

              <div className="mt-1.5 flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => game.setBet(game.currentBet - BET_STEP)}
                  disabled={!game.handIsIdle() || game.currentBet <= BET_MIN}
                  aria-label="Lower bet"
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-maroon-600 text-gold disabled:opacity-40">
                  <MinusIcon size={13} strokeWidth={2.5} />
                </button>
                <button
                  type="button"
                  onClick={() => game.setBet(game.currentBet + BET_STEP)}
                  disabled={!game.handIsIdle() || game.currentBet >= BET_MAX}
                  aria-label="Raise bet"
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-maroon-600 text-gold disabled:opacity-40">
                  <PlusIcon size={13} strokeWidth={2.5} />
                </button>
              </div>
              <button
                type="button"
                onClick={() => game.setBet(game.bankroll)}
                disabled={!game.handIsIdle() || game.bankroll <= 0}
                className="mt-1.5 w-full rounded-full bg-maroon-900/60 py-1 text-[9px] font-bold uppercase tracking-[0.08em] text-parch/80 hover:text-parch disabled:opacity-40">
                All In
              </button>
            </div>
          </aside>
        </div>

        {game.trackOwnCount &&
        <div className="mt-2 flex items-center justify-between gap-2 rounded-xl bg-parch-mute px-3 py-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-charcoal-soft">Your count</span>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => game.tapOwnCount(-1)} className="flex h-7 w-7 items-center justify-center rounded-full bg-maroon-800 text-xs font-bold text-gold">−1</button>
              <button type="button" onClick={() => game.tapOwnCount(0)} className="flex h-7 w-7 items-center justify-center rounded-full bg-maroon-800 text-xs font-bold text-gold">0</button>
              <button type="button" onClick={() => game.tapOwnCount(1)} className="flex h-7 w-7 items-center justify-center rounded-full bg-maroon-800 text-xs font-bold text-gold">+1</button>
              <span className="tabular w-8 text-center font-serif text-lg font-semibold text-charcoal">{formatCount(game.myCount)}</span>
              <button type="button" onClick={game.resetOwnCount} className="text-[10px] font-semibold text-charcoal-soft underline">Reset</button>
            </div>
          </div>
        }

        <div className="mt-3 flex min-h-[112px] flex-col gap-2">
          {game.needsBuyIn ?
          <div className="rounded-xl bg-parch-mute px-3 py-3">
              <p className="text-center text-[11px] font-semibold uppercase tracking-[0.12em] text-charcoal-soft">Buy In</p>
              <p className="mt-1 text-center text-[10px] font-semibold text-charcoal-soft">
                {game.drops.toLocaleString()} 🩸 in your balance
              </p>
              <div className="mt-2 grid grid-cols-5 gap-1.5">
                {[100, 500, 1000, 5000].map((amt) =>
              <button
                key={amt}
                type="button"
                onClick={() => setBuyInInput(amt)}
                className={`rounded-lg py-2 text-xs font-bold ${buyInInput === amt ? 'bg-maroon-800 text-gold' : 'bg-white text-charcoal'}`}>
                    {amt}
                  </button>
              )}
                <button
                type="button"
                onClick={() => setBuyInInput(game.drops)}
                disabled={game.drops <= 0}
                className={`rounded-lg py-2 text-xs font-bold disabled:opacity-40 ${buyInInput === game.drops && game.drops > 0 ? 'bg-maroon-800 text-gold' : 'bg-white text-charcoal'}`}>
                  All
                </button>
              </div>
              <label className="mt-2 flex items-center justify-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-charcoal-soft">Or type an amount</span>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={9}
                  value={buyInInput === 0 ? '' : String(buyInInput)}
                  onChange={(event) => setBuyInInput(Number(event.target.value.replace(/\D/g, '')) || 0)}
                  aria-label="Custom buy-in amount"
                  className="tabular w-24 shrink-0 rounded-lg bg-white px-2 py-1.5 text-center text-sm font-bold text-charcoal shadow-card" />

              </label>
              <button
              type="button"
              onClick={() => game.buyIn(buyInInput)}
              disabled={buyInInput <= 0 || game.drops < buyInInput}
              className="mt-3 w-full rounded-xl bg-white py-3 text-sm font-bold text-charcoal shadow-card disabled:opacity-40">
                Buy In ({buyInInput.toLocaleString()} 🩸)
              </button>
            </div> :
          !game.betEstablished || game.showBetSetup ?
          <div className="rounded-xl bg-parch-mute px-3 py-3">
              <p className="text-center text-[11px] font-semibold uppercase tracking-[0.12em] text-charcoal-soft">Declare your wager</p>
              <div className="mt-2 grid grid-cols-4 gap-1.5">
                {[5, 25, 50, 100, 250, 500, 1000].map((amt) =>
              <button
                key={amt}
                type="button"
                onClick={() => handlePresetBet(amt)}
                className={`rounded-lg py-2 text-xs font-bold ${betInput === amt ? 'bg-maroon-800 text-gold' : 'bg-white text-charcoal'}`}>
                    {amt}
                  </button>
              )}
                <button
                type="button"
                onClick={() => handlePresetBet(Math.min(game.bankroll, BET_MAX))}
                disabled={game.bankroll <= 0}
                className={`rounded-lg py-2 text-xs font-bold disabled:opacity-40 ${betInput === Math.min(game.bankroll, BET_MAX) && game.bankroll > 0 ? 'bg-maroon-800 text-gold' : 'bg-white text-charcoal'}`}>
                  All In
                </button>
              </div>
              <label className="mt-2 flex items-center justify-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-charcoal-soft">Or type an amount</span>
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={9}
                  value={betInput === 0 ? '' : String(betInput)}
                  onChange={(event) => setBetInput(Number(event.target.value.replace(/\D/g, '')) || 0)}
                  aria-label="Custom bet amount"
                  className="tabular w-20 shrink-0 rounded-lg bg-white px-2 py-1.5 text-center text-sm font-bold text-charcoal shadow-card" />

              </label>
              <button
              type="button"
              onClick={() => game.confirmBetSetup(betInput)}
              className="mt-3 w-full rounded-xl bg-white py-3 text-sm font-bold text-charcoal shadow-card">
                Start Playing ({betInput} 🩸)
              </button>
            </div> :
          !dealt ?
          <button
            type="button"
            onClick={game.dealNewHand}
            className="w-full rounded-xl bg-white py-4 text-base font-bold text-charcoal shadow-card transition-colors hover:bg-parch-light">
              Deal Hand
            </button> :
          !settled ?
          <>
              <div className="grid grid-cols-4 gap-2">
                <button type="button" onClick={game.playerHit} className="rounded-xl bg-white py-4 text-sm font-bold text-charcoal shadow-card transition-colors hover:bg-parch-light">
                  Hit
                </button>
                <button type="button" onClick={game.playerStand} className="rounded-xl bg-white py-4 text-sm font-bold text-charcoal shadow-card transition-colors hover:bg-parch-light">
                  Stand
                </button>
                <button
                type="button"
                onClick={game.playerDouble}
                disabled={!game.canDoubleNow || game.bankroll < (cur?.bet ?? 0)}
                className="rounded-xl bg-white py-4 text-sm font-bold text-charcoal shadow-card transition-colors hover:bg-parch-light disabled:opacity-40">
                  Double
                </button>
                <button
                type="button"
                onClick={game.playerSplit}
                disabled={!game.canSplitNow || game.bankroll < (cur?.bet ?? 0)}
                className="rounded-xl bg-white py-4 text-sm font-bold text-charcoal shadow-card transition-colors hover:bg-parch-light disabled:opacity-40">
                  Split
                </button>
              </div>
              <button
              type="button"
              onClick={game.requestStrategyTip}
              className="flex items-center justify-center gap-1.5 rounded-lg bg-parch-mute py-2 text-xs font-bold text-charcoal transition-colors hover:bg-white">
                <LightbulbIcon size={13} strokeWidth={2.5} />
                Strategy Tip{allowPeek ? ` (${STRATEGY_TIP_COST} 🩸)` : ' (free)'}
              </button>
            </> :

          <button
            type="button"
            onClick={game.dealNewHand}
            className="w-full rounded-xl bg-white py-4 text-base font-bold text-charcoal shadow-card transition-colors hover:bg-parch-light">
              Next Hand
            </button>
          }
        </div>
      </Panel>

      {game.quizOpen &&
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/90 px-6" role="dialog" aria-label="Count quiz">
          <div className="w-full max-w-xs rounded-2xl bg-parch p-5">
            <p className="text-center font-serif text-sm font-semibold uppercase tracking-[0.12em] text-gold-deep">
              What's the {game.quizType === 'true' ? 'true' : 'running'} count?
            </p>
            {game.quizFeedback ?
          <>
                <p className="mt-3 text-center text-sm text-charcoal">{game.quizFeedback}</p>
                <button type="button" onClick={game.closeQuizModal} className="mt-4 w-full rounded-xl bg-white py-3 text-sm font-bold text-charcoal shadow-card">
                  Continue
                </button>
              </> :

          <>
                <div className="mt-3 flex items-center justify-center gap-3">
                  <button type="button" onClick={() => setQuizAnswer((v) => v - (game.quizType === 'true' ? 0.5 : 1))} className="flex h-9 w-9 items-center justify-center rounded-full bg-maroon-800 text-gold">
                    <MinusIcon size={15} strokeWidth={2.5} />
                  </button>
                  <span className="tabular min-w-[3rem] text-center font-serif text-3xl font-semibold text-charcoal">{formatCount(quizAnswer)}</span>
                  <button type="button" onClick={() => setQuizAnswer((v) => v + (game.quizType === 'true' ? 0.5 : 1))} className="flex h-9 w-9 items-center justify-center rounded-full bg-maroon-800 text-gold">
                    <PlusIcon size={15} strokeWidth={2.5} />
                  </button>
                </div>
                <button
              type="button"
              onClick={() => { game.submitQuizAnswer(quizAnswer); setQuizAnswer(0); }}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-white py-3 text-sm font-bold text-charcoal shadow-card">
                  <CheckIcon size={15} strokeWidth={2.5} />
                  Submit
                </button>
              </>
          }
          </div>
        </div>
      }

      {reviewOpen && hand &&
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/90 px-6" role="dialog" aria-label="Hand review" onClick={() => setReviewOpen(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-parch p-5" onClick={(e) => e.stopPropagation()}>
            <p className="font-serif text-sm font-semibold uppercase tracking-[0.12em] text-gold-deep">Why this hand went that way</p>
            <div className="mt-3 flex flex-col gap-2 text-sm text-charcoal">
              {hand.hands.map((h, i) =>
            <p key={i}>{h.reason ? game.describeOutcome(h.reason, hand.hands.length > 1 ? `Hand ${i + 1}` : 'You') : ''}</p>
            )}
              {hand.hands.flatMap((h) => h.decisions.filter((d) => !d.correct)).map((d, i) =>
            <p key={i} className="text-charcoal-soft">
                  {d.soft ? 'Soft ' : ''}{d.playerTotal} vs dealer {d.dealerUpRank} — you chose {d.action}, the book says {d.recommended}.
                </p>
            )}
            </div>
            <button type="button" onClick={() => setReviewOpen(false)} className="mt-4 w-full rounded-xl bg-white py-3 text-sm font-bold text-charcoal shadow-card">
              Close
            </button>
          </div>
        </div>
      }

      {game.skillChestReveal &&
      <SkillChestReveal
        tier={game.skillChestReveal.tier}
        results={game.skillChestReveal.results}
        onClose={game.closeSkillChestReveal} />

      }
    </div>);

}
