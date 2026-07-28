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

// Fires whenever the camera is sent to a preset (cut or flight). The inspect
// view listens so it can drop its "closer look" state once the camera leaves.
const presetListeners = new Set<() => void>()

/** Subscribes to "camera sent to a preset" events; returns an unsubscribe fn. */
export function onPresetFly(cb: () => void): () => void {
  presetListeners.add(cb)
  return () => presetListeners.delete(cb)
}

function goToPreset(name: string): void {
  activePreset = name
  for (const cb of presetListeners) cb()
}

/** Name of the preset the camera was last sent to, if any. */
export function activeCameraPreset(): string | null {
  return activePreset
}

/** Snaps the camera + OrbitControls target to a preset pose (instant cut). */
export function applyCameraPreset(ctx: SceneContext, preset: CameraPreset): void {
  goToPreset(preset.name)
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
  goToPreset(preset.name)
  flyToPose(ctx, preset.position, preset.target, duration)
}

/**
 * Flies to an arbitrary pose without changing the active preset. Used by the
 * inspect view to close in on the current station's object and back out again,
 * so the strip/breadcrumbs keep showing that station throughout.
 */
export function flyToPose(
  ctx: SceneContext,
  position: { x: number; y: number; z: number },
  target: { x: number; y: number; z: number },
  duration = 0.6,
): void {
  flight = {
    fromPos: ctx.camera.position.clone(),
    toPos: new THREE.Vector3(position.x, position.y, position.z),
    fromTarget: ctx.controls.target.clone(),
    toTarget: new THREE.Vector3(target.x, target.y, target.z),
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
