import { motion } from 'framer-motion';
import { CardBackItem } from '../data/store';
import { CardBackImage } from './CardBackSprite';
import { PUZZLE_PIECE_COUNT, puzzlePieceClipPath } from '../utils/puzzlePiece';

interface ShardRevealCardBackProps {
  back: CardBackItem;
  have: number;
  need: number;
  /** Fragment count as of the start of this shop visit (see useCardBackStore's
      lastSeenFragments) -- shards already earned by then render in place with no
      animation; only newly-earned ones fly in, instead of the whole set replaying every
      visit regardless of what actually changed. */
  previouslySeen: number;
}

const SHARD_COUNT = PUZZLE_PIECE_COUNT;

/** A stable (not re-randomized every render), spread-out entry direction per shard
    index, so each piece flies in from its own consistent direction. */
function shardOrigin(index: number) {
  const angle = index * 137.5 % 360;
  const rad = angle * Math.PI / 180;
  return { x: Math.cos(rad) * 55, y: Math.sin(rad) * 55, rotate: (index % 2 ? 1 : -1) * 30 };
}

/**
 * Unowned card backs render grayscale by default; each fragment collected turns one
 * more shard of the real art color and flies it into place on top, like pieces of the
 * card assembling. Every time this mounts (i.e. every visit to the shop) the shards
 * you've already earned play their fly-in again, so landing on the shop after winning
 * a fragment actually shows it filling in rather than just appearing already-done.
 */
export function ShardRevealCardBack({ back, have, need, previouslySeen }: ShardRevealCardBackProps) {
  const revealedCount = Math.min(SHARD_COUNT, Math.floor(have / need * SHARD_COUNT));
  const priorRevealedCount = Math.min(SHARD_COUNT, Math.floor(previouslySeen / need * SHARD_COUNT));

  return (
    <div className="relative aspect-[5/7] w-full overflow-hidden rounded-xl bg-ink shadow-card">
      <div className="absolute inset-0 opacity-45 grayscale">
        <CardBackImage back={back} />
      </div>
      {Array.from({ length: SHARD_COUNT }).map((_, i) => {
        const revealed = i < revealedCount;
        const alreadySeen = i < priorRevealedCount;
        const settledState = { opacity: 1, x: 0, y: 0, rotate: 0 };
        const origin = shardOrigin(i);
        const hiddenState = { opacity: 0, x: origin.x, y: origin.y, rotate: origin.rotate };
        return (
          <motion.div
            key={i}
            className="absolute inset-0"
            style={{ clipPath: puzzlePieceClipPath(i) }}
            initial={alreadySeen ? settledState : hiddenState}
            animate={revealed ? settledState : hiddenState}
            transition={{
              type: 'spring',
              stiffness: 260,
              damping: 20,
              delay: revealed && !alreadySeen ? (i - priorRevealedCount) * 0.08 : 0
            }}>

            <CardBackImage back={back} />
          </motion.div>);

      })}
    </div>);

}
