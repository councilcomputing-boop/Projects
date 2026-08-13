import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ChestItem, rollFragmentTarget } from '../data/store';
import { useCardBack } from '../contexts/CardBackContext';
import { RarityReveal } from './RarityReveal';
import { CardBackSprite, CardBackImage } from './CardBackSprite';
import { fragmentIconClipPath } from '../utils/puzzlePiece';
import type { AwardResult } from '../hooks/useCardBackStore';

interface ChestOpeningProps {
  chest: ChestItem;
  /** How many of this chest to open at once. */
  quantity: number;
  /** Called once the player taps Collect, with how many drops (if any) to refund. */
  onClose: (dropsRefund: number) => void;
}

function resultLabel(result: AwardResult, chest: ChestItem): string {
  if (result.alreadyOwned) return `Already owned — refunded ${Math.round(chest.dropCost * 0.25).toLocaleString()} 🩸`;
  if (result.unlocked) return 'Unlocked!';
  return `${result.have}/${result.need} fragments collected`;
}

/** Chest(s) shake, burst, then reveal what they awarded -- one fragment per chest,
    each refunded at 25% of the chest's cost if it landed on a back already fully
    owned. Opening more than one rolls each independently against a locally-tracked
    owned/fragments snapshot (via the pure previewAward), then applies every result in
    one commitAwards() call at the end -- calling the stateful awardFragment repeatedly
    in a tight loop isn't safe (see previewAward's doc comment) and was the actual cause
    of multi-open freezing/erroring, not just animation load. */
export function ChestOpening({ chest, quantity, onClose }: ChestOpeningProps) {
  const { cardBacks, previewAward, commitAwards } = useCardBack();
  const [opened, setOpened] = useState(false);
  const [results, setResults] = useState<AwardResult[]>([]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      // If anything in the roll loop throws, still guarantee setOpened(true) fires --
      // otherwise the modal is stuck on the "Unsealing..." animation forever with no
      // way out, which looks exactly like the app has frozen.
      try {
        let owned = [...cardBacks.owned];
        let fragments = { ...cardBacks.fragments };
        const out: AwardResult[] = [];
        for (let i = 0; i < quantity; i++) {
          const target = rollFragmentTarget(chest.odds, owned, fragments);
          const result = previewAward(target, owned, fragments);
          out.push(result);
          if (result.unlocked) {
            owned = [...owned, target.id];
            fragments = { ...fragments };
            delete fragments[target.id];
          } else if (!result.alreadyOwned) {
            fragments = { ...fragments, [target.id]: result.have };
          }
        }
        commitAwards(out);
        setResults(out);
      } catch (err) {
        console.error('ChestOpening: failed to roll results', err);
        setResults([]);
      } finally {
        setOpened(true);
      }
    }, 1100);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const collect = () => {
    const refund = results.reduce((sum, r) => sum + (r.alreadyOwned ? Math.round(chest.dropCost * 0.25) : 0), 0);
    onClose(refund);
  };

  return (
    <motion.div
      className="fixed inset-0 z-40 flex items-center justify-center bg-ink/90 px-6 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="dialog"
      aria-label={`Opening ${quantity > 1 ? `${quantity} ` : ''}${chest.name}`}>

      {!opened ?
      <motion.div className="flex flex-col items-center gap-4">
          <motion.span
          className="flex h-32 w-32 items-center justify-center rounded-2xl bg-maroon-800 text-6xl ring-2 ring-gold"
          animate={{ rotate: [0, -7, 7, -5, 5, 0], scale: [1, 1.04, 1, 1.06, 1] }}
          transition={{ duration: 1, ease: 'easeInOut' }}>
            {chest.icon}
          </motion.span>
          <p className="font-serif text-lg italic text-parch/70">
            Unsealing {quantity > 1 ? `${quantity} ` : ''}{chest.name}{quantity > 1 ? 's' : ''}…
          </p>
        </motion.div> :

      results.length === 0 ?
      <div className="flex flex-col items-center gap-4">
          <p className="font-serif text-sm text-parch/80">Something went wrong opening that. Your drops were spent -- contact support if nothing was credited.</p>
          <button type="button" onClick={collect} className="rounded-xl bg-white px-8 py-3 text-sm font-bold text-charcoal shadow-card">
            Close
          </button>
        </div> :
      quantity === 1 ?
      <RarityReveal
        back={results[0].back}
        resultLabel={resultLabel(results[0], chest)}
        onCollect={collect}
        unlocked={results[0].unlocked || !!results[0].alreadyOwned}
        have={results[0].have} /> :


      <div className="flex max-h-[80vh] max-w-xs flex-col items-center gap-4">
          <p className="rounded-full bg-gold/25 px-3 py-1 text-center font-serif text-xs font-bold uppercase tracking-[0.2em] text-gold-deep">
            {quantity} {chest.name}s opened
          </p>
          <div className="grid grid-cols-3 gap-3 overflow-y-auto">
            {results.map((result, i) =>
          <motion.div
            key={i}
            className="flex flex-col items-center gap-1"
            initial={{ opacity: 0, scale: 0.6, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ delay: Math.min(i, 12) * 0.05, type: 'spring', stiffness: 220, damping: 18 }}>
                {result.unlocked || result.alreadyOwned ?
            <CardBackSprite back={result.back} width={70} /> :

            <div className="relative aspect-[5/7] overflow-hidden rounded-xl bg-ink shadow-card" style={{ width: 70 }}>
                    <div className="absolute inset-0" style={{ clipPath: fragmentIconClipPath(result.have) }}>
                      <CardBackImage back={result.back} />
                    </div>
                  </div>
            }
                <p className="text-center text-[9px] font-semibold leading-tight text-parch/80">{result.back.name}</p>
                <p className="text-center text-[9px] text-gold-soft">{resultLabel(result, chest)}</p>
              </motion.div>
          )}
          </div>
          <button
          type="button"
          onClick={collect}
          className="mt-1 rounded-xl bg-white px-8 py-3 text-sm font-bold text-charcoal shadow-card">
            Collect
          </button>
        </div>
      }
    </motion.div>);

}
