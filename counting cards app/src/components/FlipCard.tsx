import { motion } from 'framer-motion';
import { PlayingCardData } from '../types/blackjack';
import { PlayingCard, CardBack } from './PlayingCard';

interface FlipCardProps {
  card: PlayingCardData;
  width: number;
  faceDown: boolean;
}

/** The dealer's hole card — flips face up in 3D when it is revealed. */
export function FlipCard({ card, width, faceDown }: FlipCardProps) {
  return (
    <div className="relative aspect-[5/7]" style={{ width, perspective: 700 }}>
      <motion.div
        className="relative h-full w-full"
        style={{ transformStyle: 'preserve-3d' }}
        animate={{ rotateY: faceDown ? 180 : 0, y: faceDown ? 0 : [0, -6, 0] }}
        transition={{ duration: 0.55, ease: [0.2, 0.8, 0.2, 1] }}>
        
        <div className="absolute inset-0" style={{ backfaceVisibility: 'hidden' }}>
          <PlayingCard card={card} size="md" width={width} />
        </div>
        <div
          className="absolute inset-0"
          style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
          
          <CardBack width={width} />
        </div>
      </motion.div>
    </div>);

}