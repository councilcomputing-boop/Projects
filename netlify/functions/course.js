exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }

  let body
  try { body = JSON.parse(event.body) } catch {
    return { statusCode: 400, body: 'Invalid JSON' }
  }

  const { course, holes } = body
  if (!course || !holes) {
    return { statusCode: 400, body: 'Missing course or holes' }
  }

  const key = process.env.ANTHROPIC_API_KEY
  if (!key) {
    return { statusCode: 500, body: 'API key not configured' }
  }

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 120,
      messages: [{
        role: 'user',
        content: `What is the par for each hole at ${course}? Return ONLY a JSON array of ${holes} integers (each 3, 4, or 5). If you don't know the exact course layout, give a realistic estimate for a typical ${holes}-hole course. No explanation, just the array.`
      }]
    })
  })

  if (!resp.ok) {
    const err = await resp.json()
    return { statusCode: resp.status, body: err.error?.message || resp.statusText }
  }

  const data = await resp.json()
  const text = data.content?.[0]?.text || ''
  const match = text.match(/\[[\d,\s]+\]/)
  if (!match) return { statusCode: 500, body: 'Could not parse response' }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: match[0]
  }
}
