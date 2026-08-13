import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { FilmIcon, LockIcon } from 'lucide-react';
import { ScreenHeader } from '../components/ScreenHeader';
import { Panel } from '../components/Panel';
import { BloodDrop } from '../components/BloodDrop';
import { PurchaseBurst } from '../components/PurchaseBurst';
import { ChestOpening } from '../components/ChestOpening';
import { SpinWheel } from '../components/SpinWheel';
import { vialItems, chestItems, VialItem, ChestItem } from '../data/store';
import { useDealerGame } from '../hooks/useDealerGame';
import { useAuth } from '../hooks/useAuth';
import { useCardBack } from '../contexts/CardBackContext';

const AD_REWARD = 150;
const AD_CAP = 5;
const CHEST_QUANTITY_OPTIONS = [1, 5, 10];

/** Rolls a displayed number up (or down) to its new value. */
function useCountUp(target: number) {
  const [display, setDisplay] = useState(target);
  const from = useRef(target);

  useEffect(() => {
    const start = performance.now();
    const origin = from.current;
    const delta = target - origin;
    if (delta === 0) return;

    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / 700);
      const eased = 1 - (1 - progress) ** 3;
      setDisplay(Math.round(origin + delta * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);else
      from.current = target;
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target]);

  return display;
}

function goToVialCheckout(tile: VialItem, uid: string) {
  const url = new URL(tile.stripeLink);
  url.searchParams.set('client_reference_id', uid);
  window.location.href = url.toString();
}

