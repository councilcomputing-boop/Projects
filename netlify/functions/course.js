exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }

  let body
  try { body = JSON.parse(event.body) } catch {
    return { statusCode: 400, body: 'Invalid JSON' }
  }

  const { course, holes, location } = body
  if (!course || !holes) {
    return { statusCode: 400, body: 'Missing course or holes' }
  }
  const courseDesc = location ? `"${course}" in ${location}` : `"${course}"`

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
      model: 'claude-sonnet-4-6',
      max_tokens: 200,
      messages: [{
        role: 'user',
        content: `You are a golf expert. What is the official par for each hole at ${courseDesc} golf course (${holes} holes)? Return ONLY a JSON array of exactly ${holes} integers, each being 3, 4, or 5. Use the real course layout if you know it. If you are uncertain, make your best estimate ensuring the total par is realistic (typically 70-72 for 18 holes, 35-36 for 9 holes). No explanation, no text, just the JSON array.`
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
