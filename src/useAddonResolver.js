// useAddonResolver.js — lets screens that read base rates directly (checks, fixers, lists)
// add the Combined add-on the same way billing does. Until it loads, nobody has an add-on.
import { useEffect, useState } from 'react'
import { getAddonResolver } from './feeEngine'

const NONE = { eligible: () => '', amount: () => 0, ready: false }

export function useAddonResolver() {
  const [r, setR] = useState(NONE)
  useEffect(() => {
    let live = true
    getAddonResolver().then(x => { if (live) setR({ ...x, ready: true }) }).catch(() => {})
    return () => { live = false }
  }, [])
  return r
}
