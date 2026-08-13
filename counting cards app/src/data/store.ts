export type Rarity = 'common' | 'rare' | 'epic' | 'legendary' | 'mythic';

export const RARITY_META: Record<Rarity, {label: string;ring: string;text: string;bg: string;glow: string;fragmentsNeeded: number;}> = {
  common: {
    label: 'Common',
    ring: 'ring-charcoal/25',
    text: 'text-charcoal-soft',
    bg: 'bg-charcoal/10',
    glow: 'rgba(120, 110, 100, 0.55)',
    fragmentsNeeded: 3
  },
  rare: {
    label: 'Rare',
    ring: 'ring-gold',
    text: 'text-gold-deep',
    bg: 'bg-gold/25',
    glow: 'rgba(200, 169, 75, 0.75)',
    fragmentsNeeded: 5
  },
  epic: {
    label: 'Epic',
    ring: 'ring-[#7c4dbe]',
    text: 'text-[#7c4dbe]',
    bg: 'bg-[#7c4dbe]/20',
    glow: 'rgba(124, 77, 190, 0.8)',
    fragmentsNeeded: 8
  },
  legendary: {
    label: 'Legendary',
    ring: 'ring-blood',
    text: 'text-blood',
    bg: 'bg-blood/20',
    glow: 'rgba(224, 24, 79, 0.85)',
    fragmentsNeeded: 12
  },
  mythic: {
    label: 'Mythic',
    ring: 'ring-[#c77dff]',
    text: 'text-[#c77dff]',
    bg: 'bg-[#c77dff]/20',
    glow: 'rgba(199, 125, 255, 0.9)',
    fragmentsNeeded: 18
  }
};

// ── Blood Vials (real Stripe Payment Links — exact amounts matter, these are
// cross-checked server-side by netlify/functions/verify-payment.js) ──
export interface VialItem {
  id: string;
  name: string;
  drops: number;
  price: string;
  bonus?: string;
  stripeLink: string;
}

export const vialItems: VialItem[] = [
{ id: 'tiny_vial', name: 'Tiny Vial', drops: 1000, price: '$0.99', stripeLink: 'https://buy.stripe.com/fZu4gz1Im6MN6WXfmDgnK03' },
{ id: 'small_vial', name: 'Small Vial', drops: 3500, price: '$2.99', bonus: '+15% Bonus', stripeLink: 'https://buy.stripe.com/fZueVddr41sta99gqHgnK04' },
{ id: 'large_vial', name: 'Large Vial', drops: 13000, price: '$9.99', bonus: '+30% Bonus', stripeLink: 'https://buy.stripe.com/00w8wP86K2wxa99cargnK05' },
{ id: 'coffin_hoard', name: 'Coffin Hoard', drops: 45000, price: '$29.99', bonus: '+50% Bonus', stripeLink: 'https://buy.stripe.com/00wcN5aeS6MNepp1vNgnK06' },
{ id: 'ancient_hoard', name: 'Ancient Hoard', drops: 105000, price: '$59.99', bonus: '+75% Bonus', stripeLink: 'https://buy.stripe.com/3cI7sL9aO1stbdd4HZgnK07' }];

// ── Crypt Chests (bought with Blood Drops, award one card-back fragment) ──
export interface ChestItem {
  id: string;
  name: string;
  icon: string;
  dropCost: number;
  odds: Record<Rarity, number>;
}

export const chestItems: ChestItem[] = [
{ id: 'crypt', name: 'Crypt Chest', icon: '🪦', dropCost: 5000, odds: { common: 70, rare: 25, epic: 5, legendary: 0, mythic: 0 } },
{ id: 'royal', name: 'Blood Royal Chest', icon: '👑', dropCost: 20000, odds: { common: 30, rare: 45, epic: 20, legendary: 5, mythic: 0 } },
{ id: 'vault', name: 'Ancient Vault Chest', icon: '🏺', dropCost: 50000, odds: { common: 0, rare: 25, epic: 45, legendary: 29, mythic: 1 } },
{ id: 'reliquary', name: 'Reliquary Chest', icon: '⚱️', dropCost: 120000, odds: { common: 0, rare: 10, epic: 30, legendary: 45, mythic: 15 } },
{ id: 'sovereign', name: "Sovereign's Hoard", icon: '👁️', dropCost: 250000, odds: { common: 0, rare: 0, epic: 20, legendary: 50, mythic: 30 } }];

