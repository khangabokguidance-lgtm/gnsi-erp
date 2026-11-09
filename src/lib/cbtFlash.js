// cbtFlash.js — the CBT "flash message" on the public landing page.
// Stored in website_settings (public-readable, same table the rest of the landing page uses), so one switch
// in Website → Settings or in the CBT module controls what every visitor sees. It stays up until an admin turns it off.
export const CBT_FLASH_KEYS = { on: 'cbt_flash_on', text: 'cbt_flash_text', link: 'cbt_flash_link' }
export const CBT_FLASH_DEFAULT_TEXT = 'Online CBT exam is open — enter your details and take your test now.'

const isOn = v => ['yes', 'true', 'on', '1'].includes(String(v ?? '').trim().toLowerCase())

/** Reads the flash settings from a website_settings map. Only same-site paths or https links are accepted for the button. */
export function cbtFlashFrom(cfg) {
  const c = cfg || {}
  const text = String(c[CBT_FLASH_KEYS.text] ?? '').trim().slice(0, 200) || CBT_FLASH_DEFAULT_TEXT
  const raw = String(c[CBT_FLASH_KEYS.link] ?? '').trim()
  const link = raw.startsWith('/') && !raw.startsWith('//') ? raw : /^https:\/\//i.test(raw) ? raw : '/exam'
  return { on: isOn(c[CBT_FLASH_KEYS.on]), text, link }
}

/** The settings map to save for a switch position and message. */
export function cbtFlashSettings({ on, text, link }) {
  return {
    [CBT_FLASH_KEYS.on]: on ? 'yes' : 'no',
    [CBT_FLASH_KEYS.text]: String(text ?? '').trim().slice(0, 200),
    [CBT_FLASH_KEYS.link]: String(link ?? '').trim(),
  }
}
