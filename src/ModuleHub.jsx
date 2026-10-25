// ModuleHub.jsx — one menu entry for modules with overlapping features (moduleHubs.js).
// Opens on its first tab with a chip bar to switch; "‹ All sections" shows every tab as an
// icon tile. Tabs stay mounted once opened (hidden when inactive), so a half-filled form
// or an open filter survives switching. Each tab is the existing module, unchanged.
import { useState } from 'react'
import { PremiumStyles, PremiumHero, IconTabs } from './premiumUI'
import { NavIcon } from './navIcons'

// one icon component per module id, made once at module level
const ICONS = {}
const iconFor = (id) => (ICONS[id] ||= function HubTabIcon({ size = 16 }) { return <NavIcon id={id} size={size} /> })

// hub: entry of MODULE_HUBS · visible: tab ids this user may open · views: id → element
// section: open tab id, 'home' for the tile page, null for the first tab · onSection(id)
export default function ModuleHub({ hub, visible, views, section, onSection }) {
  const active = visible.includes(section) ? section : visible[0]
  const onHome = section === 'home' && visible.length > 1
  const [opened, setOpened] = useState(() => new Set(active ? [active] : []))
  if (active && !onHome && !opened.has(active)) setOpened(new Set(opened).add(active)) // derived state: adjust during render

  if (!active) return <div style={{ padding: 40, textAlign: 'center', color: '#5d6b82' }}>You do not have access to any {hub.label} section.</div>

  const groups = hub.groups.map(g => ({ ...g, tabs: g.tabs.filter(t => visible.includes(t.id)).map(t => ({ ...t, icon: iconFor(t.id) })) }))
  return (
    <div className="px-root" style={{ minHeight: 'auto', background: 'transparent' }}>
      <PremiumStyles />
      {(onHome || visible.length > 1) && (
        <div style={{ padding: '14px 16px 0', maxWidth: onHome ? 1100 : undefined, margin: onHome ? '0 auto' : undefined }}>
          {onHome && (
            <PremiumHero eyebrow={hub.eyebrow} title={hub.label} subtitle={hub.blurb}
              icon={<span style={{ display: 'flex', color: '#e9d9b0' }}><NavIcon id={hub.id} size={26} /></span>} />
          )}
          <IconTabs groups={groups} active={active} open={!onHome} onOpen={onSection}
            onHome={() => onSection('home')} homeLabel={`All ${hub.label}`} ariaLabel={`${hub.label} sections`} />
        </div>
      )}
      {visible.filter(id => opened.has(id)).map(id => (
        <div key={id} style={{ display: !onHome && id === active ? 'block' : 'none' }}>{views[id]}</div>
      ))}
    </div>
  )
}
