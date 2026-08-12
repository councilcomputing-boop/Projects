import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { StoreItem, rollCardBack } from '../data/store';
import { useCardBack } from '../contexts/CardBackContext';
import { RarityReveal } from './RarityReveal';

interface ChestOpeningProps {
  chest: StoreItem;
  onClose: (duplicateRefund: number) => void;
}

/** Chest shakes, bursts, then reveals the card back it held. */
export function ChestOpening({ chest, onClose }: ChestOpeningProps) {
  const { ownedIds, unlock } = useCardBack();
  const [prize] = useState(() => rollCardBack(chest.odds ?? { common: 100, rare: 0, epic: 0, legendary: 0 }, ownedIds));
  const [duplicate] = useState(() => ownedIds.includes(prize.id));
  const [opened, setOpened] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setOpened(true), 1100);
    return () => window.clearTimeout(timer);
  }, []);

  const collect = () => {
    if (!duplicate) unlock(prize.id);
    onClose(duplicate ? Math.round(prize.cost * 0.25) : 0);
  };

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
          <motion.img
          src={chest.icon}
          alt=""
          className="h-32 w-32 rounded-2xl object-cover ring-2 ring-gold"
          animate={{ rotate: [0, -7, 7, -5, 5, 0], scale: [1, 1.04, 1, 1.06, 1] }}
          transition={{ duration: 1, ease: 'easeInOut' }} />
        
          <p className="font-serif text-lg italic text-parch/70">Unsealing {chest.name}…</p>
        </motion.div> :

      <RarityReveal back={prize} duplicate={duplicate} onCollect={collect} />
      }
    </motion.div>);

}