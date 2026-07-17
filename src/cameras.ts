import * as THREE from 'three'
import type { SceneContext } from './scene'

export interface CameraPreset {
  name: string
  position: { x: number; y: number; z: number }
  target: { x: number; y: number; z: number }
}

// Fixed inspection viewpoints, named for the HVAC stage each one frames.
export const CAMERA_PRESETS: CameraPreset[] = [
  {
    name: 'system_overview',
    position: { x: 6.29, y: 1.6, z: -12.54 },
    target: { x: 1.13, y: 2.98, z: 0.82 },
  },
  {
    name: 'supply_air',
    position: { x: 4.62, y: 1.43, z: -1.08 },
    target: { x: 4.17, y: 2.84, z: 0.71 },
  },
  {
    name: 'return_air',
    position: { x: 2.05, y: 0.19, z: -0.34 },
    target: { x: 2.05, y: 2.84, z: 0.71 },
  },
  {
    name: 'air_filter',
    position: { x: 2.01, y: 1.44, z: 0.68 },
    target: { x: 2.01, y: 3.13, z: 0.71 },
  },
]

// The preset the camera was last sent to. Lets other modules tell whether we are
// already looking through a given object's camera.
let activePreset: string | null = null

/** Name of the preset the camera was last sent to, if any. */
export function activeCameraPreset(): string | null {
  return activePreset
}

/** Snaps the camera + OrbitControls target to a preset pose (instant cut). */
export function applyCameraPreset(ctx: SceneContext, preset: CameraPreset): void {
  activePreset = preset.name
  ctx.camera.position.set(preset.position.x, preset.position.y, preset.position.z)
  ctx.controls.target.set(preset.target.x, preset.target.y, preset.target.z)
  ctx.controls.update()
}

/** Applies the default starting camera — the first preset (system overview). */
export function applyStartCamera(ctx: SceneContext): void {
  applyCameraPreset(ctx, CAMERA_PRESETS[0])
}

interface CameraFlight {
  fromPos: THREE.Vector3
  toPos: THREE.Vector3
  fromTarget: THREE.Vector3
  toTarget: THREE.Vector3
  elapsed: number
  duration: number
}

let flight: CameraFlight | null = null

const easeInOutCubic = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2

/**
 * Drives smooth camera flights and lets user input win: grabbing the mouse
 * cancels the flight in progress. Call once, right after createScene.
 */
export function initCameraMotion(ctx: SceneContext): void {
  ctx.onFrame((dt) => {
    if (!flight) return
    flight.elapsed += dt
    const t = Math.min(1, flight.elapsed / flight.duration)
    const eased = easeInOutCubic(t)
    ctx.camera.position.lerpVectors(flight.fromPos, flight.toPos, eased)
    ctx.controls.target.lerpVectors(flight.fromTarget, flight.toTarget, eased)
    if (t >= 1) flight = null
  })

  ctx.controls.addEventListener('start', () => {
    flight = null
  })
}

/** Smoothly flies the camera to a preset instead of cutting to it. */
export function flyToCameraPreset(
  ctx: SceneContext,
  preset: CameraPreset,
  duration = 0.8,
): void {
  activePreset = preset.name
  flight = {
    fromPos: ctx.camera.position.clone(),
    toPos: new THREE.Vector3(preset.position.x, preset.position.y, preset.position.z),
    fromTarget: ctx.controls.target.clone(),
    toTarget: new THREE.Vector3(preset.target.x, preset.target.y, preset.target.z),
    elapsed: 0,
    duration,
  }
}

/** Flies to a preset by name; returns false if there is no such preset. */
export function flyToCameraPresetByName(ctx: SceneContext, name: string): boolean {
  const preset = CAMERA_PRESETS.find((p) => p.name === name)
  if (!preset) return false
  flyToCameraPreset(ctx, preset)
  return true
}

/** A styled button for the camera panel. */
function makeButton(label: string): HTMLButtonElement {
  const btn = document.createElement('button')
  btn.textContent = label
  btn.style.cssText = [
    'padding:8px 10px',
    'background:#333',
    'color:#fff',
    'border:1px solid #555',
    'border-radius:6px',
    'cursor:pointer',
    'font:inherit',
    'text-align:left',
  ].join(';')
  btn.addEventListener('mouseenter', () => (btn.style.background = '#444'))
  btn.addEventListener('mouseleave', () => (btn.style.background = '#333'))
  return btn
}

/**
 * Fixed-camera panel (bottom-right): one button per preset that flies the camera
 * to it. Buttons are labelled with the preset names.
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
  header.textContent = '📷 Камеры'
  header.style.cssText = [
    'padding:8px 10px',
    'background:rgba(0,0,0,0.6)',
    'color:#eee',
    'border-radius:6px',
  ].join(';')
  panel.appendChild(header)

  for (const preset of CAMERA_PRESETS) {
    const btn = makeButton(preset.name)
    btn.addEventListener('click', () => flyToCameraPreset(ctx, preset))
    panel.appendChild(btn)
  }

  document.body.appendChild(panel)
}
