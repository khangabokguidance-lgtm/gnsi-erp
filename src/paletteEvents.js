// The command palette (CommandPalette.jsx) opens on this window event, so any top bar or
// button can open it without passing props around.
export const OPEN_PALETTE_EVENT = 'gnsi:open-palette'
export const openPalette = () => window.dispatchEvent(new Event(OPEN_PALETTE_EVENT))
