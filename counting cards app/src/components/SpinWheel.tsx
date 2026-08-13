import { useState } from 'react';
import { motion } from 'framer-motion';
import { CardBackItem, WHEEL_SEGMENTS, WHEEL_SEGMENT_ANGLE, WHEEL_SPIN_MS, WHEEL_CARD_DUPLICATE_REFUND, randomUnownedBack } from '../data/store';
import { useCardBack } from '../contexts/CardBackContext';
import { RarityReveal } from './RarityReveal';
import { BloodDrop } from './BloodDrop';

interface SpinWheelProps {
  /** wasFragment tells the caller whether a card-back fragment was awarded (vs. a plain
      drops prize), so it can decide whether to route to the Card Backs shop to watch it
      fill in. */
  onClose: (dropsWon: number, wasFragment: boolean) => void;
}

export function SpinWheel({ onClose }: SpinWheelProps) {
  const { cardBacks, awardFragment } = useCardBack();
  const [angle, setAngle] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [segmentIndex, setSegmentIndex] = useState<number | null>(null);
  const [prize, setPrize] = useState<CardBackItem | null>(null);
  const [fragmentResult, setFragmentResult] = useState<ReturnType<typeof awardFragment> | null>(null);

  const spin = () => {
    if (spinning || segmentIndex !== null) return;
    const index = Math.floor(Math.random() * WHEEL_SEGMENTS.length);
    const target = 360 * 5 + (360 - index * WHEEL_SEGMENT_ANGLE - WHEEL_SEGMENT_ANGLE / 2);
    setSpinning(true);
    setAngle(target);

    window.setTimeout(() => {
      setSpinning(false);
      setSegmentIndex(index);
      const segment = WHEEL_SEGMENTS[index];
      if (segment.type === 'card') {
        const target = randomUnownedBack(cardBacks.owned);
        setPrize(target);
        setFragmentResult(awardFragment(target));
      }
    }, WHEEL_SPIN_MS);
  };

  const finish = () => {
    if (segmentIndex === null) return;
    const segment = WHEEL_SEGMENTS[segmentIndex];
    if (segment.type === 'drops') { onClose(segment.value, false); return; }
    // Card segment: refund only if the fragment landed on an already-owned back.
    onClose(fragmentResult?.alreadyOwned ? WHEEL_CARD_DUPLICATE_REFUND : 0, true);
  };

  const activeSegment = segmentIndex !== null ? WHEEL_SEGMENTS[segmentIndex] : null;
  const resultLabel = !fragmentResult ?
  '' :
  fragmentResult.alreadyOwned ?
  `Already owned — refunded ${WHEEL_CARD_DUPLICATE_REFUND.toLocaleString()} 🩸` :
  fragmentResult.unlocked ?
  'Unlocked!' :
  `${fragmentResult.have}/${fragmentResult.need} fragments collected`;

  return (
    <motion.div
      className="fixed inset-0 z-40 flex items-center justify-center bg-ink/90 px-6 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="dialog"
      aria-label="Spin the wheel">

      {prize ?
      <RarityReveal
        back={prize}
        resultLabel={resultLabel}
        onCollect={finish}
        unlocked={fragmentResult ? fragmentResult.unlocked || !!fragmentResult.alreadyOwned : undefined} /> :

      <div className="flex flex-col items-center gap-5">
          <p className="font-serif text-xl text-gold-soft">Spin the Wheel</p>

          <div className="relative h-[260px] w-[260px]">
            <span
            aria-hidden="true"
            className="absolute left-1/2 top-[-6px] z-10 h-0 w-0 -translate-x-1/2 border-x-[10px] border-t-[18px] border-x-transparent border-t-gold" />

            <motion.div
            className="h-full w-full rounded-full ring-4 ring-gold"
            style={{
              background: `conic-gradient(${WHEEL_SEGMENTS.map((segment, i) => {
                const color = segment.type === 'card' ? '#8f1420' : i % 2 === 0 ? '#2b0d15' : '#3b1219';
                return `${color} ${i * WHEEL_SEGMENT_ANGLE}deg ${(i + 1) * WHEEL_SEGMENT_ANGLE}deg`;
              }).join(', ')})`
            }}
            animate={{ rotate: angle }}
            transition={{ duration: WHEEL_SPIN_MS / 1000, ease: [0.15, 0.7, 0.15, 1] }}>

              {WHEEL_SEGMENTS.map((segment, i) => {
              const segAngle = i * WHEEL_SEGMENT_ANGLE + WHEEL_SEGMENT_ANGLE / 2;
              // The conic-gradient places segment i's center at segAngle clockwise from
              // the top (12 o'clock). This span uses origin-left + translate(radius, 0),
              // whose own zero-rotation direction points at 3 o'clock (90deg clockwise
              // from top) -- subtract that baseline or every label lands a quarter-turn
              // off from its actual colored slice.
              const outerRotate = segAngle - 90;
              const normalized = ((outerRotate % 360) + 360) % 360;
              // Labels on the bottom/left half of the wheel would render upside-down at
              // their placement angle, so counter-rotate just the text in that zone.
              const upsideDown = normalized > 90 && normalized < 270;
              return (
                <span
                  key={i}
                  className="absolute left-1/2 top-1/2 origin-left"
                  style={{ transform: `rotate(${outerRotate}deg) translate(46px, 0px)` }}>
                    <span
                    className="block font-serif text-[11px] font-bold uppercase tracking-[0.08em] text-gold-soft"
                    style={{ transform: upsideDown ? 'rotate(180deg)' : undefined }}>
                      {segment.type === 'card' ? 'CARD' : `+${segment.value}`}
                    </span>
                  </span>);

            })}
            </motion.div>
            <span className="absolute left-1/2 top-1/2 h-10 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-maroon-800 ring-2 ring-gold" />
          </div>

          {activeSegment ?
        <>
              <p className="tabular flex items-center gap-2 font-serif text-2xl font-semibold text-gold">
                {activeSegment.type === 'card' ? 'A card back!' : `+${activeSegment.value}`}
                {activeSegment.type === 'drops' && <BloodDrop className="h-5 w-5 text-blood" />}
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

          <button type="button" onClick={() => onClose(0, false)} className="text-xs font-semibold text-parch/50 underline">
            Close
          </button>
        </div>
      }
    </motion.div>);

}
