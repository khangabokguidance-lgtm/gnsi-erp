// /api/generate-questions.js
// Google Gemini 2.0 Flash — FREE
// Get key: https://aistudio.google.com/apikey
// Add to Vercel: Settings → Environment Variables → GEMINI_API_KEY

export const config = { runtime: 'edge' }

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const { prompt } = await req.json()
    if (!prompt) {
      return new Response(JSON.stringify({ error: 'No prompt' }), { status: 400 })
    }

    const KEY = process.env.GEMINI_API_KEY
    if (!KEY) {
      return new Response(
        JSON.stringify({ error: 'GEMINI_API_KEY not set in Vercel environment variables' }),
        { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      )
    }

    // Try gemini-2.0-flash first, fallback model list
    const models = [
      'gemini-2.0-flash',
      'gemini-1.5-flash',
      'gemini-1.5-flash-latest',
    ]

    let lastError = null

    for (const model of models) {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 4096,
              },
            }),
          }
        )

        const data = await res.json()

        // Log error from Gemini for debugging
        if (data.error) {
          lastError = `${model}: ${data.error.message}`
          continue
        }

        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || ''
        const clean = text.replace(/```json|```/g, '').trim()
        const match = clean.match(/\[[\s\S]*\]/)
        if (!match) {
          lastError = `${model}: No JSON array in response`
          continue
        }

        const questions = JSON.parse(match[0])

        return new Response(JSON.stringify({ questions, model }), {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        })
      } catch (e) {
        lastError = `${model}: ${e.message}`
        continue
      }
    }

    // All models failed
    return new Response(
      JSON.stringify({ questions: [], error: 'All models failed. Last error: ' + lastError }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      }
    )

  } catch (err) {
    return new Response(
      JSON.stringify({ questions: [], error: err.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      }
    )
  }
}