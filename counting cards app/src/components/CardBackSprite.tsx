import { CARD_BACK_SHEET, CardBackItem } from '../data/store';

interface CardBackSpriteProps {
  back: CardBackItem;
  /** Exact width in px. Omit to fill the parent's width. */
  width?: number;
  className?: string;
}

const { sheetWidth, sheetHeight, cardWidth, cardHeight, originX, originY, stepX, stepY, url } = CARD_BACK_SHEET;

/** One card back — either a standalone image (Mythic backs) or cropped out of the
    uploaded sheet — at any size. */
export function CardBackSprite({ back, width, className = '' }: CardBackSpriteProps) {
  const wrapperClass = `relative aspect-[5/7] overflow-hidden rounded-xl bg-ink shadow-card ${width ? '' : 'w-full'} ${className}`;

  if (back.image) {
    return (
      <div aria-hidden="true" style={width ? { width } : undefined} className={wrapperClass}>
        <img src={back.image} alt="" className="h-full w-full object-cover" />
        {back.fx && <span className="card-sheen" />}
      </div>);

  }

  const left = originX + (back.col ?? 0) * stepX;
  const top = originY + (back.row ?? 0) * stepY;

  return (
    <div aria-hidden="true" style={width ? { width } : undefined} className={wrapperClass}>
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
        }} />

      {back.fx && <span className="card-sheen" />}
    </div>);

}