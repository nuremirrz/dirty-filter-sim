import type { SceneContext } from './scene'
import {
  CAMERA_PRESETS,
  flyToPose,
  flyToCameraPresetByName,
  activeCameraPreset,
  onPresetFly,
} from './cameras'

// Stations you can look closer at — everything except the wide overview.
const INSPECTABLE = new Set(['supply_air', 'return_air', 'air_filter'])
// Fraction of the station's distance to its target that the inspect pose keeps
// (0.5 → half the distance, i.e. twice as close). Target (aim) stays the same.
const INSPECT_CLOSE = 0.5

export interface InspectApi {
  isInspecting: () => boolean
  /** The station that can be inspected right now (active + inspectable), else null. */
  inspectable: () => string | null
  enter: () => void
  exit: () => void
  /** Fires when the inspect state changes (enter/exit). */
  onChange: (cb: () => void) => void
}

/**
 * "Look closer" view: from an object station, fly to a tighter pose for a closer
 * look, and Esc / exit() flies back to that station. Purely a viewing aid — it
 * never changes the active preset, and the click-to-act mechanics are untouched.
 */
export function createInspect(ctx: SceneContext): InspectApi {
  let inspecting = false
  let station: string | null = null // the station we closed in from
  const listeners = new Set<() => void>()
  const notify = () => {
    for (const cb of listeners) cb()
  }

  const inspectable = (): string | null => {
    const active = activeCameraPreset()
    return active && INSPECTABLE.has(active) ? active : null
  }

  const enter = () => {
    const name = inspectable()
    if (!name || inspecting) return
    const preset = CAMERA_PRESETS.find((p) => p.name === name)!
    // Slide the camera along its own view ray toward the aim point → closer look.
    const pos = {
      x: preset.target.x + (preset.position.x - preset.target.x) * INSPECT_CLOSE,
      y: preset.target.y + (preset.position.y - preset.target.y) * INSPECT_CLOSE,
      z: preset.target.z + (preset.position.z - preset.target.z) * INSPECT_CLOSE,
    }
    flyToPose(ctx, pos, preset.target) // does not touch the active preset
    inspecting = true
    station = name
    notify()
  }

  const exit = () => {
    if (!inspecting) return
    const back = station
    inspecting = false
    station = null
    notify()
    if (back) flyToCameraPresetByName(ctx, back) // fly back to the station pose
  }

  // Esc backs out of the closer look.
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && inspecting) exit()
  })

  // Any move to a preset (flow, strip, breadcrumb) supersedes the closer look:
  // the camera has already left, so just drop the flag. exit() clears the flag
  // before it flies, so the fly it triggers is a no-op here.
  onPresetFly(() => {
    if (!inspecting) return
    inspecting = false
    station = null
    notify()
  })

  return {
    isInspecting: () => inspecting,
    inspectable,
    enter,
    exit,
    onChange: (cb) => {
      listeners.add(cb)
    },
  }
}
