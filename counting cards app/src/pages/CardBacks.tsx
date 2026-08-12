import { CheckIcon } from 'lucide-react';
import { ScreenHeader } from '../components/ScreenHeader';
import { Panel } from '../components/Panel';
import { BloodDrop } from '../components/BloodDrop';
import { CardBackSprite } from '../components/CardBackSprite';
import { RARITY_META, cardBacks } from '../data/store';
import { useCardBack } from '../contexts/CardBackContext';

export function CardBacks() {
  const { equippedId, equip, isOwned } = useCardBack();
  const ownedCount = cardBacks.filter((back) => isOwned(back.id)).length;

  return (
    <div className="flex flex-col gap-4">
      <ScreenHeader title="Card Backs" subtitle={`${ownedCount} of ${cardBacks.length} collected`} backTo="/" />

      <Panel label="Collection">
        <p className="text-xs leading-relaxed text-charcoal-soft">
          Your equipped back appears on every face-down card at the table. Rarer backs come from chests and the wheel.
        </p>
        <ul className="mt-4 grid grid-cols-3 gap-3">
          {cardBacks.map((item) => {
            const owned = isOwned(item.id);
            const isEquipped = equippedId === item.id;
            const rarity = RARITY_META[item.rarity];

            return (
              <li key={item.id} className="flex flex-col gap-1.5">
                <div className={`rounded-xl ring-2 ${isEquipped ? 'ring-gold' : 'ring-transparent'}`}>
                  <div className={owned ? '' : 'opacity-45 grayscale'}>
                    <CardBackSprite back={item} />
                  </div>
                </div>
                <p className="text-center text-[11px] font-bold leading-tight text-charcoal">{item.name}</p>
                <p className={`text-center text-[10px] font-bold uppercase tracking-[0.1em] ${rarity.text}`}>
                  {rarity.label}
                </p>
                {owned ?
                <button
                  type="button"
                  onClick={() => equip(item.id)}
                  aria-pressed={isEquipped}
                  className={`flex items-center justify-center gap-1 rounded-lg py-1.5 text-[11px] font-bold transition-colors ${
                  isEquipped ? 'bg-maroon-800 text-gold' : 'bg-parch-mute text-charcoal hover:bg-white'}`
                  }>
                  
                    {isEquipped && <CheckIcon size={12} strokeWidth={3} aria-hidden="true" />}
                    {isEquipped ? 'Equipped' : 'Equip'}
                  </button> :

                <span className="flex items-center justify-center gap-1 rounded-lg bg-parch-mute py-1.5 text-[11px] font-bold text-charcoal-soft">
                    <span className="tabular">{item.cost.toLocaleString()}</span>
                    <BloodDrop className="h-2.5 w-2.5 text-blood" />
                  </span>
                }
              </li>);

          })}
        </ul>
      </Panel>
    </div>);

}