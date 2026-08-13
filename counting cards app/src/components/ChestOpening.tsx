import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ChestItem, rollFragmentTarget } from '../data/store';
import { useCardBack } from '../contexts/CardBackContext';
import { RarityReveal } from './RarityReveal';

interface ChestOpeningProps {
  chest: ChestItem;
  /** Called once the player taps Collect, with how many drops (if any) to refund. */
  onClose: (dropsRefund: number) => void;
}

/** Chest shakes, bursts, then reveals the fragment/back it awarded — matches the real
    economy: one fragment per chest, refunded at 25% of the chest's cost if it turned
    out to be a back the player already fully owns. */
export function ChestOpening({ chest, onClose }: ChestOpeningProps) {
  const { cardBacks, awardFragment } = useCardBack();
  const [target] = useState(() => rollFragmentTarget(chest.odds, cardBacks.owned, cardBacks.fragments));
  const [opened, setOpened] = useState(false);
  const [result, setResult] = useState<ReturnType<typeof awardFragment> | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setResult(awardFragment(target));
      setOpened(true);
    }, 1100);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const collect = () => {
    const refund = result?.alreadyOwned ? Math.round(chest.dropCost * 0.25) : 0;
    onClose(refund);
  };

  const resultLabel = !result ?
  '' :
  result.alreadyOwned ?
  `Already owned — refunded ${Math.round(chest.dropCost * 0.25).toLocaleString()} 🩸` :
  result.unlocked ?
  'Unlocked!' :
  `${result.have}/${result.need} fragments collected`;

  return (
    <motion.div
      className="fixed inset-0 z-40 flex items-center justify-center bg-ink/90 px-6 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="dialog"
      aria-label={`Opening ${chest.name}`}>

      {!opened ?
      <motion.div className="flex flex-col items-center gap-4">
          <motion.span
          className="flex h-32 w-32 items-center justify-center rounded-2xl bg-maroon-800 text-6xl ring-2 ring-gold"
          animate={{ rotate: [0, -7, 7, -5, 5, 0], scale: [1, 1.04, 1, 1.06, 1] }}
          transition={{ duration: 1, ease: 'easeInOut' }}>
            {chest.icon}
          </motion.span>
          <p className="font-serif text-lg italic text-parch/70">Unsealing {chest.name}…</p>
        </motion.div> :

      <RarityReveal back={target} resultLabel={resultLabel} onCollect={collect} unlocked={result ? result.unlocked || !!result.alreadyOwned : undefined} />
      }
    </motion.div>);

}
