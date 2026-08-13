import { useEffect, useState } from 'react';
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

  useEffect(() => {
    const timer = window.setTimeout(() => setFloating(true), FLOAT_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!floating) return;
    const timer = window.setTimeout(onDone, FLOAT_DURATION_S * 1000);
    return () => window.clearTimeout(timer);
  }, [floating, onDone]);

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

        <ShardRevealCardBack back={item} have={have} need={need} previouslySeen={previouslySeen} startDelay={APPEAR_PAUSE_S} />
      </motion.div>
    </motion.div>);

}
