const Stripe = require('stripe');
const admin = require('firebase-admin');

if (!admin.apps.length) {
  const svc = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  admin.initializeApp({ credential: admin.credential.cert(svc) });
}

// Maps the exact amount charged (USD cents) to a Vial tier's drop amount.
// The amount is always resolved HERE from Stripe's own session data — never
// trust a drop amount sent in the request body. Each Vial's Payment Link has
// a distinct one-time price, so amount_total alone identifies the tier.
const AMOUNT_TO_DROPS = {
  99:   { amount: 100,   tier: 'tiny_vial' },
  299:  { amount: 350,   tier: 'small_vial' },
  999:  { amount: 1300,  tier: 'large_vial' },
  2999: { amount: 4500,  tier: 'coffin_hoard' },
  5999: { amount: 10500, tier: 'ancient_hoard' }
};

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  let body;
  try { body = JSON.parse(event.body); } catch { return { statusCode: 400, body: 'Invalid JSON' }; }

  const { sessionId, uid } = body;
  if (!sessionId || !uid) return { statusCode: 400, body: 'Missing sessionId or uid' };

  const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

  let session;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId);
  } catch (e) {
    return { statusCode: 400, body: 'Invalid session: ' + e.message };
  }

  if (session.payment_status !== 'paid') return { statusCode: 400, body: 'Payment not completed' };
  if (session.client_reference_id !== uid) return { statusCode: 403, body: 'UID mismatch' };
  if (session.currency !== 'usd') return { statusCode: 400, body: 'Unexpected currency' };

  const resolved = AMOUNT_TO_DROPS[session.amount_total];
  if (!resolved) return { statusCode: 400, body: 'Unrecognized amount' };

  const db = admin.firestore();
  const purchaseRef = db.doc(`users/${uid}/purchases/${sessionId}`);
  const userRef = db.doc(`users/${uid}`);

  const credited = await db.runTransaction(async (tx) => {
    const existing = await tx.get(purchaseRef);
    if (existing.exists) return false; // already credited — safe to call this endpoint again, no double credit

    tx.set(purchaseRef, {
      amount: resolved.amount,
      tier: resolved.tier,
      creditedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    tx.set(userRef, {
      drops: admin.firestore.FieldValue.increment(resolved.amount)
    }, { merge: true });
    return true;
  });

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ success: true, amount: resolved.amount, alreadyCredited: !credited })
  };
};
