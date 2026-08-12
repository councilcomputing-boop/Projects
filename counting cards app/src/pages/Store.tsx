import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FilmIcon, LockIcon } from 'lucide-react';
import { ScreenHeader } from '../components/ScreenHeader';
import { Panel } from '../components/Panel';
import { BloodDrop } from '../components/BloodDrop';
import { PurchaseBurst } from '../components/PurchaseBurst';
import { ChestOpening } from '../components/ChestOpening';
import { SpinWheel } from '../components/SpinWheel';
import { StoreItem, storeItems } from '../data/store';

const START_BALANCE = 279062;

/** Rolls the balance up (or down) to its new value. */
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

export function Store() {
  const [balance, setBalance] = useState(START_BALANCE);
  const [celebrating, setCelebrating] = useState<StoreItem | null>(null);
  const [openingChest, setOpeningChest] = useState<StoreItem | null>(null);
  const [wheelOpen, setWheelOpen] = useState(false);
  const display = useCountUp(balance);

  const vials = storeItems.filter((item) => item.drops !== undefined);
  const chests = storeItems.filter((item) => item.dropCost !== undefined);

  const buyVial = (item: StoreItem) => {
    setBalance((prev) => prev + (item.drops ?? 0));
    setCelebrating(item);
  };

  const openChest = (chest: StoreItem) => {
    if (balance < (chest.dropCost ?? 0)) return;
    setBalance((prev) => prev - (chest.dropCost ?? 0));
    setOpeningChest(chest);
  };

  return (
    <div className="flex flex-col gap-4">
      <ScreenHeader title="Store" subtitle="Blood drops, hoards & chests" backTo="/" />

      <Panel ariaLabel="Balance" className="py-4">
        <div className="flex items-center justify-center gap-3 rounded-xl bg-gold/25 py-4">
          <BloodDrop className="h-5 w-5 text-blood" />
          <motion.span
            key={balance}
            initial={{ scale: 1 }}
            animate={{ scale: [1, 1.08, 1] }}
            transition={{ duration: 0.45 }}
            className="tabular font-serif text-3xl font-semibold leading-none text-gold-deep">
            
            {display.toLocaleString()}
          </motion.span>
        </div>
        <p className="mt-3 text-sm text-charcoal-soft">Day 7 streak — claim +250 blood drops today.</p>
        <button
          type="button"
          onClick={() => setBalance((prev) => prev + 250)}
          className="mt-3 w-full rounded-xl bg-white py-3 text-sm font-bold text-charcoal shadow-card transition-colors hover:bg-parch-light">
          
          Claim Daily Bonus (+250)
        </button>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setWheelOpen(true)}
            className="flex flex-col items-center gap-1 rounded-xl bg-parch-mute py-3 transition-colors hover:bg-white">
            
            <motion.span
              aria-hidden="true"
              className="h-[18px] w-[18px] rounded-full border-2 border-maroon-800 border-t-blood"
              animate={{ rotate: 360 }}
              transition={{ duration: 3, repeat: Infinity, ease: 'linear' }} />
            
            <span className="text-xs font-bold text-charcoal">Spin Wheel</span>
            <span className="text-[11px] text-charcoal-soft">1 free spin · win a card</span>
          </button>
          <button
            type="button"
            onClick={() => setBalance((prev) => prev + 150)}
            className="flex flex-col items-center gap-1 rounded-xl bg-parch-mute py-3 transition-colors hover:bg-white">
            
            <FilmIcon size={18} strokeWidth={1.75} className="text-maroon-800" aria-hidden="true" />
            <span className="text-xs font-bold text-charcoal">Watch Ad</span>
            <span className="text-[11px] text-charcoal-soft">+150 (5 left)</span>
          </button>
        </div>
      </Panel>

      <Panel label="Blood Vials & Chests" className="relative overflow-hidden">
        <p className="text-xs leading-relaxed text-charcoal-soft">
          Entertainment only — no cash value, no cash-out. No purchase is ever necessary; every game mode is fully
          playable for free.
        </p>

        <ul className="mt-4 grid grid-cols-2 gap-2">
          {vials.map((item) =>
          <li key={item.id}>
              <motion.button
              type="button"
              onClick={() => buyVial(item)}
              whileTap={{ scale: 0.94 }}
              className="flex h-full w-full flex-col items-center gap-1.5 rounded-xl bg-parch-mute px-3 py-3 transition-colors hover:bg-white">
              
                <img
                src={item.icon}
                alt=""
                className="h-14 w-14 rounded-lg object-cover"
                style={{ mixBlendMode: 'multiply' }} />
              
                <span className="text-center text-sm font-bold leading-tight text-charcoal">{item.name}</span>
                <span className="flex items-center gap-1">
                  <span className="tabular font-serif text-lg font-semibold leading-none text-gold-deep">
                    +{item.drops?.toLocaleString()}
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
          {chests.map((chest) => {
            const cost = chest.dropCost ?? 0;
            const affordable = balance >= cost;
            const progress = Math.min(100, Math.round(balance / cost * 100));

            return (
              <li key={chest.id}>
                <motion.button
                  type="button"
                  onClick={() => openChest(chest)}
                  disabled={!affordable}
                  whileTap={affordable ? { scale: 0.97 } : undefined}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors ${
                  affordable ? 'bg-parch-mute hover:bg-white' : 'bg-parch-mute/60'}`
                  }>
                  
                  <span className="relative shrink-0">
                    <img
                      src={chest.icon}
                      alt=""
                      className={`h-14 w-14 rounded-lg object-cover ${affordable ? '' : 'opacity-50 grayscale'}`}
                      style={{ mixBlendMode: 'multiply' }} />
                    
                    {!affordable &&
                    <span className="absolute inset-0 flex items-center justify-center">
                        <LockIcon size={18} strokeWidth={2} className="text-charcoal" aria-hidden="true" />
                      </span>
                    }
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold text-charcoal">{chest.name}</span>
                      <span className="flex items-center gap-1">
                        <span className="tabular font-serif text-base font-semibold text-gold-deep">
                          {chest.price}
                        </span>
                        <BloodDrop className="h-3 w-3 text-blood" />
                      </span>
                    </span>
                    <span className="mt-0.5 block text-[11px] text-charcoal-soft">{chest.contents}</span>
                    <span className="mt-2 block h-1.5 w-full rounded-full bg-parch-line">
                      <span
                        className={`block h-1.5 rounded-full ${affordable ? 'bg-gold' : 'bg-blood-deep/60'}`}
                        style={{ width: `${progress}%` }} />
                      
                    </span>
                    <span className="tabular mt-1 block text-[10px] font-semibold text-charcoal-soft">
                      {affordable ?
                      'Ready to open' :
                      `Collect ${(cost - balance).toLocaleString()} more drops to unlock`}
                    </span>
                  </span>
                </motion.button>
              </li>);

          })}
        </ul>

        <AnimatePresence>
          {celebrating && <PurchaseBurst item={celebrating} onDone={() => setCelebrating(null)} />}
        </AnimatePresence>
      </Panel>

      <AnimatePresence>
        {openingChest &&
        <ChestOpening
          chest={openingChest}
          onClose={(refund) => {
            if (refund > 0) setBalance((prev) => prev + refund);
            setOpeningChest(null);
          }} />

        }
        {wheelOpen &&
        <SpinWheel
          onClose={(won) => {
            if (won > 0) setBalance((prev) => prev + won);
            setWheelOpen(false);
          }} />

        }
      </AnimatePresence>
    </div>);

}