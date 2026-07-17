import * as THREE from 'three'
import type { SceneContext } from './scene'
import { AIRFLOW_READINGS, type GameState } from './state'
import { t } from './i18n'

// Radians per second per m/s of airflow. Tuned for readability rather than
// realism: 0.7 m/s reads as a lazy turn, 2.5 m/s as a brisk one.
const SPIN_PER_MS = 4

// Node names inside house_hvac.glb.
const ROOT_NAME = 'anemometer'
const IMPELLER_NAME = 'impeller'
// Leftover helper plane from an earlier modelling attempt; hidden if still present.
const LEGACY_PLANE_NAME = 'display'

// The LCD is part of the artwork in the shared "Anemometer" atlas, at this pixel
// rect. Drawing into the atlas puts the reading exactly on the screen with no
// extra geometry. The panel is mirrored horizontally in the atlas (its printed
// labels read backwards), so text has to be mirrored to come out readable.
const SCREEN = { x: 828, y: 808, w: 170, h: 130 }
const SCREEN_BACKLIGHT = '#8fae86'
const SCREEN_INK = '#1b2a1b'

interface Screen {
  render: (reading: number | undefined) => void
}

export interface AnemometerApi {
  /**
   * Shows/hides the device and sets its impeller spin from `state`, and paints
   * `revealed` on the LCD. The two are deliberately separate: the device is in
   * the airflow (so it is visible and spinning) as soon as the step begins, but
   * its screen stays blank until the player actually takes the reading.
   */
  setState: (state: GameState, revealed: number | undefined) => void
}

/**
 * Owns the anemometer's visuals: it is only visible while measuring, its
 * impeller spins at a rate proportional to the airflow, and its LCD shows the
 * same reading the HUD does.
 */
export function createAnemometer(ctx: SceneContext): AnemometerApi {
  let spinRate = 0 // rad/sec
  let root: THREE.Object3D | null = null
  let impeller: THREE.Object3D | null = null
  let screen: Screen | null = null

  // The GLB loads asynchronously, so keep retrying until the nodes show up.
  const resolveNodes = () => {
    root ??= ctx.scene.getObjectByName(ROOT_NAME) ?? null
    impeller ??= ctx.scene.getObjectByName(IMPELLER_NAME) ?? null
    if (!screen && root) screen = createScreen(root)
    const legacy = ctx.scene.getObjectByName(LEGACY_PLANE_NAME)
    if (legacy) legacy.visible = false
  }

  // The impeller disc lies in its local XY plane, so it spins around Z.
  ctx.onFrame((dt) => {
    if (spinRate === 0) return
    resolveNodes()
    if (impeller) impeller.rotation.z += spinRate * dt
  })

  return {
    setState(state, revealed) {
      resolveNodes()
      const airflow = AIRFLOW_READINGS[state]
      const measuring = airflow !== undefined
      if (root) root.visible = measuring
      spinRate = measuring ? airflow * SPIN_PER_MS : 0
      screen?.render(revealed)
    },
  }
}

/** The device's meshes all share one textured material — this finds it. */
function findAtlasMaterial(root: THREE.Object3D): THREE.MeshStandardMaterial | null {
  const found: THREE.MeshStandardMaterial[] = []
  root.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return
    const mat = obj.material
    if (!Array.isArray(mat) && mat instanceof THREE.MeshStandardMaterial && mat.map) {
      found.push(mat)
    }
  })
  return found[0] ?? null
}

/**
 * Swaps the device's atlas for canvas copies we can repaint: one for base color
 * (artwork + reading) and one for emission (black except the screen, so only the
 * LCD glows instead of the whole device).
 */
function createScreen(root: THREE.Object3D): Screen | null {
  const material = findAtlasMaterial(root)
  const src = material?.map
  if (!material || !src?.image) return null

  const image = src.image as CanvasImageSource & { width: number; height: number }

  const makeCanvas = () => {
    const canvas = document.createElement('canvas')
    canvas.width = image.width
    canvas.height = image.height
    return canvas
  }
  const baseCanvas = makeCanvas()
  const emisCanvas = makeCanvas()
  const baseCtx = baseCanvas.getContext('2d')
  const emisCtx = emisCanvas.getContext('2d')
  if (!baseCtx || !emisCtx) return null

  // Match the source texture's sampling so the atlas keeps lining up.
  const configure = (tex: THREE.CanvasTexture) => {
    tex.flipY = src.flipY
    tex.colorSpace = src.colorSpace
    tex.wrapS = src.wrapS
    tex.wrapT = src.wrapT
    return tex
  }
  const baseTex = configure(new THREE.CanvasTexture(baseCanvas))
  const emisTex = configure(new THREE.CanvasTexture(emisCanvas))

  material.map = baseTex
  material.emissiveMap = emisTex
  material.emissive = new THREE.Color(0xffffff)
  material.needsUpdate = true

  /**
   * Draws the reading inside the screen. The screen's UV island is mirrored
   * vertically in the atlas, so the drawing frame is flipped on Y to cancel that
   * out; no rotation is involved. Origin is the screen's centre, and the frame
   * spans SCREEN.w x SCREEN.h.
   */
  const paintReading = (c: CanvasRenderingContext2D, reading: number | undefined) => {
    if (reading === undefined) return
    c.save()
    c.beginPath()
    c.rect(SCREEN.x, SCREEN.y, SCREEN.w, SCREEN.h)
    c.clip()
    c.translate(SCREEN.x + SCREEN.w / 2, SCREEN.y + SCREEN.h / 2)
    c.scale(1, -1)
    c.fillStyle = SCREEN_INK
    c.textAlign = 'center'
    c.textBaseline = 'middle'
    c.font = 'bold 54px monospace'
    c.fillText(reading.toFixed(1), 0, -SCREEN.h * 0.12)
    c.font = 'bold 24px monospace'
    c.fillText(t('anem.unit'), 0, SCREEN.h * 0.28)
    c.restore()
  }

  return {
    render(reading) {
      baseCtx.drawImage(image, 0, 0)
      paintReading(baseCtx, reading)

      emisCtx.fillStyle = '#000'
      emisCtx.fillRect(0, 0, emisCanvas.width, emisCanvas.height)
      // The backlight is on whenever the device is out — only the digits wait for
      // the reading, so a blank screen reads as "powered", not "dead".
      emisCtx.fillStyle = SCREEN_BACKLIGHT
      emisCtx.fillRect(SCREEN.x, SCREEN.y, SCREEN.w, SCREEN.h)
      paintReading(emisCtx, reading)

      baseTex.needsUpdate = true
      emisTex.needsUpdate = true
    },
  }
}
