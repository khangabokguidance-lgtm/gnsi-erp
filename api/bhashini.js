/* global process */
// Bhashini (Government of India, MeitY) translation for the Mayek Tool.
// Needs BHASHINI_USER_ID and BHASHINI_ULCA_API_KEY from the Bhashini portal
// (optional BHASHINI_PIPELINE_ID). Without them this answers 501
// { fallback: true } and the browser moves on to the next engine.
// POST { segments: string[], from: code, to: code }
//   -> { segments: string[], detected: null, engine: 'bhashini' }
//
// Two calls, per Bhashini's pipeline API: a config call to ULCA returns the
// inference endpoint, its key and the model's serviceId for the language
// pair (cached per warm instance); the compute call then translates.
const CONFIG_URL = 'https://meity-auth.ulcacontrib.org/ulca/apis/v0/model/getModelsPipeline'
const DEFAULT_PIPELINE = '64392f96daac500b55c543cd' // MeitY's public pipeline
const LANGS = {
  en: { lang: 'en', script: 'Latn' },
  hi: { lang: 'hi', script: 'Deva' },
  bn: { lang: 'bn', script: 'Beng' },
  'mni-Mtei': { lang: 'mni', script: 'Mtei' },
  'mni-Beng': { lang: 'mni', script: 'Beng' },
}
const MAX_SEGMENTS = 400
const MAX_CHARS = 60000
const BATCH = 25
const CONFIG_TTL = 60 * 60 * 1000

const configCache = new Map()

const language = (s, t) => ({
  sourceLanguage: s.lang, sourceScriptCode: s.script,
  targetLanguage: t.lang, targetScriptCode: t.script,
})

async function pipelineConfig(src, tgt, userId, apiKey, pipelineId) {
  const key = `${src.lang}_${src.script}>${tgt.lang}_${tgt.script}`
  const hit = configCache.get(key)
  if (hit && hit.at > Date.now() - CONFIG_TTL) return hit.cfg

  const r = await fetch(CONFIG_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', userID: userId, ulcaApiKey: apiKey },
    body: JSON.stringify({
      pipelineTasks: [{ taskType: 'translation', config: { language: language(src, tgt) } }],
      pipelineRequestConfig: { pipelineId },
    }),
  })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) throw Object.assign(new Error(data?.message || `Bhashini config error (${r.status})`), { status: r.status })

  const ep = data.pipelineInferenceAPIEndPoint || {}
  const models = data.pipelineResponseConfig?.[0]?.config || []
  // Prefer the model whose scripts match (Manipuri has Meetei Mayek and Bengali-script models).
  const model = models.find(m => m.language?.sourceScriptCode === src.script && m.language?.targetScriptCode === tgt.script) || models[0]
  if (!ep.callbackUrl || !ep.inferenceApiKey?.value || !model?.serviceId)
    throw Object.assign(new Error('Bhashini has no model for this language pair'), { status: 400 })

  const cfg = { url: ep.callbackUrl, authName: ep.inferenceApiKey.name || 'Authorization', authValue: ep.inferenceApiKey.value, serviceId: model.serviceId }
  configCache.set(key, { cfg, at: Date.now() })
  return cfg
}

async function compute(cfg, src, tgt, texts) {
  const r = await fetch(cfg.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', [cfg.authName]: cfg.authValue },
    body: JSON.stringify({
      pipelineTasks: [{ taskType: 'translation', config: { language: language(src, tgt), serviceId: cfg.serviceId } }],
      inputData: { input: texts.map(source => ({ source })) },
    }),
  })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) throw Object.assign(new Error(data?.detail?.message || data?.message || `Bhashini error (${r.status})`), { status: r.status })
  return (data.pipelineResponse?.[0]?.output || []).map(o => String(o?.target ?? ''))
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const userId = process.env.BHASHINI_USER_ID
  const apiKey = process.env.BHASHINI_ULCA_API_KEY
  if (!userId || !apiKey) return res.status(501).json({ error: 'BHASHINI_USER_ID / BHASHINI_ULCA_API_KEY not set', fallback: true })

  const { segments, from, to } = req.body || {}
  if (!Array.isArray(segments) || !segments.length || segments.some(s => typeof s !== 'string'))
    return res.status(400).json({ error: 'segments must be a non-empty array of strings' })
  const src = LANGS[from], tgt = LANGS[to]
  if (!src || !tgt || from === to) return res.status(400).json({ error: 'Language pair not supported by Bhashini', fallback: true })
  if (segments.length > MAX_SEGMENTS || segments.join('').length > MAX_CHARS)
    return res.status(413).json({ error: 'Text too long — translate it in parts' })

  try {
    let cfg = await pipelineConfig(src, tgt, userId, apiKey, process.env.BHASHINI_PIPELINE_ID || DEFAULT_PIPELINE)
    const out = []
    for (let i = 0; i < segments.length; i += BATCH) {
      const batch = segments.slice(i, i + BATCH)
      let got
      try { got = await compute(cfg, src, tgt, batch) }
      catch (e) {
        // An expired inference key: fetch a fresh config once and retry.
        if (e.status !== 401 && e.status !== 403) throw e
        configCache.clear()
        cfg = await pipelineConfig(src, tgt, userId, apiKey, process.env.BHASHINI_PIPELINE_ID || DEFAULT_PIPELINE)
        got = await compute(cfg, src, tgt, batch)
      }
      // If the batch didn't come back one-for-one, redo it one text at a time.
      if (got.length !== batch.length) {
        got = []
        for (const t of batch) got.push((await compute(cfg, src, tgt, [t]))[0] ?? '')
      }
      out.push(...got)
    }
    res.status(200).json({ segments: out, detected: null, engine: 'bhashini' })
  } catch (e) {
    console.error('Bhashini error:', e)
    res.status(e.status && e.status < 500 ? e.status : 502).json({ error: e.message, fallback: true })
  }
}
