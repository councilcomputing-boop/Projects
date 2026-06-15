const Stripe = require('stripe')

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

  // Payment verified — app will write isPaid to Firestore using the user's own auth
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ success: true })
  }
}
