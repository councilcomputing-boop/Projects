import { useEffect, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { BloodDrop } from './BloodDrop';

interface PurchaseBurstProps {
  icon: ReactNode;
  name: string;
  /** e.g. "+1,000" for a drops gain, or a plain description for a non-drops prize. */
  resultText: string;
  /** Whether resultText represents a drops amount (shows the blood-drop icon beside it). */
  isDrops?: boolean;
  onDone: () => void;
}

const DROPS = [-70, -40, -12, 14, 42, 68];

/** Celebration played over the store when a vial or chest is bought. */
export function PurchaseBurst({ icon, name, resultText, isDrops = true, onDone }: PurchaseBurstProps) {
  useEffect(() => {
    const timer = window.setTimeout(onDone, 1500);
    return () => window.clearTimeout(timer);
  }, [onDone]);

  return (
    <motion.div
      className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      aria-live="polite">

      <span className="absolute inset-0 rounded-2xl bg-maroon-900/70 backdrop-blur-[2px]" />

      <motion.div
        className="relative flex flex-col items-center gap-2"
        initial={{ scale: 0.6, y: 16 }}
        animate={{ scale: [0.6, 1.12, 1], y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}>

        <motion.div
          className="flex h-24 w-24 items-center justify-center rounded-xl bg-maroon-800 text-5xl ring-2 ring-gold"
          animate={{ rotate: [0, -6, 6, 0] }}
          transition={{ duration: 0.6, ease: 'easeInOut' }}>
          {icon}
        </motion.div>

        <p className="font-serif text-lg font-semibold text-gold-soft">{name}</p>
        <motion.p
          className="tabular flex items-center gap-1.5 font-serif text-2xl font-semibold text-gold"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: -4 }}
          transition={{ delay: 0.18, duration: 0.4 }}>
          {resultText}
          {isDrops && <BloodDrop className="h-5 w-5 text-blood" />}
        </motion.p>
      </motion.div>

      {DROPS.map((offset, i) =>
      <motion.span
        key={offset}
        className="absolute"
        initial={{ opacity: 0, x: offset, y: 30, scale: 0.5 }}
        animate={{ opacity: [0, 1, 0], y: -130 - i * 8, scale: 1 }}
        transition={{ duration: 1.1, delay: 0.1 + i * 0.06, ease: 'easeOut' }}>
          <BloodDrop className="h-4 w-4 text-blood" />
        </motion.span>
      )}
    </motion.div>);

}
