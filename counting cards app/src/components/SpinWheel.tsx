import { useState } from 'react';
import { motion } from 'framer-motion';
import { CardBackItem, randomUnownedBack } from '../data/store';
import { useCardBack } from '../contexts/CardBackContext';
import { RarityReveal } from './RarityReveal';
import { BloodDrop } from './BloodDrop';

interface SpinWheelProps {
  onClose: (dropsWon: number) => void;
}

type Segment = {label: string;drops?: number;card?: boolean;};

const SEGMENTS: Segment[] = [
{ label: '+250', drops: 250 },
{ label: 'CARD', card: true },
{ label: '+500', drops: 500 },
{ label: '+1,000', drops: 1000 },
{ label: 'CARD', card: true },
{ label: '+250', drops: 250 },
{ label: '+2,500', drops: 2500 },
{ label: '+750', drops: 750 }];


const SLICE = 360 / SEGMENTS.length;

export function SpinWheel({ onClose }: SpinWheelProps) {
  const { ownedIds, unlock } = useCardBack();
  const [angle, setAngle] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<Segment | null>(null);
  const [prize, setPrize] = useState<CardBackItem | null>(null);
  const [duplicate, setDuplicate] = useState(false);

  const spin = () => {
    if (spinning || result) return;
    const index = Math.floor(Math.random() * SEGMENTS.length);
    const target = 360 * 5 + (360 - index * SLICE - SLICE / 2);
    setSpinning(true);
    setAngle(target);

    window.setTimeout(() => {
      const segment = SEGMENTS[index];
      setSpinning(false);
      setResult(segment);
      if (segment.card) {
        const back = randomUnownedBack(ownedIds);
        setDuplicate(ownedIds.includes(back.id));
        setPrize(back);
      }
    }, 3400);
  };

  const finish = () => {
    if (prize && !duplicate) unlock(prize.id);
    onClose(result?.drops ?? (duplicate ? 1000 : 0));
  };

  return (
    <motion.div
      className="fixed inset-0 z-40 flex items-center justify-center bg-ink/90 px-6 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="dialog"
      aria-label="Spin the wheel">
      
      {prize ?
      <RarityReveal back={prize} duplicate={duplicate} onCollect={finish} /> :

      <div className="flex flex-col items-center gap-5">
          <p className="font-serif text-xl text-gold-soft">Spin the Wheel</p>

          <div className="relative h-[260px] w-[260px]">
            <span
            aria-hidden="true"
            className="absolute left-1/2 top-[-6px] z-10 h-0 w-0 -translate-x-1/2 border-x-[10px] border-t-[18px] border-x-transparent border-t-gold" />
          
            <motion.div
            className="h-full w-full rounded-full ring-4 ring-gold"
            style={{
              background: `conic-gradient(${SEGMENTS.map((segment, i) => {
                const color = segment.card ? '#8f1420' : i % 2 === 0 ? '#2b0d15' : '#3b1219';
                return `${color} ${i * SLICE}deg ${(i + 1) * SLICE}deg`;
              }).join(', ')})`
            }}
            animate={{ rotate: angle }}
            transition={{ duration: 3.4, ease: [0.15, 0.7, 0.15, 1] }}>
            
              {SEGMENTS.map((segment, i) =>
            <span
              key={`${segment.label}-${i}`}
              className="absolute left-1/2 top-1/2 origin-left font-serif text-[11px] font-bold uppercase tracking-[0.08em] text-gold-soft"
              style={{ transform: `rotate(${i * SLICE + SLICE / 2}deg) translate(46px, -6px)` }}>
              
                  {segment.label}
                </span>
            )}
            </motion.div>
            <span className="absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-maroon-800 ring-2 ring-gold" />
          </div>

          {result ?
        <>
              <p className="tabular flex items-center gap-2 font-serif text-2xl font-semibold text-gold">
                {result.label}
                {result.drops && <BloodDrop className="h-5 w-5 text-blood" />}
              </p>
              <button
            type="button"
            onClick={finish}
            className="rounded-xl bg-white px-8 py-3 text-sm font-bold text-charcoal shadow-card">
            
                Collect
              </button>
            </> :

        <button
          type="button"
          onClick={spin}
          disabled={spinning}
          className="rounded-xl bg-white px-8 py-3 text-sm font-bold text-charcoal shadow-card disabled:opacity-50">
          
              {spinning ? 'Spinning…' : 'Spin (free)'}
            </button>
        }

          <button type="button" onClick={() => onClose(0)} className="text-xs font-semibold text-parch/50 underline">
            Close
          </button>
        </div>
      }
    </motion.div>);

}