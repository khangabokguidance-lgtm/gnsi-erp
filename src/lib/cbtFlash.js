// cbtFlash.js — the CBT "flash message" on the public landing page.
// Stored in website_settings (public-readable, same table the rest of the landing page uses), so one switch
// in Website → Settings or in the CBT module controls what every visitor sees. It stays up until an admin turns it off.
export const CBT_FLASH_KEYS = { on: 'cbt_flash_on', text: 'cbt_flash_text', link: 'cbt_flash_link', at: 'cbt_flash_at', end: 'cbt_flash_end', label: 'cbt_flash_label', test: 'cbt_flash_test' }
export const CBT_FLASH_DEFAULT_TEXT = 'Online CBT exam is open — enter your details and take your test now.'

const isOn = v => ['yes', 'true', 'on', '1'].includes(String(v ?? '').trim().toLowerCase())

/** Reads the flash settings from a website_settings map. Only same-site paths or https links are accepted for the button. */
export function cbtFlashFrom(cfg) {
  const c = cfg || {}
  const text = String(c[CBT_FLASH_KEYS.text] ?? '').trim().slice(0, 200) || CBT_FLASH_DEFAULT_TEXT
  const raw = String(c[CBT_FLASH_KEYS.link] ?? '').trim()
  const link = raw.startsWith('/') && !raw.startsWith('//') ? raw : /^https:\/\//i.test(raw) ? raw : '/exam'
  return { on: isOn(c[CBT_FLASH_KEYS.on]), text, link, at: isoOrNull(c[CBT_FLASH_KEYS.at]), end: isoOrNull(c[CBT_FLASH_KEYS.end]), label: String(c[CBT_FLASH_KEYS.label] ?? '').trim().slice(0, 120), test: String(c[CBT_FLASH_KEYS.test] ?? '').trim() }
}

const isoOrNull = v => { const t = Date.parse(String(v ?? '')); return Number.isFinite(t) ? new Date(t).toISOString() : null }

/**
 * Where the flash is at a given moment:
 *   'upcoming' — a start time is set and not reached yet (show the countdown)
 *   'live'     — no schedule, or the start has passed and the end has not
 *   'ended'    — an end time was set and has passed (the banner hides itself)
 */
export function flashPhase(f, now = Date.now()) {
  const at = f?.at ? Date.parse(f.at) : NaN, end = f?.end ? Date.parse(f.end) : NaN
  if (Number.isFinite(end) && now >= end) return { phase: 'ended', ms: 0 }
  if (Number.isFinite(at) && now < at) return { phase: 'upcoming', ms: at - now }
  return { phase: 'live', ms: Number.isFinite(end) ? end - now : null }
}

/** 93784000 → { d:1, h:2, m:3, s:4 } */
export function countdownParts(ms) {
  const t = Math.max(0, Math.floor(ms / 1000))
  return { d: Math.floor(t / 86400), h: Math.floor((t % 86400) / 3600), m: Math.floor((t % 3600) / 60), s: t % 60 }
}

/** The nearest test whose opening time is still ahead (rows: { id, name, opens_at, closes_at, status }). */
export function nextScheduled(rows, now = Date.now()) {
  return (rows || [])
    .filter(r => r && r.status !== 'closed' && r.opens_at && Date.parse(r.opens_at) > now)
    .sort((x, y) => Date.parse(x.opens_at) - Date.parse(y.opens_at))[0] || null
}

/** The settings map to save for a switch position and message. */
export function cbtFlashSettings({ on, text, link, at = null, end = null, label = '', test = '' }) {
  return {
    [CBT_FLASH_KEYS.on]: on ? 'yes' : 'no',
    [CBT_FLASH_KEYS.text]: String(text ?? '').trim().slice(0, 200),
    [CBT_FLASH_KEYS.link]: String(link ?? '').trim(),
    [CBT_FLASH_KEYS.at]: at ? new Date(at).toISOString() : '',
    [CBT_FLASH_KEYS.end]: end ? new Date(end).toISOString() : '',
    [CBT_FLASH_KEYS.label]: String(label ?? '').trim().slice(0, 120),
    [CBT_FLASH_KEYS.test]: String(test ?? '').trim(),
  }
}
