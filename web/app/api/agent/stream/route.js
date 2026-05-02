export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request) {
  const body = await request.json()
  const functionsUrl = process.env.NEXT_PUBLIC_FUNCTIONS_URL || 'http://localhost:7071'

  let resp
  try {
    resp = await fetch(`${functionsUrl}/api/advisor_stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (!resp.ok) {
    const text = await resp.text()
    return new Response(text, {
      status: resp.status,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Functions returns NDJSON; pass it through as-is
  const ndjson = await resp.text()
  return new Response(ndjson, {
    status: 200,
    headers: {
      'Content-Type': 'application/x-ndjson',
      'Cache-Control': 'no-store',
    },
  })
}
