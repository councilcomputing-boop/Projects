import { CARD_BACK_SHEET, CardBackItem } from '../data/store';

interface CardBackSpriteProps {
  back: CardBackItem;
  /** Exact width in px. Omit to fill the parent's width. */
  width?: number;
  className?: string;
}

const { sheetWidth, sheetHeight, cardWidth, cardHeight, originX, originY, stepX, stepY, url } = CARD_BACK_SHEET;

/** One card back cropped out of the uploaded sheet, at any size. */
export function CardBackSprite({ back, width, className = '' }: CardBackSpriteProps) {
  const left = originX + back.col * stepX;
  const top = originY + back.row * stepY;

  return (
    <div
      aria-hidden="true"
      style={width ? { width } : undefined}
      className={`relative aspect-[5/7] overflow-hidden rounded-xl bg-ink shadow-card ${width ? '' : 'w-full'} ${className}`}>
      
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
      
      {back.animated && <span className="card-sheen" />}
    </div>);

}