export function Store() {
  const { user } = useAuth();
  const game = useDealerGame(true);
  const cardBack = useCardBack();
  const navigate = useNavigate();
  const display = useCountUp(game.drops);

  const [celebratingVial, setCelebratingVial] = useState<{ name: string; amount: number } | null>(null);
  const [openingChest, setOpeningChest] = useState<{ chest: ChestItem; quantity: number } | null>(null);
  const [chestQty, setChestQty] = useState<Record<string, number>>({});
  const [wheelOpen, setWheelOpen] = useState(false);
  const [pendingVial, setPendingVial] = useState<VialItem | null>(null);
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [storeMessage, setStoreMessage] = useState<string | null>(null);
  const [adWatching, setAdWatching] = useState(false);

  const pendingSessionId = useRef<string | null>(null);

  // Return-from-Stripe: pull ?session_id= off the URL once, on first load, regardless
  // of which page Stripe redirects back to.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session_id');
    if (sessionId) {
      window.history.replaceState(null, '', window.location.pathname);
      pendingSessionId.current = sessionId;
    }
  }, []);

  useEffect(() => {
    if (!pendingSessionId.current || !user) return;
    const sessionId = pendingSessionId.current;
    pendingSessionId.current = null;
    (async () => {
      try {
        const resp = await fetch('/.netlify/functions/verify-payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, uid: user.uid })
        });
        const data = await resp.json().catch(() => null);
        if (resp.ok && data && data.success) {
          setStoreMessage(data.alreadyCredited ? 'This purchase was already credited.' : `+${data.amount} 🩸 credited — thank you!`);
          if (!data.alreadyCredited) setCelebratingVial({ name: 'Blood Vial', amount: data.amount });
        } else {
          setStoreMessage('We could not verify that payment. If you were charged, please contact support.');
        }
      } catch {
        setStoreMessage('Could not reach the payment verification server. If you were charged, please contact support.');
      }
    })();
  }, [user]);

  const handleVialClick = (item: VialItem) => {
    if (!user) { setStoreMessage('Sign in on the Profile tab to buy Blood Drops.'); return; }
    if (!game.disclaimerAckAt) { setPendingVial(item); setShowDisclaimer(true); return; }
    goToVialCheckout(item, user.uid);
  };

  const ackDisclaimer = () => {
    game.ackDisclaimer();
    setShowDisclaimer(false);
    if (pendingVial && user) { goToVialCheckout(pendingVial, user.uid); setPendingVial(null); }
  };

  const openChest = (chest: ChestItem) => {
    const quantity = chestQty[chest.id] ?? 1;
    if (!game.spendDrops(chest.dropCost * quantity)) return;
    setOpeningChest({ chest, quantity });
  };

  const watchAd = () => {
    if (adWatching || cardBack.adWatchCountToday >= AD_CAP) return;
    setAdWatching(true);
    window.setTimeout(() => {
      game.addDrops(AD_REWARD);
      cardBack.markAdWatched();
      setAdWatching(false);
    }, 3000);
  };

  const claimDaily = () => {
    if (!cardBack.dailyBonusAvailableToday) return;
    game.addDrops(cardBack.dailyBonusAmount);
    cardBack.claimDailyBonus();
  };

  return (
    <div className="flex flex-col gap-4">
      <ScreenHeader title="Store" subtitle="Blood drops, hoards & chests" backTo="/" />

      <Panel ariaLabel="Balance" className="py-4">
        <div className="flex items-center justify-center gap-3 rounded-xl bg-gold/25 py-4">
          <BloodDrop className="h-5 w-5 text-blood" />
          <motion.span
            key={game.drops}
            initial={{ scale: 1 }}
            animate={{ scale: [1, 1.08, 1] }}
            transition={{ duration: 0.45 }}
            className="tabular font-serif text-3xl font-semibold leading-none text-gold-deep">
            {display.toLocaleString()}
          </motion.span>
        </div>
        {storeMessage && <p className="mt-3 text-center text-xs font-semibold text-charcoal">{storeMessage}</p>}
        <p className="mt-3 text-sm text-charcoal-soft">
          {cardBack.dailyBonusAvailableToday ?
          `Day ${cardBack.dailyBonus.streak + 1} streak — claim +${cardBack.dailyBonusAmount} Blood Drops today.` :
          `Day ${cardBack.dailyBonus.streak} streak — come back tomorrow for more.`}
        </p>
        <button
          type="button"
          onClick={claimDaily}
          disabled={!cardBack.dailyBonusAvailableToday}
          className="mt-3 w-full rounded-xl bg-white py-3 text-sm font-bold text-charcoal shadow-card transition-colors hover:bg-parch-light disabled:opacity-50">
          {cardBack.dailyBonusAvailableToday ? `Claim Daily Bonus (+${cardBack.dailyBonusAmount})` : 'Claimed Today'}
        </button>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setWheelOpen(true)}
            disabled={!cardBack.spinAvailableToday}
            className="flex flex-col items-center gap-1 rounded-xl bg-parch-mute py-3 transition-colors hover:bg-white disabled:opacity-50">
            <motion.span
              aria-hidden="true"
              className="h-[18px] w-[18px] rounded-full border-2 border-maroon-800 border-t-blood"
              animate={{ rotate: 360 }}
              transition={{ duration: 3, repeat: Infinity, ease: 'linear' }} />
            <span className="text-xs font-bold text-charcoal">Spin Wheel</span>
            <span className="text-[11px] text-charcoal-soft">{cardBack.spinAvailableToday ? '1 free spin' : 'Come back tomorrow'}</span>
          </button>
          <button
            type="button"
            onClick={watchAd}
            disabled={adWatching || cardBack.adWatchCountToday >= AD_CAP}
            className="flex flex-col items-center gap-1 rounded-xl bg-parch-mute py-3 transition-colors hover:bg-white disabled:opacity-50">
            <FilmIcon size={18} strokeWidth={1.75} className="text-maroon-800" aria-hidden="true" />
            <span className="text-xs font-bold text-charcoal">{adWatching ? 'Watching…' : 'Watch Ad'}</span>
            <span className="text-[11px] text-charcoal-soft">+{AD_REWARD} ({AD_CAP - cardBack.adWatchCountToday} left)</span>
          </button>
        </div>
      </Panel>

      <Panel label="Blood Vials & Chests" className="relative overflow-hidden">
        <p className="text-xs leading-relaxed text-charcoal-soft">
          Entertainment only — no cash value, no cash-out. No purchase is ever necessary; every game mode is fully
          playable for free.
        </p>

        <ul className="mt-4 grid grid-cols-2 gap-2">
          {vialItems.map((item) =>
          <li key={item.id}>
              <motion.button
              type="button"
              onClick={() => handleVialClick(item)}
              whileTap={{ scale: 0.94 }}
              className="flex h-full w-full flex-col items-center gap-1.5 rounded-xl bg-parch-mute px-3 py-3 transition-colors hover:bg-white">
                <span className="flex h-14 w-14 items-center justify-center rounded-lg bg-maroon-800 text-2xl">
                  🩸
                </span>
                <span className="text-center text-sm font-bold leading-tight text-charcoal">{item.name}</span>
                <span className="flex items-center gap-1">
                  <span className="tabular font-serif text-lg font-semibold leading-none text-gold-deep">
                    +{item.drops.toLocaleString()}
                  </span>
                  <BloodDrop className="h-3.5 w-3.5 text-blood" />
                </span>
                <span className="mt-auto pt-1 text-sm font-bold text-charcoal-soft">{item.price}</span>
                {item.bonus &&
              <span className="rounded-full bg-gold/30 px-2 py-0.5 text-[10px] font-bold text-gold-deep">
                    {item.bonus}
                  </span>
              }
              </motion.button>
            </li>
          )}
        </ul>

        <ul className="mt-3 flex flex-col gap-2">
          {chestItems.map((chest) => {
            const qty = chestQty[chest.id] ?? 1;
            const cost = chest.dropCost * qty;
            const affordable = game.drops >= cost;
            const progress = Math.min(100, Math.round(game.drops / cost * 100));
            const topOdds = chest.odds.mythic > 0 ? 'mythic' : chest.odds.legendary > 0 ? 'legendary' : chest.odds.epic > 0 ? 'epic' : 'common';

            return (
              <li key={chest.id} className={`rounded-xl px-3 py-3 transition-colors ${affordable ? 'bg-parch-mute' : 'bg-parch-mute/60'}`}>
                <div className="flex items-center gap-3">
                  <span className="relative shrink-0">
                    <span className={`flex h-14 w-14 items-center justify-center rounded-lg bg-maroon-800 text-2xl ${affordable ? '' : 'opacity-50 grayscale'}`}>
                      {chest.icon}
                    </span>
                    {!affordable &&
                    <span className="absolute inset-0 flex items-center justify-center">
                        <LockIcon size={18} strokeWidth={2} className="text-charcoal" aria-hidden="true" />
                      </span>
                    }
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold text-charcoal">{chest.name}</span>
                      <span className="flex items-center gap-1">
                        <span className="tabular font-serif text-base font-semibold text-gold-deep">
                          {cost.toLocaleString()}
                        </span>
                        <BloodDrop className="h-3 w-3 text-blood" />
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-charcoal-soft">
                      {qty} fragment{qty > 1 ? 's' : ''} · {topOdds} odds
                    </p>
                    <div className="mt-2 h-1.5 w-full rounded-full bg-parch-line">
                      <div
                        className={`h-1.5 rounded-full ${affordable ? 'bg-gold' : 'bg-blood-deep/60'}`}
                        style={{ width: `${progress}%` }} />
                    </div>
                    <p className="tabular mt-1 text-[10px] font-semibold text-charcoal-soft">
                      {affordable ?
                      'Ready to open' :
                      `Collect ${(cost - game.drops).toLocaleString()} more drops to unlock`}
                    </p>
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-1.5">
                  {CHEST_QUANTITY_OPTIONS.map((n) =>
                  <button
                    key={n}
                    type="button"
                    onClick={() => setChestQty((prev) => ({ ...prev, [chest.id]: n }))}
                    className={`rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition-colors ${
                    qty === n ? 'bg-maroon-800 text-gold' : 'bg-white text-charcoal hover:bg-parch-light'}`
                    }>
                      x{n}
                    </button>
                  )}
                  <motion.button
                    type="button"
                    onClick={() => openChest(chest)}
                    disabled={!affordable}
                    whileTap={affordable ? { scale: 0.97 } : undefined}
                    className="flex-1 rounded-lg bg-white py-1.5 text-xs font-bold text-charcoal transition-colors hover:bg-parch-light disabled:opacity-50 disabled:hover:bg-white">
                    Open
                  </motion.button>
                </div>
              </li>);

          })}
        </ul>

        <AnimatePresence>
          {celebratingVial &&
          <PurchaseBurst
            icon="🩸"
            name={celebratingVial.name}
            resultText={`+${celebratingVial.amount.toLocaleString()}`}
            onDone={() => setCelebratingVial(null)} />

          }
        </AnimatePresence>
      </Panel>

      {showDisclaimer &&
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/90 px-6" role="dialog" aria-label="Before you buy">
          <div className="w-full max-w-sm rounded-2xl bg-parch p-5">
            <p className="font-serif text-base font-semibold text-charcoal">Before You Buy</p>
            <p className="mt-2 text-sm text-charcoal-soft">
              Blood Drops are a virtual currency for entertainment only — they have no cash value, cannot be redeemed
              for real money, and purchases are final. No purchase is ever necessary to enjoy CountDracula.
            </p>
            <button type="button" onClick={ackDisclaimer} className="mt-4 w-full rounded-xl bg-white py-3 text-sm font-bold text-charcoal shadow-card">
              I Understand
            </button>
            <button
            type="button"
            onClick={() => { setShowDisclaimer(false); setPendingVial(null); }}
            className="mt-2 w-full text-center text-xs font-semibold text-charcoal-soft underline">
              Cancel
            </button>
          </div>
        </div>
      }

      <AnimatePresence>
        {openingChest &&
        <ChestOpening
          chest={openingChest.chest}
          quantity={openingChest.quantity}
          onClose={(refund) => {
            if (refund > 0) game.addDrops(refund);
            setOpeningChest(null);
            // Chests always attempt a fragment -- head to the shop to watch it fill in.
            navigate('/card-backs');
          }} />

        }
        {wheelOpen &&
        <SpinWheel
          onClose={(won, wasFragment) => {
            if (won > 0) game.addDrops(won);
            cardBack.markSpinUsed();
            setWheelOpen(false);
            if (wasFragment) navigate('/card-backs');
          }} />

        }
      </AnimatePresence>
    </div>);

}
