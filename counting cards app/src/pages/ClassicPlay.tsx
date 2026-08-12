import { useEffect, useState } from 'react';
import { CheckIcon, EyeIcon, EyeOffIcon, MinusIcon, PlusIcon, LightbulbIcon } from 'lucide-react';
import { ScreenHeader } from '../components/ScreenHeader';
import { Panel } from '../components/Panel';
import { HandRow } from '../components/HandRow';
import { DealerSpeech } from '../components/DealerSpeech';
import { BloodDrop } from '../components/BloodDrop';
import { useDealerGame, BET_MIN, BET_MAX, BET_STEP, PEEK_COST, STRATEGY_TIP_COST, BET_TIP_COST } from '../hooks/useDealerGame';
import { handTotal } from '../utils/blackjackMath';
import { formatCount } from '../utils/deck';

interface ClassicPlayProps {
  allowPeek: boolean;
}

const DECK_OPTIONS = [1, 2, 4, 6, 8];

export function ClassicPlay({ allowPeek }: ClassicPlayProps) {
  const game = useDealerGame(allowPeek);
  const [betInput, setBetInput] = useState(25);
  const [quizAnswer, setQuizAnswer] = useState(0);
  const [reviewOpen, setReviewOpen] = useState(false);

  const hand = game.hand;
  const dealt = !!hand;
  const settled = hand?.stage === 'done';
  const cur = hand ? hand.hands[hand.activeIndex] : null;
  const dealerCards = hand ? [hand.dealerUp, hand.dealerHole, ...hand.dealerExtra].filter(Boolean) as typeof hand.dealerExtra : [];

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
        backTo="/" />

      <Panel ariaLabel="Blackjack table" className="p-4">
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

        <div className="mt-2 flex items-center justify-center gap-1.5 rounded-lg bg-maroon-700 px-3 py-1.5 text-gold-soft shadow-gold">
          <BloodDrop className="h-3.5 w-3.5 text-blood" />
          <span className="tabular font-serif text-sm font-semibold">{game.drops.toLocaleString()}</span>
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
            <DealerSpeech message={dealerLine} tone={!settled ? 'neutral' : bannerTone === 'good' ? 'good' : bannerTone === 'bad' ? 'bad' : 'neutral'} />

            {allowPeek ?
            <>
                <div className="grid grid-cols-2 gap-1">
                  <button
                  type="button"
                  onClick={game.triggerPeek}
                  className="flex items-center justify-center gap-1 rounded-lg bg-gold py-2 text-[10px] font-bold uppercase tracking-[0.08em] text-maroon-900 transition-colors hover:bg-gold-deep hover:text-parch">
                    {game.isPeeking ? <EyeOffIcon size={13} strokeWidth={2.5} /> : <EyeIcon size={13} strokeWidth={2.5} />}
                    Peek ({PEEK_COST}🩸)
                  </button>
                  <button
                  type="button"
                  onClick={game.requestBetTip}
                  disabled={!dealt || game.betTipUsedThisHand}
                  className="flex items-center justify-center gap-1 rounded-lg bg-parch/90 py-2 text-[10px] font-bold uppercase tracking-[0.08em] text-charcoal transition-colors hover:bg-white disabled:opacity-40">
                    <LightbulbIcon size={13} strokeWidth={2.5} />
                    Bet ({BET_TIP_COST}🩸)
                  </button>
                </div>
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
              <p className="tabular font-serif text-lg font-semibold leading-tight text-gold-soft">{game.currentBet}</p>
              <div className="mt-1.5 flex justify-center gap-1.5">
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
          {!game.betEstablished || game.showBetSetup ?
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
              </div>
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
                disabled={!game.canDoubleNow || game.drops < (cur?.bet ?? 0)}
                className="rounded-xl bg-white py-4 text-sm font-bold text-charcoal shadow-card transition-colors hover:bg-parch-light disabled:opacity-40">
                  Double
                </button>
                <button
                type="button"
                onClick={game.playerSplit}
                disabled={!game.canSplitNow || game.drops < (cur?.bet ?? 0)}
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
    </div>);

}
