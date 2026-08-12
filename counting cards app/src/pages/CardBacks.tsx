import { CheckIcon } from 'lucide-react';
import { ScreenHeader } from '../components/ScreenHeader';
import { Panel } from '../components/Panel';
import { BloodDrop } from '../components/BloodDrop';
import { CardBackSprite } from '../components/CardBackSprite';
import { RARITY_META, CARD_BACKS } from '../data/store';
import { useCardBack } from '../contexts/CardBackContext';
import { useDealerGame } from '../hooks/useDealerGame';

export function CardBacks() {
  const { cardBacks, buyOrEquipCardBack, equipCardBack } = useCardBack();
  const { owned, equipped, fragments } = cardBacks;
  const { drops, spendDrops } = useDealerGame(true);

  const ownedCount = owned.length;

  const handleTileAction = (backId: string, price: number) => {
    if (owned.includes(backId)) {
      equipCardBack(backId);
      return;
    }
    if (!spendDrops(price)) return;
    buyOrEquipCardBack(backId);
  };

  return (
    <div className="flex flex-col gap-4">
      <ScreenHeader title="Card Backs" subtitle={`${ownedCount} of ${CARD_BACKS.length} collected`} backTo="/" />

      <Panel label="Collection">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs leading-relaxed text-charcoal-soft">
            Your equipped back appears on every face-down card at the table. Rarer backs come from chests
            and the wheel — or buy one outright below.
          </p>
          <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-maroon-700 px-3 py-1.5 text-gold-soft shadow-gold">
            <BloodDrop className="h-3.5 w-3.5 text-blood" />
            <span className="tabular font-serif text-sm font-semibold">{drops.toLocaleString()}</span>
          </span>
        </div>
        <ul className="mt-4 grid grid-cols-3 gap-3">
          {CARD_BACKS.map((item) => {
            const isOwned = owned.includes(item.id);
            const isEquipped = equipped === item.id;
            const rarity = RARITY_META[item.rarity];
            const have = fragments[item.id] || 0;
            const need = rarity.fragmentsNeeded;

            return (
              <li key={item.id} className="flex flex-col gap-1.5">
                <div className={`rounded-xl ring-2 ${isEquipped ? 'ring-gold' : 'ring-transparent'}`}>
                  <div className={isOwned ? '' : 'opacity-45 grayscale'}>
                    <CardBackSprite back={item} />
                  </div>
                </div>
                <p className="text-center text-[11px] font-bold leading-tight text-charcoal">{item.name}</p>
                <p className={`text-center text-[10px] font-bold uppercase tracking-[0.1em] ${rarity.text}`}>
                  {rarity.label}
                </p>
                {!isOwned && have > 0 &&
                <p className="tabular text-center text-[10px] font-semibold text-charcoal-soft">
                    {have}/{need} fragments
                  </p>
                }
                {isOwned ?
                <button
                  type="button"
                  onClick={() => handleTileAction(item.id, item.price)}
                  aria-pressed={isEquipped}
                  className={`flex items-center justify-center gap-1 rounded-lg py-1.5 text-[11px] font-bold transition-colors ${
                  isEquipped ? 'bg-maroon-800 text-gold' : 'bg-parch-mute text-charcoal hover:bg-white'}`
                  }>
                    {isEquipped && <CheckIcon size={12} strokeWidth={3} aria-hidden="true" />}
                    {isEquipped ? 'Equipped' : 'Equip'}
                  </button> :

                <button
                  type="button"
                  onClick={() => handleTileAction(item.id, item.price)}
                  disabled={drops < item.price}
                  className="flex items-center justify-center gap-1 rounded-lg bg-parch-mute py-1.5 text-[11px] font-bold text-charcoal-soft transition-colors hover:bg-white disabled:opacity-50 disabled:hover:bg-parch-mute">
                    <span className="tabular">{item.price.toLocaleString()}</span>
                    <BloodDrop className="h-2.5 w-2.5 text-blood" />
                  </button>
                }
              </li>);

          })}
        </ul>
      </Panel>
    </div>);

}
