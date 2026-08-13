import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CheckIcon, LockIcon } from 'lucide-react';
import { ScreenHeader } from '../components/ScreenHeader';
import { Panel } from '../components/Panel';
import { BloodDrop } from '../components/BloodDrop';
import { CardBackSprite } from '../components/CardBackSprite';
import { ShardRevealCardBack } from '../components/ShardRevealCardBack';
import { FragmentRevealOverlay } from '../components/FragmentRevealOverlay';
import { RARITY_META, CARD_BACKS } from '../data/store';
import { useCardBack } from '../contexts/CardBackContext';
import { useDrops } from '../contexts/DropsContext';

export function CardBacks() {
  const { cardBacks, equipCardBack, lastSeenFragments, markFragmentsSeen, sellAllCardBacks } = useCardBack();
  const { owned, equipped, fragments } = cardBacks;
  const { drops, addDrops } = useDrops();

  const ownedCount = owned.length;

  const navigate = useNavigate();
  const location = useLocation();
  // The Skill Chest sends you here mid-hand (not a deliberate trip to the shop), so it
  // asks to be sent back once the reveal finishes -- see useDealerGame's
  // closeSkillChestReveal. Bought chests and the wheel (from the Store) don't set this.
  const returnTo = (location.state as { returnTo?: string } | null)?.returnTo ?? null;

  const handleSellAll = () => {
    if (!window.confirm('Debug only: reset every owned card back (refunding their drops) so chests/wheel have fresh backs to target?')) return;
    const refund = sellAllCardBacks();
    if (refund > 0) addDrops(refund);
  };

  // Frozen as of page load: which backs earned fragments since the last visit, and what
  // they had before. The grid itself just shows the current (final) state statically --
  // the dramatic reveal happens in the centered overlay below, one at a time, so nothing
  // double-animates.
  const [seenSnapshot] = useState(() => lastSeenFragments);
  const [revealQueue, setRevealQueue] = useState<string[]>(() =>
  CARD_BACKS.
  filter((item) => (fragments[item.id] || 0) > (seenSnapshot[item.id] || 0)).
  map((item) => item.id));


  useEffect(() => {
    CARD_BACKS.forEach((item) => {
      const have = fragments[item.id] || 0;
      if (have > 0) markFragmentsSeen(item.id, have);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tileRefs = useRef<Record<string, HTMLLIElement | null>>({});
  const currentRevealId = revealQueue[0] ?? null;
  const currentRevealItem = currentRevealId ? CARD_BACKS.find((c) => c.id === currentRevealId) ?? null : null;

  // Center the target tile in the scroll container before it's used as a float target --
  // otherwise a tile that starts near the bottom (or off-screen entirely) makes the card
  // land somewhere only partially visible. Runs before paint so there's no visible jump.
  useLayoutEffect(() => {
    if (!currentRevealId) return;
    tileRefs.current[currentRevealId]?.scrollIntoView({ behavior: 'auto', block: 'center' });
  }, [currentRevealId]);

  const targetRect = currentRevealId ? tileRefs.current[currentRevealId]?.getBoundingClientRect() ?? null : null;

  // Once every queued reveal has finished, head back to whichever hand this
  // interrupted -- only fires if the queue actually had something in it this visit,
  // so it doesn't fire on a plain visit with nothing to reveal.
  const hadQueueRef = useRef(revealQueue.length > 0);
  useEffect(() => {
    if (revealQueue.length > 0) { hadQueueRef.current = true; return; }
    if (hadQueueRef.current && returnTo) navigate(returnTo, { replace: true });
  }, [revealQueue, returnTo, navigate]);

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
              <li
                key={item.id}
                ref={(el) => {tileRefs.current[item.id] = el;}}
                className="flex flex-col gap-1.5">
                <div className={`rounded-xl ring-2 ${isEquipped ? 'ring-gold' : 'ring-transparent'}`}>
                  {isOwned ?
                  <CardBackSprite back={item} /> :

                  <ShardRevealCardBack back={item} have={have} need={need} previouslySeen={have} />
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

      {/* TEMPORARY debug tool -- remove once the fragment economy is done being tested. */}
      <Panel label="🧪 Debug">
        <p className="text-xs leading-relaxed text-charcoal-soft">
          Resets every owned back to just "Classic Wine" and refunds their listed price in Blood Drops, so chests,
          the wheel, and the Skill Chest have fresh backs to target for testing.
        </p>
        <button
          type="button"
          onClick={handleSellAll}
          disabled={ownedCount <= 1}
          className="mt-3 w-full rounded-xl bg-blood-deep/80 py-3 text-sm font-bold text-parch shadow-card transition-colors hover:bg-blood-deep disabled:opacity-40">
          Sell All Card Backs
        </button>
      </Panel>

      {currentRevealItem &&
      <FragmentRevealOverlay
        item={currentRevealItem}
        have={fragments[currentRevealItem.id] || 0}
        need={RARITY_META[currentRevealItem.rarity].fragmentsNeeded}
        previouslySeen={seenSnapshot[currentRevealItem.id] || 0}
        targetRect={targetRect}
        onDone={() => setRevealQueue((q) => q.slice(1))} />

      }
    </div>);

}
