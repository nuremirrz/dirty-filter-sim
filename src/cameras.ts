import type { SceneContext } from './scene'
import { makeButton } from './ui'

export interface CameraPreset {
  name: string
  position: { x: number; y: number; z: number }
  target: { x: number; y: number; z: number }
}

// FNAF-style fixed camera points, captured with the debug picker.
export const CAMERA_PRESETS: CameraPreset[] = [
  {
    name: 'overview',
    position: { x: 6.29, y: 1.6, z: -12.54 },
    target: { x: 1.13, y: 2.98, z: 0.82 },
  },
  {
    name: 'supply_duct',
    position: { x: 4.62, y: 1.43, z: -1.08 },
    target: { x: 4.17, y: 2.84, z: 0.71 },
  },
  {
    name: 'return_grille',
    position: { x: 2.05, y: 0.19, z: -0.34 },
    target: { x: 2.05, y: 2.84, z: 0.71 },
  },
  {
    name: 'filter',
    position: { x: 2.01, y: 1.44, z: 0.68 },
    target: { x: 2.01, y: 3.13, z: 0.71 },
  },
]

/** Snaps the camera + OrbitControls target to a preset pose (instant cut). */
export function applyCameraPreset(ctx: SceneContext, preset: CameraPreset): void {
  ctx.camera.position.set(preset.position.x, preset.position.y, preset.position.z)
  ctx.controls.target.set(preset.target.x, preset.target.y, preset.target.z)
  ctx.controls.update()
}

/** Applies the default starting camera — the first preset (overview). */
export function applyStartCamera(ctx: SceneContext): void {
  applyCameraPreset(ctx, CAMERA_PRESETS[0])
}

/**
 * TEMPORARY debug panel (top-right): one button per saved FNAF preset that snaps
 * the camera to it, so the captured angles can be reviewed. OrbitControls stay
 * active, so you can still orbit from a preset to fine-tune.
 */
export function createCameraSwitcher(ctx: SceneContext): void {
  const panel = document.createElement('div')
  panel.style.cssText = [
    'position:fixed',
    'bottom:12px',
    'right:12px',
    'z-index:10',
    'display:flex',
    'flex-direction:column',
    'gap:8px',
    'min-width:180px',
    'font-family:system-ui,-apple-system,sans-serif',
    'font-size:13px',
  ].join(';')

  const header = document.createElement('div')
  header.textContent = '📷 Камеры (пресеты)'
  header.style.cssText = [
    'padding:8px 10px',
    'background:rgba(0,0,0,0.6)',
    'color:#eee',
    'border-radius:6px',
  ].join(';')
  panel.appendChild(header)

  for (const preset of CAMERA_PRESETS) {
    const btn = makeButton(preset.name)
    btn.addEventListener('click', () => applyCameraPreset(ctx, preset))
    panel.appendChild(btn)
  }

  document.body.appendChild(panel)
}
