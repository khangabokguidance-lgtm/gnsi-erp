import { requireStaff, rateLimit } from './_guard/guard.js'
import { handleVision } from './_gemini/vision.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  // Paid API key: staff only, rate limited, bounded prompt size.
  const user = await requireStaff(req, res)
  if (!user) return
  // Page images (Model Sets → Import paper) have their own checks and limits.
  if (Array.isArray(req.body?.images)) return handleVision(req, res, user)
  if (!rateLimit(req, res, { key: 'gemini', max: 30, id: user.id })) return

  const { prompt, maxTokens, thinking } = req.body || {}
  if (!prompt) return res.status(400).json({ error: 'No prompt provided' })
  if (String(prompt).length > 120000) return res.status(413).json({ error: 'Prompt too long' })

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY not set' })

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.3,
            // Callers may ask for more room (e.g. translation into Meetei
            // Mayek, which is token-heavy); capped so a request can't run away.
            maxOutputTokens: Math.min(Math.max(Number(maxTokens) || 4096, 256), 8192),
            // thinking: false skips the model's "thinking" pass, which on
            // gemini-2.5-flash adds many seconds per call. The translator
            // uses it; other callers keep the default.
            ...(thinking === false ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
          },
        }),
      }
    )

    const data = await response.json()

    if (!response.ok) {
      console.error('Gemini API error:', data)
      return res.status(response.status).json({ error: data?.error?.message || 'Gemini API error' })
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
    res.status(200).json({ text })
  } catch (e) {
    console.error('Handler error:', e)
    res.status(500).json({ error: e.message })
  }
}