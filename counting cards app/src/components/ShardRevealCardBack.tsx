import { motion } from 'framer-motion';
import { CardBackItem } from '../data/store';
import { CardBackImage } from './CardBackSprite';

interface ShardRevealCardBackProps {
  back: CardBackItem;
  have: number;
  need: number;
}

const SHARD_ROWS = 3;
const SHARD_COLS = 2;
const SHARD_COUNT = SHARD_ROWS * SHARD_COLS;

function shardClipPath(index: number): string {
  const row = Math.floor(index / SHARD_COLS);
  const col = index % SHARD_COLS;
  const x0 = col / SHARD_COLS * 100, x1 = (col + 1) / SHARD_COLS * 100;
  const y0 = row / SHARD_ROWS * 100, y1 = (row + 1) / SHARD_ROWS * 100;
  return `polygon(${x0}% ${y0}%, ${x1}% ${y0}%, ${x1}% ${y1}%, ${x0}% ${y1}%)`;
}

/** A stable (not re-randomized every render), spread-out entry direction per shard
    index, so each piece flies in from its own consistent direction. */
function shardOrigin(index: number) {
  const angle = index * 137.5 % 360;
  const rad = angle * Math.PI / 180;
  return { x: Math.cos(rad) * 55, y: Math.sin(rad) * 55, rotate: (index % 2 ? 1 : -1) * 30 };
}

/**
 * Unowned card backs render grayscale by default; each fragment collected turns one
 * more shard of the real art color and snaps it into place on top, like pieces
 * assembling into the finished card, instead of a flat "have/need" number.
 */
export function ShardRevealCardBack({ back, have, need }: ShardRevealCardBackProps) {
  const revealedCount = Math.min(SHARD_COUNT, Math.floor(have / need * SHARD_COUNT));

  return (
    <div className="relative aspect-[5/7] w-full overflow-hidden rounded-xl bg-ink shadow-card">
      <div className="absolute inset-0 opacity-45 grayscale">
        <CardBackImage back={back} />
      </div>
      {Array.from({ length: SHARD_COUNT }).map((_, i) => {
        const revealed = i < revealedCount;
        const origin = shardOrigin(i);
        return (
          <motion.div
            key={i}
            className="absolute inset-0"
            style={{ clipPath: shardClipPath(i) }}
            initial={false}
            animate={
            revealed ?
            { opacity: 1, x: 0, y: 0, rotate: 0 } :
            { opacity: 0, x: origin.x, y: origin.y, rotate: origin.rotate }
            }
            transition={{ type: 'spring', stiffness: 260, damping: 20 }}>

            <CardBackImage back={back} />
          </motion.div>);

      })}
    </div>);

}
