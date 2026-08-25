export interface PromoCode {
  code: string;
  drops?: number;
  cardBackId?: string;
  description: string;
  /** Skips the once-per-device redeemed check entirely -- can be entered over and over. */
  reusable?: boolean;
}

// Codes are matched case-insensitively (see findPromoCode). Add new ones here as
// they're announced -- each is single-use per device (tracked in cardCountingStoreState)
// unless reusable: true. NOTE: this is a client-only app with no backend validation, so
// every code here ships inside the public JS bundle -- "secret" only means obscure
// enough that no one stumbles on it by guessing, not actually hidden from the source.
export const PROMO_CODES: PromoCode[] = [
{ code: 'WELCOME', drops: 500, description: '500 Blood Drops' },
{ code: 'FANGSOUT', drops: 1000, description: '1,000 Blood Drops' },
{ code: 'MIDNIGHT', drops: 2500, description: '2,500 Blood Drops' },
{ code: 'BLOODMOON', cardBackId: 'silvermist', description: 'Silver Mist card back' },
{ code: 'HAYESISCEO', drops: 1000000, description: '1,000,000 Blood Drops' },
{ code: 'LandrickLarps', drops: 10000000, reusable: true, description: '10,000,000 Blood Drops' }];


export function findPromoCode(raw: string): PromoCode | undefined {
  const normalized = raw.trim().toUpperCase();
  return PROMO_CODES.find((c) => c.code.toUpperCase() === normalized);
}
