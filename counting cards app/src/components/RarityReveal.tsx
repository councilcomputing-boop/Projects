import { motion } from 'framer-motion';
import { CardBackItem, RARITY_META } from '../data/store';
import { CardBackSprite, CardBackImage } from './CardBackSprite';
import { FRAGMENT_ICON_CLIP_PATH } from '../utils/puzzlePiece';

interface RarityRevealProps {
  back: CardBackItem;
  resultLabel: string;
  onCollect: () => void;
  /** false (still collecting) shows just one puzzle-piece-shaped fragment instead of
      the full card, so it reads as "a piece," not the whole back. Defaults to true
      (full card) since most callers only know this once their result resolves. */
  unlocked?: boolean;
}

/** The prize card flipping face up with rarity glow — shared by chests and the wheel. */
export function RarityReveal({ back, resultLabel, onCollect, unlocked = true }: RarityRevealProps) {
  const rarity = RARITY_META[back.rarity];

  return (
    <div className="flex flex-col items-center gap-3">
      <motion.p
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className={`rounded-full px-3 py-1 font-serif text-xs font-bold uppercase tracking-[0.2em] ${rarity.bg} ${rarity.text}`}>
        
        {rarity.label}
      </motion.p>

      <motion.div
        style={{ perspective: 800 }}
        initial={{ scale: 0.7 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 220, damping: 18 }}>
        
        <motion.div
          className="rounded-xl"
          style={{ transformStyle: 'preserve-3d' }}
          initial={{ rotateY: 180 }}
          animate={{
            rotateY: 0,
            boxShadow: [`0 0 0px ${rarity.glow}`, `0 0 38px ${rarity.glow}`, `0 0 18px ${rarity.glow}`]
          }}
          transition={{ duration: 0.7, delay: 0.15, ease: [0.2, 0.8, 0.2, 1] }}>
          
          {unlocked ?
          <CardBackSprite back={back} width={132} /> :

          <div className="relative aspect-[5/7] overflow-hidden rounded-xl bg-ink shadow-card" style={{ width: 132 }}>
              <div className="absolute inset-0" style={{ clipPath: FRAGMENT_ICON_CLIP_PATH }}>
                <CardBackImage back={back} />
              </div>
            </div>
          }
        </motion.div>
      </motion.div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
        className="font-serif text-xl font-semibold text-gold-soft">
        
        {back.name}
      </motion.p>
      <p className="text-[11px] text-parch/60">{resultLabel}</p>

      <motion.button
        type="button"
        onClick={onCollect}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.85 }}
        className="mt-1 rounded-xl bg-white px-8 py-3 text-sm font-bold text-charcoal shadow-card">
        
        Collect
      </motion.button>
    </div>);

}