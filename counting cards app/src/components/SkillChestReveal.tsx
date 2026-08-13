import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { RARITY_META, type Rarity } from '../data/store';
import { CardBackSprite, CardBackImage } from './CardBackSprite';
import { fragmentIconClipPath } from '../utils/puzzlePiece';
import type { AwardResult } from '../hooks/useCardBackStore';

interface SkillChestRevealProps {
  tier: Rarity;
  results: AwardResult[];
  onClose: () => void;
}

function resultLabel(result: AwardResult): string {
  if (result.alreadyOwned) return 'Already owned';
  if (result.unlocked) return 'Unlocked!';
  return `${result.have}/${result.need}`;
}

/** Auto-opened when the skill progress bar fills (earned by playing well, not bought) —
    shows the rolled chest tier shaking/glowing, then reveals every fragment it awarded
    in one grid, since a skill chest can give more than the usual single fragment. */
export function SkillChestReveal({ tier, results, onClose }: SkillChestRevealProps) {
  const rarity = RARITY_META[tier];
  const [opened, setOpened] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setOpened(true), 1100);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <motion.div
      className="fixed inset-0 z-40 flex items-center justify-center bg-ink/90 px-6 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="dialog"
      aria-label="Skill chest earned">

      {!opened ?
      <motion.div className="flex flex-col items-center gap-4">
          <motion.span
          className={`flex h-32 w-32 items-center justify-center rounded-2xl bg-maroon-800 text-6xl ring-2 ${rarity.ring}`}
          style={{ boxShadow: `0 0 30px ${rarity.glow}` }}
          animate={{ rotate: [0, -7, 7, -5, 5, 0], scale: [1, 1.04, 1, 1.06, 1] }}
          transition={{ duration: 1, ease: 'easeInOut' }}>
            🎁
          </motion.span>
          <p className={`font-serif text-xs font-bold uppercase tracking-[0.2em] ${rarity.text}`}>{rarity.label} Chest</p>
          <p className="font-serif text-lg italic text-parch/70">Earned by playing well…</p>
        </motion.div> :

      <div className="flex max-w-xs flex-col items-center gap-4">
          <p className={`rounded-full px-3 py-1 text-center font-serif text-xs font-bold uppercase tracking-[0.2em] ${rarity.bg} ${rarity.text}`}>
            {rarity.label} Chest — {results.length} fragment{results.length > 1 ? 's' : ''}
          </p>
          <div className="grid grid-cols-3 gap-3">
            {results.map((result, i) =>
          <motion.div
            key={i}
            className="flex flex-col items-center gap-1"
            initial={{ opacity: 0, scale: 0.6, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ delay: 0.15 * i, type: 'spring', stiffness: 220, damping: 18 }}>
              {result.unlocked || result.alreadyOwned ?
            <CardBackSprite back={result.back} width={80} /> :

            <div className="relative aspect-[5/7] overflow-hidden rounded-xl bg-ink shadow-card" style={{ width: 80 }}>
                  <div className="absolute inset-0" style={{ clipPath: fragmentIconClipPath(result.have) }}>
                    <CardBackImage back={result.back} />
                  </div>
                </div>
            }
              <p className="text-center text-[10px] font-semibold leading-tight text-parch/80">{result.back.name}</p>
              <p className="text-center text-[10px] text-gold-soft">{resultLabel(result)}</p>
            </motion.div>
          )}
          </div>
          <motion.button
          type="button"
          onClick={onClose}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 * results.length + 0.2 }}
          className="mt-1 rounded-xl bg-white px-8 py-3 text-sm font-bold text-charcoal shadow-card">
            Collect
          </motion.button>
        </div>
      }
    </motion.div>);

}
