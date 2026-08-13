import { useEffect, useState } from 'react';
import { CheckIcon, LockIcon } from 'lucide-react';
import { ScreenHeader } from '../components/ScreenHeader';
import { Panel } from '../components/Panel';
import { BloodDrop } from '../components/BloodDrop';
import { CardBackSprite } from '../components/CardBackSprite';
import { ShardRevealCardBack } from '../components/ShardRevealCardBack';
import { RARITY_META, CARD_BACKS } from '../data/store';
import { useCardBack } from '../contexts/CardBackContext';
import { useDrops } from '../contexts/DropsContext';

export function CardBacks() {
  const { cardBacks, equipCardBack, lastSeenFragments, markFragmentsSeen } = useCardBack();
  const { owned, equipped, fragments } = cardBacks;
  const { drops } = useDrops();

  const ownedCount = owned.length;

  // Freeze what was already seen as of page load, so this visit's shard animations are
  // based on a stable snapshot rather than a moving target as fragments update mid-visit.
  const [seenSnapshot] = useState(() => lastSeenFragments);

  useEffect(() => {
    CARD_BACKS.forEach((item) => {
      const have = fragments[item.id] || 0;
      if (have > 0) markFragmentsSeen(item.id, have);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <ScreenHeader title="Card Backs" subtitle={`${ownedCount} of ${CARD_BACKS.length} collected`} backTo="/" />

      <Panel label="Collection">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs leading-relaxed text-charcoal-soft">
            Your equipped back appears on every face-down card at the table. Every back is earned by collecting
            fragments from chests, the wheel, and the Skill Chest — there's no shortcut.
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
                  {isOwned ?
                  <CardBackSprite back={item} /> :
                  <ShardRevealCardBack back={item} have={have} need={need} previouslySeen={seenSnapshot[item.id] || 0} />
                  }
                </div>
                <p className="text-center text-[11px] font-bold leading-tight text-charcoal">{item.name}</p>
                <p className={`text-center text-[10px] font-bold uppercase tracking-[0.1em] ${rarity.text}`}>
                  {rarity.label}
                </p>
                {isOwned ?
                <button
                  type="button"
                  onClick={() => equipCardBack(item.id)}
                  aria-pressed={isEquipped}
                  className={`flex items-center justify-center gap-1 rounded-lg py-1.5 text-[11px] font-bold transition-colors ${
                  isEquipped ? 'bg-maroon-800 text-gold' : 'bg-parch-mute text-charcoal hover:bg-white'}`
                  }>
                    {isEquipped && <CheckIcon size={12} strokeWidth={3} aria-hidden="true" />}
                    {isEquipped ? 'Equipped' : 'Equip'}
                  </button> :

                <p className="tabular flex items-center justify-center gap-1 rounded-lg bg-parch-mute/60 py-1.5 text-[11px] font-bold text-charcoal-soft">
                    <LockIcon size={11} strokeWidth={2.5} aria-hidden="true" />
                    {have}/{need}
                  </p>
                }
              </li>);

          })}
        </ul>
      </Panel>
    </div>);

}
