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

/** The display serif (Cormorant Garamond) doesn't carry proper ♠♥♦♣ glyphs and
    substitutes decorative lookalikes instead of falling back — so suit glyphs get
    their own plain system font stack, which every platform renders correctly. */
const SUIT_FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';

interface PipPos {x: number;y: number;flip?: boolean;}

/** Standard playing-card pip layouts for number cards (2-10) — positions as fractions
    of the card box, matching how a real deck arranges pips per rank (e.g. a 7 shows 7
    suit symbols, not one big centre pip). Face cards and the Ace keep the single large
    centre glyph below instead. */
const PIP_LAYOUTS: Record<string, PipPos[]> = {
  '2': [{ x: 0.5, y: 0.24 }, { x: 0.5, y: 0.76, flip: true }],
  '3': [{ x: 0.5, y: 0.2 }, { x: 0.5, y: 0.5 }, { x: 0.5, y: 0.8, flip: true }],
  '4': [
  { x: 0.3, y: 0.22 }, { x: 0.7, y: 0.22 },
  { x: 0.3, y: 0.78, flip: true }, { x: 0.7, y: 0.78, flip: true }],

  '5': [
  { x: 0.3, y: 0.22 }, { x: 0.7, y: 0.22 },
  { x: 0.5, y: 0.5 },
  { x: 0.3, y: 0.78, flip: true }, { x: 0.7, y: 0.78, flip: true }],

  '6': [
  { x: 0.3, y: 0.2 }, { x: 0.7, y: 0.2 },
  { x: 0.3, y: 0.5 }, { x: 0.7, y: 0.5 },
  { x: 0.3, y: 0.8, flip: true }, { x: 0.7, y: 0.8, flip: true }],

  '7': [
  { x: 0.3, y: 0.16 }, { x: 0.7, y: 0.16 },
  { x: 0.5, y: 0.32 },
  { x: 0.3, y: 0.5 }, { x: 0.7, y: 0.5 },
  { x: 0.3, y: 0.84, flip: true }, { x: 0.7, y: 0.84, flip: true }],

  '8': [
  { x: 0.3, y: 0.14 }, { x: 0.7, y: 0.14 },
  { x: 0.5, y: 0.3 },
  { x: 0.3, y: 0.5 }, { x: 0.7, y: 0.5 },
  { x: 0.5, y: 0.7, flip: true },
  { x: 0.3, y: 0.86, flip: true }, { x: 0.7, y: 0.86, flip: true }],

  '9': [
  { x: 0.3, y: 0.14 }, { x: 0.7, y: 0.14 },
  { x: 0.3, y: 0.38 }, { x: 0.7, y: 0.38 },
  { x: 0.5, y: 0.5 },
  { x: 0.3, y: 0.62, flip: true }, { x: 0.7, y: 0.62, flip: true },
  { x: 0.3, y: 0.86, flip: true }, { x: 0.7, y: 0.86, flip: true }],

  '10': [
  { x: 0.3, y: 0.12 }, { x: 0.7, y: 0.12 },
  { x: 0.5, y: 0.24 },
  { x: 0.3, y: 0.38 }, { x: 0.7, y: 0.38 },
  { x: 0.3, y: 0.62, flip: true }, { x: 0.7, y: 0.62, flip: true },
  { x: 0.5, y: 0.76, flip: true },
  { x: 0.3, y: 0.88, flip: true }, { x: 0.7, y: 0.88, flip: true }]

};

/**
 * A standard playing card: rank + suit index in both corners so the value
 * stays readable when cards overlap in a fan, with a large centre pip.
 */
export function PlayingCard({ card, size = 'lg', width }: PlayingCardProps) {
  const red = isRedSuit(card.suit);
  const ink = red ? 'text-blood-deep' : 'text-charcoal';
  const glyph = SUIT_GLYPHS[card.suit];
  const w = width ?? NOMINAL_WIDTH[size];
  const pipLayout = PIP_LAYOUTS[card.rank];

  const rankSize = Math.round(w * 0.26);
  const cornerSuitSize = Math.round(w * 0.2);
  const centreSize = Math.round(w * 0.52);
  const pipSize = Math.round(w * 0.16);
  const inset = Math.round(w * 0.07);

  const corner =
  <span className={`flex flex-col items-center leading-none ${ink}`}>
      <span className="tabular font-serif font-semibold" style={{ fontSize: rankSize, lineHeight: 1 }}>
        {card.rank}
      </span>
      <span style={{ fontFamily: SUIT_FONT, fontSize: cornerSuitSize, lineHeight: 1 }}>{glyph}</span>
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
      {pipLayout ?
      pipLayout.map((p, i) =>
      <span
        key={i}
        aria-hidden="true"
        className={`absolute ${ink}`}
        style={{
          left: `${p.x * 100}%`,
          top: `${p.y * 100}%`,
          transform: `translate(-50%, -50%)${p.flip ? ' rotate(180deg)' : ''}`,
          fontFamily: SUIT_FONT,
          fontSize: pipSize,
          lineHeight: 1
        }}>
          {glyph}
        </span>
      ) :

      <span
        aria-hidden="true"
        className={`leading-none ${ink}`}
        style={{ fontFamily: SUIT_FONT, fontSize: centreSize, lineHeight: 1 }}>
          {glyph}
        </span>
      }
    </div>);

}

export function CardBack({ className = '', width }: {className?: string;width?: number;}) {
  const { equippedBack } = useCardBack();
  return <CardBackSprite back={equippedBack} width={width} className={className} />;
}