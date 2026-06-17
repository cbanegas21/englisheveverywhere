// Lock body scroll for an overlay (modal / drawer / sidebar) WITHOUT the page
// shifting sideways. Plain `overflow:hidden` removes the desktop vertical scrollbar,
// which widens the viewport ~15px and jumps all content right (and back on close) —
// a visible "UI jump". We add the scrollbar's width as body right-padding while
// locked so the layout stays put. Captures + restores the previous inline values,
// so nested overlays (a Modal over a Drawer) compose correctly (LIFO).
// Returns an unlock fn. Call only in the browser (inside an effect).
export function lockBodyScroll(): () => void {
  const body = document.body
  const prevOverflow = body.style.overflow
  const prevPad = body.style.paddingRight
  // 0 when there is no scrollbar (mobile/overlay scrollbars, or already locked).
  const scrollbar = window.innerWidth - document.documentElement.clientWidth
  body.style.overflow = 'hidden'
  if (scrollbar > 0) body.style.paddingRight = `${(parseFloat(prevPad) || 0) + scrollbar}px`
  return () => {
    body.style.overflow = prevOverflow
    body.style.paddingRight = prevPad
  }
}
