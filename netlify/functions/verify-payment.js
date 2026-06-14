const Stripe = require('stripe')
const admin = require('firebase-admin')

if (!admin.apps.length) {
  const svc = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
  admin.initializeApp({ credential: admin.credential.cert(svc) })
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' }

  let body
  try { body = JSON.parse(event.body) } catch {
    return { statusCode: 400, body: 'Invalid JSON' }
  }

  const { sessionId, uid } = body
  if (!sessionId || !uid) return { statusCode: 400, body: 'Missing sessionId or uid' }

  const stripe = Stripe(process.env.STRIPE_SECRET_KEY)

  let session
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId)
  } catch (e) {
    return { statusCode: 400, body: 'Invalid session: ' + e.message }
  }

  if (session.payment_status !== 'paid') {
    return { statusCode: 400, body: 'Payment not completed' }
  }

  if (session.client_reference_id !== uid) {
    return { statusCode: 403, body: 'UID mismatch' }
  }

  await admin.firestore().doc(`users/${uid}`).set({ isPaid: true }, { merge: true })

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ success: true })
  }
}