export function findChest(id: string): ChestItem | undefined {
  return chestItems.find((c) => c.id === id);
}

// ── Skill Chest: earned by playing well, not bought. Correct strategy moves and correct
// count answers fill a bar (see SKILL_BAR_THRESHOLD); filling it rolls a chest TIER (this
// table), which then rolls 1-5 fragments (SKILL_CHEST_FRAGMENT_COUNT_ODDS), each landing
// on a back via that tier's own fragment-target odds (SKILL_CHEST_FRAGMENT_ODDS) — richer
// tiers are both more likely to roll and more generous about which backs they favor. ──
export const SKILL_BAR_THRESHOLD = 20;

export const SKILL_CHEST_TIER_ODDS: Record<Rarity, number> = {
  common: 50,
  rare: 30,
  epic: 14,
  legendary: 5,
  mythic: 1
};

export const SKILL_CHEST_FRAGMENT_ODDS: Record<Rarity, Record<Rarity, number>> = {
  common: { common: 70, rare: 25, epic: 5, legendary: 0, mythic: 0 },
  rare: { common: 40, rare: 40, epic: 18, legendary: 2, mythic: 0 },
  epic: { common: 15, rare: 35, epic: 35, legendary: 14, mythic: 1 },
  legendary: { common: 5, rare: 20, epic: 35, legendary: 35, mythic: 5 },
  mythic: { common: 0, rare: 10, epic: 25, legendary: 40, mythic: 25 }
};

const SKILL_CHEST_FRAGMENT_COUNT_ODDS: Record<string, number> = { '1': 35, '2': 30, '3': 20, '4': 10, '5': 5 };

/** Generic weighted pick — used for the skill-chest tier roll and its fragment count. */
export function rollWeighted<T extends string>(weights: Record<T, number>): T {
  const entries = Object.entries(weights) as [T, number][];
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let r = Math.random() * total;
  for (const [key, w] of entries) {
    if (r < w) return key;
    r -= w;
  }
  return entries[entries.length - 1][0];
}

export function rollSkillChestFragmentCount(): number {
  return Number(rollWeighted(SKILL_CHEST_FRAGMENT_COUNT_ODDS));
}

/** 1x normally, 1.5x on a 5+ streak of correct moves/count answers, 2x on 10+. A miss
    resets the streak (and this multiplier) but never removes bar progress already earned. */
export function skillMultiplierForStreak(streak: number): number {
  if (streak >= 10) return 2;
  if (streak >= 5) return 1.5;
  return 1;
}

// ── Spin Wheel (1 free spin/day) ──
export type WheelSegment = { type: 'drops'; value: number } | { type: 'card' };
export const WHEEL_SEGMENTS: WheelSegment[] = [
{ type: 'drops', value: 50 },
{ type: 'card' },
{ type: 'card' },
{ type: 'drops', value: 150 },
{ type: 'drops', value: 250 },
{ type: 'drops', value: 500 },
{ type: 'drops', value: 1000 }];

export const WHEEL_SEGMENT_ANGLE = 360 / WHEEL_SEGMENTS.length;
export const WHEEL_SPIN_MS = 3000;
export const WHEEL_CARD_DUPLICATE_REFUND = 1000;

/** The uploaded 5 × 4 card-back sheet, cropped per design via CSS. */
export const CARD_BACK_SHEET = {
  url: "/cardbacks-sheet.png",
  sheetWidth: 1264,
  sheetHeight: 1163,
  cardWidth: 160,
  cardHeight: 228,
  originX: 63,
  originY: 80,
  stepX: 244.5,
  stepY: 268
};

export interface CardBackItem {
  id: string;
  name: string;
  /** Sprite-sheet position — omitted for backs that use a standalone `image` instead. */
  row?: number;
  col?: number;
  /** Standalone art (e.g. Mythic backs) — takes precedence over row/col sheet-cropping. */
  image?: string;
  price: number;
  rarity: Rarity;
  fx?: boolean;
}

