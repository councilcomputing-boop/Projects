import { CARD_BACK_SHEET, CardBackItem } from '../data/store';

interface CardBackSpriteProps {
  back: CardBackItem;
  /** Exact width in px. Omit to fill the parent's width. */
  width?: number;
  className?: string;
}

const { sheetWidth, sheetHeight, cardWidth, cardHeight, originX, originY, stepX, stepY, url } = CARD_BACK_SHEET;

/** Just the positioned <img> for a back's art — either a standalone image (Mythic
    backs) or cropped out of the uploaded sheet — with no wrapper (no rounding,
    background, or fx sheen). Used directly by CardBackSprite, and by anything that
    needs to clip/animate pieces of the art itself (e.g. the shard-reveal effect). */
export function CardBackImage({ back }: {back: CardBackItem;}) {
  if (back.image) {
    return <img src={back.image} alt="" className="h-full w-full object-cover" />;
  }
  const left = originX + (back.col ?? 0) * stepX;
  const top = originY + (back.row ?? 0) * stepY;
  return (
    <img
      src={url}
      alt=""
      style={{
        position: 'absolute',
        width: `${sheetWidth / cardWidth * 100}%`,
        height: `${sheetHeight / cardHeight * 100}%`,
        left: `${-(left / cardWidth) * 100}%`,
        top: `${-(top / cardHeight) * 100}%`,
        maxWidth: 'none'
      }} />);

}

/** One card back at any size — the full presentational wrapper (rounded corners,
    background, shadow, fx sheen) around CardBackImage. */
export function CardBackSprite({ back, width, className = '' }: CardBackSpriteProps) {
  const wrapperClass = `relative aspect-[5/7] overflow-hidden rounded-xl bg-ink shadow-card ${width ? '' : 'w-full'} ${className}`;
  return (
    <div aria-hidden="true" style={width ? { width } : undefined} className={wrapperClass}>
      <CardBackImage back={back} />
      {back.fx && <span className="card-sheen" />}
    </div>);

}
