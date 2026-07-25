import { t, onChange } from './i18n'

// Reference "Level complete" card, copied verbatim from the platform's canonical
// overlay. Only two adaptations for this project (no stylesheet / theme vars):
//   - the theme vars --accent/--ok are defined here rather than inherited;
//   - z-index sits above this sim's HUD (which uses z-index 20).
const CSS = `
:root { --accent: #2f6df6; --ok: #25a55a; }
.overlay {
  position: fixed; inset: 0; z-index: 50;
  display: flex; align-items: center; justify-content: center;
  background: rgba(20, 22, 28, 0.55);
  opacity: 0; pointer-events: none;
  transition: opacity 0.4s;
  font-family: "Segoe UI", system-ui, -apple-system, Arial, sans-serif;
}
.overlay.show { opacity: 1; pointer-events: auto; }
.card {
  background: #fff; border-radius: 20px; padding: 30px 34px;
  width: 360px; text-align: center;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.35);
  transform: scale(0.9);
  transition: transform 0.4s cubic-bezier(0.2, 1.2, 0.3, 1);
}
.overlay.show .card { transform: scale(1); }
.card .emoji { font-size: 44px; }
.card h2 { margin: 8px 0 2px; color: var(--ok); font-size: 24px; }
.card .sub { color: #6b7280; font-size: 14px; font-weight: 600; margin-bottom: 16px; }
.card .stats {
  background: #f4f5f7; border-radius: 12px; padding: 14px;
  font-size: 15px; line-height: 1.7; color: #333;
}
.card button {
  margin-top: 18px; background: var(--accent); color: #fff; border: none;
  padding: 12px 22px; font-size: 15px; font-weight: 600;
  border-radius: 10px; cursor: pointer;
}
.card button:hover { filter: brightness(1.05); }
`

export interface OverlayApi {
  /** Reveals the result card after the spec's 600 ms beat. Idempotent. */
  show: () => void
}

/**
 * The level-complete result card. Hidden at start; show() fades it in on a 600 ms
 * delay. Texts come from i18n and re-render on locale change (even while open).
 * Restart reloads the iframe — the simplest full reset for this level.
 */
export function createResultOverlay(): OverlayApi {
  const style = document.createElement('style')
  style.textContent = CSS
  document.head.appendChild(style)

  const overlay = document.createElement('div')
  overlay.className = 'overlay'
  // Emoji/symbols are literals (not translated); [data-t] text comes from t().
  overlay.innerHTML = `
    <div class="card">
      <div class="emoji">🎉</div>
      <h2 data-t="title"></h2>
      <div class="sub" data-t="sub"></div>
      <div class="stats">
        <div>⭐⭐⭐ <span data-t="rating"></span></div>
        <div>🏆 <span data-t="points"></span></div>
        <div>✅ <span data-t="progress"></span></div>
      </div>
      <button id="replay"></button>
    </div>`
  document.body.appendChild(overlay)

  const replay = overlay.querySelector('#replay') as HTMLButtonElement
  replay.addEventListener('click', () => location.reload())

  const fill = () => {
    for (const el of overlay.querySelectorAll('[data-t]')) {
      const key = el.getAttribute('data-t')
      if (key) el.textContent = t(`overlay.${key}`)
    }
    replay.textContent = `${t('overlay.replay')} ↻`
  }
  fill()
  onChange(fill) // re-render texts on locale change, even if already open

  let shown = false
  return {
    show: () => {
      if (shown) return
      shown = true
      setTimeout(() => overlay.classList.add('show'), 600)
    },
  }
}
