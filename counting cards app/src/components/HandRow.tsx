import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { PlayingCardData } from '../types/blackjack';
import { PlayingCard, CardBack } from './PlayingCard';
import { FlipCard } from './FlipCard';

interface HandRowProps {
  title: string;
  cards: PlayingCardData[];
  total: string;
  hideSecond?: boolean;
  /** The dealer's second card is a hole card, so it flips instead of swapping. */
  hasHole?: boolean;
}

const ROW_HEIGHT = 116;
const GAP = 6;
/** Tallest a card can be inside the row, converted to a width (5:7 ratio). */
const MAX_CARD_W = Math.floor(ROW_HEIGHT * (5 / 7));

/** Measures the row so cards always fit the space they are given. */
function useRowWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new ResizeObserver((entries) => setWidth(entries[0].contentRect.width));
    observer.observe(node);
    setWidth(node.clientWidth);
    return () => observer.disconnect();
  }, []);

  return { ref, width };
}

export function HandRow({ title, cards, total, hideSecond = false, hasHole = false }: HandRowProps) {
  const { ref, width } = useRowWidth();
  const available = width || MAX_CARD_W * 2 + GAP;

  // Two cards always sit side by side at full size; more cards fan over each other.
  const cardW = Math.max(38, Math.min(MAX_CARD_W, Math.floor((available - GAP) / 2)));
  const count = Math.max(cards.length, 2);
  const step = count <= 2 ? cardW + GAP : Math.max(cardW * 0.3, (available - cardW) / (count - 1));

  return (
    <section aria-label={title} className="rounded-xl bg-parch/95 px-3 py-2.5">
      <div className="flex items-baseline justify-between">
        <h3 className="font-serif text-[11px] font-semibold uppercase tracking-[0.18em] text-gold-deep">{title}</h3>
        <p className="tabular font-serif text-xs font-semibold text-charcoal">{total}</p>
      </div>

      <div
        ref={ref}
        className="mt-2 flex items-center justify-center overflow-hidden"
        style={{ height: ROW_HEIGHT }}>
        
        {cards.length === 0 ?
        [0, 1].map((slot) =>
        <div key={slot} className="opacity-20" style={{ marginLeft: slot > 0 ? GAP : 0 }}>
                <CardBack width={cardW} />
              </div>
        ) :
        cards.map((card, i) =>
        <motion.div
          key={card.id}
          initial={{ opacity: 0, x: 70, y: -46, rotate: 14, scale: 0.85 }}
          animate={{ opacity: 1, x: 0, y: 0, rotate: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 380, damping: 28, delay: i < 2 ? i * 0.14 : 0 }}
          style={{ marginLeft: i === 0 ? 0 : step - cardW, position: 'relative', zIndex: i }}>
          
                {hasHole && i === 1 ?
          <FlipCard card={card} width={cardW} faceDown={hideSecond} /> :
          hideSecond && i === 1 ?
          <CardBack width={cardW} /> :

          <PlayingCard card={card} size="md" width={cardW} />
          }
              </motion.div>
        )}
      </div>
    </section>);

}