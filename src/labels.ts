import * as THREE from 'three'
import type { SceneContext } from './scene'
import type { GameState } from './state'
import { t, onChange } from './i18n'

// GLB object each label rides on, and its i18n key.
const LABELS: { object: string; key: string }[] = [
  { object: 'supply_duct', key: 'label.supply' },
  { object: 'return_grille', key: 'label.return' },
  { object: 'filter', key: 'label.filter' },
]

// Which object the current step points at. States absent from this map show
// nothing (overview = clean start, complete = solved).
const STATE_TARGET: Partial<Record<GameState, string>> = {
  measure_low: 'supply_duct',
  locate_grille: 'return_grille',
  open_grille: 'return_grille',
  replace_filter: 'filter',
  close_grille: 'return_grille',
  measure_ok: 'supply_duct',
}

// Meters above the object's world origin, so the tag floats clear of the object.
const LABEL_Y_OFFSET = 0.6

export interface HintsApi {
  /** Points the label + pulsing outline at the object relevant to `state`. */
  update: (state: GameState) => void
}

/**
 * Billboard labels + active-object highlight, driven by game state. Only the
 * object relevant to the current step is tagged and outlined; everything else
 * is hidden. Labels are HTML divs whose world anchor is projected to the screen
 * every frame, which needs no render-pipeline changes.
 */
export function createHints(ctx: SceneContext): HintsApi {
  const container = document.createElement('div')
  container.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:15'
  document.body.appendChild(container)

  const labels = new Map<string, { el: HTMLDivElement; key: string }>()
  for (const { object, key } of LABELS) {
    const el = document.createElement('div')
    el.style.cssText = [
      'position:absolute',
      'transform:translate(-50%,-100%)',
      'padding:4px 10px',
      'background:rgba(0,0,0,0.7)',
      'color:#fff',
      'border-radius:8px',
      'font:500 13px system-ui,-apple-system,sans-serif',
      'white-space:nowrap',
      'display:none',
    ].join(';')
    container.appendChild(el)
    labels.set(object, { el, key })
  }

  const applyText = () => {
    for (const { el, key } of labels.values()) el.textContent = t(key)
  }
  applyText()
  onChange(applyText) // re-label on locale change

  let activeName: string | null = null

  // The GLB loads asynchronously, so resolve object nodes lazily.
  const cache = new Map<string, THREE.Object3D>()
  const resolve = (name: string): THREE.Object3D | null => {
    const cached = cache.get(name)
    if (cached) return cached
    const obj = ctx.scene.getObjectByName(name) ?? null
    if (obj) cache.set(name, obj)
    return obj
  }

  const worldPos = new THREE.Vector3()
  ctx.onFrame(() => {
    const activeObj = activeName ? resolve(activeName) : null
    ctx.outlineHint(activeObj)

    for (const [name, { el }] of labels) {
      if (name !== activeName || !activeObj) {
        el.style.display = 'none'
        continue
      }
      activeObj.getWorldPosition(worldPos)
      worldPos.y += LABEL_Y_OFFSET
      worldPos.project(ctx.camera)
      if (worldPos.z > 1) {
        el.style.display = 'none' // behind the camera
        continue
      }
      el.style.left = `${(worldPos.x * 0.5 + 0.5) * window.innerWidth}px`
      el.style.top = `${(-worldPos.y * 0.5 + 0.5) * window.innerHeight}px`
      el.style.display = 'block'
    }
  })

  return {
    update: (state) => {
      activeName = STATE_TARGET[state] ?? null
    },
  }
}
