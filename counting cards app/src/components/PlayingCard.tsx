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
  { x: 0.33, y: 0.15 }, { x: 0.67, y: 0.15 },
  { x: 0.5, y: 0.27 },
  { x: 0.33, y: 0.4 }, { x: 0.67, y: 0.4 },
  { x: 0.33, y: 0.6, flip: true }, { x: 0.67, y: 0.6, flip: true },
  { x: 0.5, y: 0.73, flip: true },
  { x: 0.33, y: 0.85, flip: true }, { x: 0.67, y: 0.85, flip: true }]

};

/** Jack/Queen/King show a vampire court portrait instead of a pip — King is Dracula
    himself, Queen and Jack are matching companion portraits in the same flat-vector
    mascot style, all with the background removed so they sit directly on the card. */
const FACE_CARD_PORTRAITS: Partial<Record<string, string>> = {
  J: '/facecard-jack.png',
  Q: '/facecard-queen.png',
  K: '/facecard-king.png'
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
  const portrait = FACE_CARD_PORTRAITS[card.rank];

  // Sized off card width, but the card itself is much taller than wide (aspect 5/7) --
  // at the old 0.26/0.2 fractions the corner rank+suit stack worked out to roughly a
  // third of the card's actual height, which barged into face-card portraits and
  // crowded pip layouts instead of sitting as a small, unobtrusive corner index like a
  // real card's.
  // '10' is the only two-character rank -- at the same font size as every other
  // rank's single character, its corner index renders wide enough to run into the
  // first pip row, so it gets a smaller size to keep the same rendered width as
  // the rest of the corner indices (matching how real decks print a condensed '10').
  const rankSize = Math.round(w * (card.rank === '10' ? 0.1 : 0.15));
  const cornerSuitSize = Math.round(w * 0.12);
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
      portrait ?
      // Classic double-ended court card: the same bust crop shown upright in the top
      // half and rotated 180deg in the bottom half, meeting at a cut line through the
      // middle — reads right-side up no matter which way the card is held. Every
      // portrait's actual artwork (measured via alpha bbox) spans ~4.7%-89.4% of the
      // square source, so the crop height (89.5% of the source) lands right at that
      // bottom edge instead of past it — a wider margin here doubles up at the seam
      // (top half's bottom margin + bottom half's mirrored top margin) into a visible gap.
      <span
        aria-hidden="true"
        className="absolute flex flex-col items-center"
        style={{ width: '50%', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
          <span className="w-full overflow-hidden" style={{ aspectRatio: '10 / 8.95' }}>
            <img src={portrait} alt="" className="h-full w-full object-cover object-top" />
          </span>
          <span className="w-full overflow-hidden" style={{ aspectRatio: '10 / 9.3', transform: 'rotate(180deg)' }}>
            <img src={portrait} alt="" className="h-full w-full object-cover object-top" />
          </span>
        </span> :

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