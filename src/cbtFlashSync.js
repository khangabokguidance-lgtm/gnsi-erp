// cbtFlashSync.js — keeps the landing-page flash countdown in step when an admin (re)schedules a test.
import { getSettings, saveSettings } from './websiteApi'
import { CBT_FLASH_KEYS as K } from './lib/cbtFlash'

/** If the flash is counting down to this test, move it to the test's new opening/closing time. Never throws. */
export async function syncFlashSchedule({ id, name, opensAt, closesAt }) {
  try {
    const cfg = await getSettings()
    if (String(cfg?.[K.test] || '') !== String(id)) return false
    await saveSettings({
      [K.at]: opensAt ? new Date(opensAt).toISOString() : '',
      [K.end]: closesAt ? new Date(closesAt).toISOString() : '',
      [K.label]: String(name || '').slice(0, 120),
    })
    return true
  } catch { return false }
}
