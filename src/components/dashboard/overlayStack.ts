// Shared LIFO stack of open overlays (Modal + Drawer). Both portal to <body> and
// each registers its own window 'keydown' Escape listener, so a stacked dialog
// (e.g. the AD-03 conflict Modal opened over the booking Drawer) would otherwise
// collapse the WHOLE stack on a single Esc. Gating each overlay's Esc handler on
// isTopOverlay() makes one Escape dismiss only the top-most overlay.
let stack: symbol[] = []

export function pushOverlay(): symbol {
  const id = Symbol('overlay')
  stack.push(id)
  return id
}

export function popOverlay(id: symbol): void {
  stack = stack.filter((s) => s !== id)
}

export function isTopOverlay(id: symbol): boolean {
  return stack.length > 0 && stack[stack.length - 1] === id
}
