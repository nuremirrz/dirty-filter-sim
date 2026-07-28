import * as THREE from 'three'
import type { SceneContext } from './scene'
import { activeCameraPreset } from './cameras'
import { t, onChange } from './i18n'

// Which model node marks each station's position on the plan.
const STATIONS = [
  { key: 'supply_air', node: 'supply_duct' },
  { key: 'return_air', node: 'return_grille' },
  { key: 'air_filter', node: 'filter' },
]

// Plan orientation (tuned so the layout reads naturally against the 3D view).
const FLIP_X = true
const FLIP_Z = false

const W = 190
const H = 140
const PAD = 22

// Return and filter sit at the same spot on a plan (the filter is behind the
// return grille), so nudge the filter dot down to keep all three readable.
const NUDGE_Y: Record<string, number> = { air_filter: 16 }
// Where each dot's label sits, so the return/filter labels don't collide.
const LABEL_ABOVE = new Set(['return_air'])

interface Spot {
  key: string
  x: number
  z: number
}

export interface MinimapApi {
  /** Reads station positions from the loaded model. Call once, post-load. */
  syncModel: () => void
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)

/**
 * Bottom-right minimap: a drawn top-down plan with a dot per station (the active
 * one highlighted) and a marker showing where the camera is and which way it
 * looks. Purely an orientation aid; it never drives the camera.
 */
export function createMinimap(ctx: SceneContext): MinimapApi {
  const panel = document.createElement('div')
  panel.style.cssText = [
    'position:fixed',
    'bottom:16px',
    'right:16px',
    'z-index:20',
    'padding:10px 12px 12px',
    'background:#ffffff',
    'border:1px solid rgba(0,0,0,0.08)',
    'border-radius:12px',
    'box-shadow:0 6px 20px rgba(0,0,0,0.14)',
    'font-family:system-ui,-apple-system,Segoe UI,Arial,sans-serif',
  ].join(';')

  const caption = document.createElement('div')
  caption.style.cssText =
    'font-size:11px;font-weight:600;letter-spacing:0.06em;color:#8a94a6;margin-bottom:6px'

  const canvas = document.createElement('canvas')
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  canvas.width = W * dpr
  canvas.height = H * dpr
  canvas.style.cssText = `display:block;width:${W}px;height:${H}px;border-radius:8px;background:#eef1f5`
  const g = canvas.getContext('2d')!
  g.scale(dpr, dpr)

  panel.append(caption, canvas)
  document.body.appendChild(panel)

  let spots: Spot[] = []
  let bounds = { minX: 0, maxX: 1, minZ: 0, maxZ: 1 }

  const syncModel = () => {
    spots = []
    const center = new THREE.Vector3()
    for (const s of STATIONS) {
      const node = ctx.scene.getObjectByName(s.node)
      if (!node) continue
      new THREE.Box3().setFromObject(node).getCenter(center)
      spots.push({ key: s.key, x: center.x, z: center.z })
    }
    if (!spots.length) return
    // Frame the stations with a generous margin so they sit well inside the plan.
    const xs = spots.map((s) => s.x)
    const zs = spots.map((s) => s.z)
    const minX = Math.min(...xs)
    const maxX = Math.max(...xs)
    const minZ = Math.min(...zs)
    const maxZ = Math.max(...zs)
    const ex = Math.max((maxX - minX) * 0.6, 1)
    const ez = Math.max((maxZ - minZ) * 0.6, 1)
    bounds = { minX: minX - ex, maxX: maxX + ex, minZ: minZ - ez, maxZ: maxZ + ez }
  }

  const toMap = (x: number, z: number): { x: number; y: number } => {
    let nx = (x - bounds.minX) / (bounds.maxX - bounds.minX)
    let nz = (z - bounds.minZ) / (bounds.maxZ - bounds.minZ)
    if (FLIP_X) nx = 1 - nx
    if (FLIP_Z) nz = 1 - nz
    return {
      x: PAD + clamp01(nx) * (W - 2 * PAD),
      y: PAD + clamp01(nz) * (H - 2 * PAD),
    }
  }

  const draw = () => {
    g.clearRect(0, 0, W, H)

    // Plan frame.
    g.strokeStyle = 'rgba(0,0,0,0.10)'
    g.lineWidth = 1
    g.strokeRect(6, 6, W - 12, H - 12)

    const active = activeCameraPreset()

    // Camera marker: position + a short ray toward what it looks at.
    const cam = toMap(ctx.camera.position.x, ctx.camera.position.z)
    const tgt = toMap(ctx.controls.target.x, ctx.controls.target.z)
    const dx = tgt.x - cam.x
    const dy = tgt.y - cam.y
    const len = Math.hypot(dx, dy) || 1
    g.strokeStyle = 'rgba(31,36,48,0.35)'
    g.lineWidth = 2
    g.beginPath()
    g.moveTo(cam.x, cam.y)
    g.lineTo(cam.x + (dx / len) * 20, cam.y + (dy / len) * 20)
    g.stroke()

    // Station dots + labels (active one accented and larger).
    g.textAlign = 'center'
    g.font = '600 9px system-ui,-apple-system,sans-serif'
    for (const s of spots) {
      const p = toMap(s.x, s.z)
      p.y += NUDGE_Y[s.key] ?? 0
      const on = s.key === active
      if (on) {
        g.beginPath()
        g.arc(p.x, p.y, 9, 0, Math.PI * 2)
        g.strokeStyle = 'rgba(47,109,246,0.5)'
        g.lineWidth = 2
        g.stroke()
      }
      g.beginPath()
      g.arc(p.x, p.y, on ? 6 : 4, 0, Math.PI * 2)
      g.fillStyle = on ? '#2f6df6' : '#9aa3b2'
      g.fill()
      g.fillStyle = on ? '#2f6df6' : '#6b7280'
      g.fillText(t(`camera.${s.key}`), p.x, LABEL_ABOVE.has(s.key) ? p.y - 11 : p.y + 16)
    }

    // Camera dot on top.
    g.beginPath()
    g.arc(cam.x, cam.y, 3.5, 0, Math.PI * 2)
    g.fillStyle = '#1f2430'
    g.fill()
    g.strokeStyle = '#ffffff'
    g.lineWidth = 1.5
    g.stroke()
  }

  const fill = () => {
    caption.textContent = t('ui.map')
  }
  fill()
  onChange(fill)

  ctx.onFrame(draw) // redraw so the camera marker tracks flights/orbiting

  return { syncModel }
}
