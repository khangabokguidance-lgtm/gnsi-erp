// /api/generate-questions.js
// Place this file at the ROOT of your project under /api/
// Uses Google Gemini 1.5 Flash — completely FREE
//
// Setup:
//   1. Go to https://aistudio.google.com
//   2. Click "Get API Key" → Create API Key → Copy
//   3. Vercel Dashboard → Settings → Environment Variables
//      Name:  GEMINI_API_KEY
//      Value: AIza...your key here
//   4. Redeploy

export const config = { runtime: 'edge' }

export default async function handler(req) {
  // CORS preflight
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
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 })
  }

  try {
    const { prompt } = await req.json()

    if (!prompt) {
      return new Response(JSON.stringify({ error: 'No prompt provided' }), { status: 400 })
    }

    const GEMINI_KEY = process.env.GEMINI_API_KEY
    if (!GEMINI_KEY) {
      return new Response(
        JSON.stringify({ error: 'GEMINI_API_KEY not set in Vercel environment variables' }),
        { status: 500 }
      )
    }

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature:     0.7,
            maxOutputTokens: 4096,
          },
        }),
      }
    )

    if (!res.ok) {
      const err = await res.text()
      return new Response(
        JSON.stringify({ questions: [], error: 'Gemini API error: ' + err }),
        { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      )
    }

    const data = await res.json()

    // Extract text from Gemini response
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || ''

    // Strip markdown fences if present
    const clean = text.replace(/```json|```/g, '').trim()

    // Find JSON array in response
    const match = clean.match(/\[[\s\S]*\]/)
    if (!match) throw new Error('No JSON array found in response')

    const questions = JSON.parse(match[0])

    return new Response(JSON.stringify({ questions }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    })

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