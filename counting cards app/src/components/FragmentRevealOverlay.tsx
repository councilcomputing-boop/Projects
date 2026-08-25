import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { CardBackItem } from '../data/store';
import { ShardRevealCardBack } from './ShardRevealCardBack';

interface FragmentRevealOverlayProps {
  item: CardBackItem;
  have: number;
  need: number;
  /** Fragment count before this visit -- what the card looked like before the new
      piece(s) below get added. */
  previouslySeen: number;
  /** The actual grid tile's screen position to float down into once the reveal is
      done, measured by the caller. Falls back to a small downward drop if unavailable. */
  targetRect: DOMRect | null;
  onDone: () => void;
}

const CARD_SIZE = 190;
const APPEAR_PAUSE_S = 0.5;
const FLOAT_DELAY_MS = 1700;
const FLOAT_DURATION_S = 0.6;

/**
 * Shown when landing on the Card Backs shop with fragments earned since the last
 * visit: darkens the screen, holds on the card as it already was, flies the new
 * piece(s) into place on a big centered card, then floats the whole card down into its
 * actual grid slot before handing back to the normal grid view.
 */
export function FragmentRevealOverlay({ item, have, need, previouslySeen, targetRect, onDone }: FragmentRevealOverlayProps) {
  const [floating, setFloating] = useState(false);
  // This visit's reveal completed the set -- held on screen longer with its own
  // celebration below instead of just floating away like any other fragment add.
  const justUnlocked = have >= need;
  // Keeps the float-out effect below from depending directly on onDone, which is a new
  // function reference on every parent re-render -- without this, a parent re-render
  // mid-animation would reset the timer instead of just calling the latest onDone.
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    const delay = justUnlocked ? FLOAT_DELAY_MS + 900 : FLOAT_DELAY_MS;
    const timer = window.setTimeout(() => setFloating(true), delay);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!floating) return;
    const timer = window.setTimeout(() => onDoneRef.current(), FLOAT_DURATION_S * 1000);
    return () => window.clearTimeout(timer);
  }, [floating]);

  const startCenterX = window.innerWidth / 2;
  const startCenterY = window.innerHeight / 2;
  const floatTarget = targetRect ?
  {
    x: targetRect.left + targetRect.width / 2 - startCenterX,
    y: targetRect.top + targetRect.height / 2 - startCenterY,
    scale: targetRect.width / CARD_SIZE
  } :
  { x: 0, y: 80, scale: 0.35 };

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/90 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: floating ? 0 : 1 }}
      transition={{ duration: floating ? FLOAT_DURATION_S : 0.3 }}
      role="dialog"
      aria-label={`${item.name} fragment earned`}>

      <motion.div
        className="flex flex-col items-center gap-3"
        style={{ width: CARD_SIZE }}
        initial={{ scale: 0.7, opacity: 0 }}
        animate={
        floating ?
        { x: floatTarget.x, y: floatTarget.y, scale: floatTarget.scale, opacity: 0.5 } :
        { x: 0, y: 0, scale: 1, opacity: 1 }
        }
        transition={
        floating ?
        { duration: FLOAT_DURATION_S, ease: [0.3, 0.6, 0.3, 1] } :
        { type: 'spring', stiffness: 220, damping: 20 }
        }>

        <div className="relative w-full">
          <ShardRevealCardBack back={item} have={have} need={need} previouslySeen={previouslySeen} startDelay={APPEAR_PAUSE_S} />
          {justUnlocked &&
          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-xl"
            initial={{ opacity: 0 }}
            animate={{ opacity: floating ? 0 : [0, 1, 0.7] }}
            transition={{ duration: 1.1, delay: APPEAR_PAUSE_S + 0.7 }}
            style={{ boxShadow: '0 0 6px 2px rgba(212,175,55,0.9), 0 0 40px 14px rgba(212,175,55,0.55)' }} />

          }
        </div>
        {justUnlocked && !floating &&
        <motion.p
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: APPEAR_PAUSE_S + 0.9 }}
          className="text-center font-serif text-lg font-bold uppercase tracking-[0.15em] text-gold">
            Card Complete!
          </motion.p>
        }
      </motion.div>
    </motion.div>);

}
