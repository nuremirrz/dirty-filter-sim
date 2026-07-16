import type { SceneContext } from './scene'
import { makeButton } from './ui'

// Object centers captured earlier — used by the "aim target at object" buttons.
const OBJECT_TARGETS: { name: string; center: [number, number, number] }[] = [
  { name: 'supply_duct', center: [4.17, 2.84, 0.71] },
  { name: 'return_grille', center: [2.05, 2.84, 0.71] },
  { name: 'filter', center: [2.01, 3.13, 0.71] },
]

/**
 * TEMPORARY debug overlay for picking FNAF camera angles.
 *  - "📸" button logs the current camera position + OrbitControls target as a
 *    copy-ready JS object (2-decimal rounded).
 *  - per-object buttons aim controls.target at a known object center so you can
 *    fly the view onto it, then orbit to fine-tune the shot.
 * OrbitControls stay active — the scene is still orbited by mouse.
 */
export function createDebugUi(ctx: SceneContext): void {
  const panel = document.createElement('div')
  panel.style.cssText = [
    'position:fixed',
    'top:12px',
    'left:12px',
    'z-index:10',
    'display:flex',
    'flex-direction:column',
    'gap:8px',
    'max-width:360px',
    'font-family:system-ui,-apple-system,sans-serif',
    'font-size:13px',
  ].join(';')

  // On-screen hint.
  const hint = document.createElement('div')
  hint.textContent =
    'Крути мышью → найди ракурс → жми кнопку → координаты в консоли (F12)'
  hint.style.cssText = [
    'padding:8px 10px',
    'background:rgba(0,0,0,0.6)',
    'color:#eee',
    'border-radius:6px',
    'line-height:1.4',
  ].join(';')

  // Capture button.
  const captureBtn = makeButton('📸 Снять позицию камеры')
  captureBtn.addEventListener('click', () => logCameraPose(ctx))

  // Row of "aim target at object" buttons.
  const targetRow = document.createElement('div')
  targetRow.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap'
  for (const { name, center } of OBJECT_TARGETS) {
    const btn = makeButton(`→ ${name}`)
    btn.addEventListener('click', () => {
      ctx.controls.target.set(center[0], center[1], center[2])
      ctx.controls.update()
    })
    targetRow.appendChild(btn)
  }

  panel.append(hint, captureBtn, targetRow)
  document.body.appendChild(panel)
}

/** Logs the current camera pose as a copy-ready JS object, rounded to 2 decimals. */
function logCameraPose(ctx: SceneContext): void {
  const round2 = (n: number) => Math.round(n * 100) / 100
  const p = ctx.camera.position
  const t = ctx.controls.target
  const snippet =
    '{\n' +
    `  position: { x: ${round2(p.x)}, y: ${round2(p.y)}, z: ${round2(p.z)} },\n` +
    `  target:   { x: ${round2(t.x)}, y: ${round2(t.y)}, z: ${round2(t.z)} }\n` +
    '}'
  console.log('📸 Camera pose (copy this):\n' + snippet)
}
