import { PlayingCardData } from '../types/blackjack';
import { SUIT_GLYPHS, isRedSuit } from '../utils/deck';
import { CardBackSprite } from './CardBackSprite';
import { useCardBack } from '../contexts/CardBackContext';

type CardSize = 'lg' | 'md' | 'sm';

interface PlayingCardProps {
  card: PlayingCardData;
  size?: CardSize;
  /** Exact card width in px. Type scales with it so the card always reads cleanly. */
  width?: number;
}

/** Nominal widths used for type scale when no explicit width is given. */
const NOMINAL_WIDTH: Record<CardSize, number> = { lg: 236, md: 82, sm: 64 };

const RADIUS: Record<CardSize, string> = { lg: 'rounded-2xl', md: 'rounded-lg', sm: 'rounded-md' };

/**
 * A standard playing card: rank + suit index in both corners so the value
 * stays readable when cards overlap in a fan, with a large centre pip.
 */
export function PlayingCard({ card, size = 'lg', width }: PlayingCardProps) {
  const red = isRedSuit(card.suit);
  const ink = red ? 'text-blood-deep' : 'text-charcoal';
  const glyph = SUIT_GLYPHS[card.suit];
  const w = width ?? NOMINAL_WIDTH[size];

  const rankSize = Math.round(w * 0.26);
  const cornerSuitSize = Math.round(w * 0.2);
  const centreSize = Math.round(w * 0.52);
  const inset = Math.round(w * 0.07);

  const corner =
  <span className={`flex flex-col items-center leading-none ${ink}`}>
      <span className="tabular font-serif font-semibold" style={{ fontSize: rankSize, lineHeight: 1 }}>
        {card.rank}
      </span>
      <span style={{ fontSize: cornerSuitSize, lineHeight: 1 }}>{glyph}</span>
    </span>;


  return (
    <div
      role="img"
      aria-label={`${card.rank} of ${card.suit}`}
      style={width ? { width } : undefined}
      className={`relative flex aspect-[5/7] items-center justify-center bg-white shadow-card ring-1 ring-charcoal/10 ${
      RADIUS[size]} ${
      width ? '' : 'w-full'}`}>
      
      <span className="absolute" style={{ left: inset, top: inset }}>
        {corner}
      </span>
      <span className="absolute rotate-180" style={{ right: inset, bottom: inset }}>
        {corner}
      </span>
      <span
        aria-hidden="true"
        className={`leading-none ${ink}`}
        style={{ fontSize: centreSize, lineHeight: 1 }}>
        
        {glyph}
      </span>
    </div>);

}

export function CardBack({ className = '', width }: {className?: string;width?: number;}) {
  const { equippedBack } = useCardBack();
  return <CardBackSprite back={equippedBack} width={width} className={className} />;
}