// Exact catalog from the live app — price is the direct-buy cost in drops;
// rarity drives fragment collection via chests/the spin wheel (RARITY_META).
export const CARD_BACKS: CardBackItem[] = [
{ id: 'classic', name: 'Classic Wine', row: 0, col: 0, price: 0, rarity: 'common' },
{ id: 'slate', name: 'Midnight Slate', row: 0, col: 1, price: 400, rarity: 'common' },
{ id: 'bone', name: 'Bone White', row: 0, col: 2, price: 600, rarity: 'common' },
{ id: 'coffin', name: 'Coffin Black', row: 0, col: 3, price: 600, rarity: 'common' },
{ id: 'bloodfade', name: 'Blood Fade', row: 0, col: 4, price: 1200, rarity: 'common' },
{ id: 'silvermist', name: 'Silver Mist', row: 1, col: 0, price: 1500, rarity: 'rare' },
{ id: 'ivoryrose', name: 'Ivory Rose', row: 1, col: 1, price: 1500, rarity: 'rare' },
{ id: 'onyxgold', name: 'Onyx Gold', row: 1, col: 2, price: 1800, rarity: 'rare' },
{ id: 'garnet', name: 'Garnet Sheen', row: 1, col: 3, price: 3500, rarity: 'rare' },
{ id: 'moonstone', name: 'Moonstone', row: 1, col: 4, price: 4000, rarity: 'rare' },
{ id: 'velvetplum', name: 'Velvet Plum', row: 2, col: 0, price: 4500, rarity: 'epic' },
{ id: 'champagne', name: 'Champagne', row: 2, col: 1, price: 5000, rarity: 'epic' },
{ id: 'crimsonpulse', name: 'Crimson Pulse', row: 2, col: 2, price: 9000, rarity: 'epic', fx: true },
{ id: 'silvershimmer', name: 'Silver Shimmer', row: 2, col: 3, price: 11000, rarity: 'epic', fx: true },
{ id: 'batsigil', name: 'Bat Sigil', row: 2, col: 4, price: 13000, rarity: 'epic', fx: true },
{ id: 'frostbite', name: 'Frostbite', row: 3, col: 0, price: 15000, rarity: 'legendary', fx: true },
{ id: 'draculaseal', name: "Dracula's Seal", row: 3, col: 1, price: 25000, rarity: 'legendary', fx: true },
{ id: 'eternalnight', name: 'Eternal Night', row: 3, col: 2, price: 30000, rarity: 'legendary', fx: true },
{ id: 'fullmoon', name: 'Full Moon Curse', row: 3, col: 3, price: 40000, rarity: 'legendary', fx: true },
{ id: 'vampirehoard', name: "Vampire's Hoard", row: 3, col: 4, price: 60000, rarity: 'mythic', fx: true },
{ id: 'crimsonthrone', name: 'Crimson Throne', image: '/cardbacks/mythic-crimson-throne.jpg', price: 75000, rarity: 'mythic', fx: true },
{ id: 'violetrequiem', name: 'Violet Requiem', image: '/cardbacks/mythic-violet-requiem.jpg', price: 90000, rarity: 'mythic', fx: true }];

export function findCardBack(id: string): CardBackItem {
  return CARD_BACKS.find((b) => b.id === id) ?? CARD_BACKS[0];
}

export function backsByRarity(rarity: Rarity): CardBackItem[] {
  return CARD_BACKS.filter((b) => b.rarity === rarity);
}

/**
 * Rolls a rarity from a chest/wheel's odds, then a target back within that rarity to
 * award a fragment toward — preferring a back already in progress, then any unfinished
 * back of that rarity, falling back to an owned one only if the whole rarity is done.
 */
export function rollFragmentTarget(
odds: Record<Rarity, number>,
owned: string[],
fragments: Record<string, number>)
: CardBackItem {
  const total = (Object.values(odds) as number[]).reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  let rarity: Rarity = 'common';
  for (const key of ['common', 'rare', 'epic', 'legendary', 'mythic'] as Rarity[]) {
    const w = odds[key] || 0;
    if (r < w) { rarity = key; break; }
    r -= w;
  }
  const pool = backsByRarity(rarity);
  const unfinished = pool.filter((b) => !owned.includes(b.id));
  const inProgress = unfinished.filter((b) => (fragments[b.id] || 0) > 0);
  const choices = inProgress.length ? inProgress : unfinished.length ? unfinished : pool;
  return choices[Math.floor(Math.random() * choices.length)];
}

/** Any not-fully-owned back, regardless of rarity — used by the wheel's plain "CARD" segments. */
export function randomUnownedBack(owned: string[]): CardBackItem {
  const unowned = CARD_BACKS.filter((b) => !owned.includes(b.id));
  const pool = unowned.length ? unowned : CARD_BACKS;
  return pool[Math.floor(Math.random() * pool.length)];
}
