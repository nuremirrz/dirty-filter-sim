import * as THREE from 'three'
import type { SceneContext } from './scene'
import { CAMERA_PRESETS, flyToCameraPreset, activeCameraPreset, type CameraPreset } from './cameras'
import { t, onChange } from './i18n'

// Snapshots are rendered at ~3.5x the on-screen card size and downscaled by the
// browser, which supersamples away the aliasing a small direct render would show.
const THUMB_W = 480
const THUMB_H = 270

export interface CameraStripApi {
  /** Renders a still of each preset from the loaded model. Call once, post-load. */
  capture: () => void
}

interface Card {
  root: HTMLButtonElement
  img: HTMLImageElement
  label: HTMLDivElement
  preset: CameraPreset
}

/**
 * Bottom-center camera strip: one thumbnail per preset, click to fly there. The
 * thumbnails are static stills captured from the 3D scene once the model loads,
 * and the card of the currently-framed preset is highlighted (the scripted flow
 * changes cameras too, not just clicks).
 */
export function createCameraStrip(ctx: SceneContext): CameraStripApi {
  const strip = document.createElement('div')
  strip.style.cssText = [
    'position:fixed',
    'bottom:16px',
    'left:50%',
    'transform:translateX(-50%)',
    'z-index:20',
    'display:flex',
    'gap:10px',
    'font-family:system-ui,-apple-system,Segoe UI,Arial,sans-serif',
  ].join(';')

  const cards: Card[] = CAMERA_PRESETS.map((preset) => {
    const root = document.createElement('button')
    root.style.cssText = [
      'width:132px',
      'padding:0',
      'background:#ffffff',
      'border:2px solid rgba(0,0,0,0.10)',
      'border-radius:12px',
      'overflow:hidden',
      'cursor:pointer',
      'box-shadow:0 4px 14px rgba(0,0,0,0.14)',
      'transition:border-color .15s, transform .15s',
      'display:block',
    ].join(';')

    const img = document.createElement('img')
    img.alt = ''
    img.style.cssText = [
      'display:block',
      'width:100%',
      'height:74px',
      'object-fit:cover',
      'background:#d7dbe0', // placeholder tone until the still is captured
    ].join(';')

    const label = document.createElement('div')
    label.style.cssText = [
      'padding:6px 8px',
      'font-size:12px',
      'font-weight:600',
      'color:#374151',
      'text-align:center',
      'white-space:nowrap',
      'overflow:hidden',
      'text-overflow:ellipsis',
    ].join(';')

    root.append(img, label)
    root.addEventListener('click', () => flyToCameraPreset(ctx, preset)) // preset.name unchanged
    root.addEventListener('mouseenter', () => {
      if (activeCameraPreset() !== preset.name) root.style.borderColor = 'rgba(47,109,246,0.5)'
    })
    root.addEventListener('mouseleave', applyActive)
    strip.appendChild(root)
    return { root, img, label, preset }
  })

  document.body.appendChild(strip)

  // Highlight whichever preset is currently framed. Reused on hover-out so the
  // hover tint always resolves back to the real active state.
  function applyActive(): void {
    const active = activeCameraPreset()
    for (const card of cards) {
      const on = card.preset.name === active
      card.root.style.borderColor = on ? '#2f6df6' : 'rgba(0,0,0,0.10)'
      card.root.style.transform = on ? 'translateY(-3px)' : 'none'
    }
  }

  // The flow flies the camera around without telling us, so poll the active
  // preset and only touch the DOM when it actually changes.
  let activeShown: string | null = null
  ctx.onFrame(() => {
    if (activeCameraPreset() !== activeShown) {
      activeShown = activeCameraPreset()
      applyActive()
    }
  })

  const fill = () => {
    for (const card of cards) card.label.textContent = t(`camera.${card.preset.name}`)
  }
  fill()
  onChange(fill) // re-render captions on locale change (set-locale / ?lang)

  const capture = () => {
    const rt = new THREE.WebGLRenderTarget(THUMB_W, THUMB_H)
    rt.texture.colorSpace = THREE.SRGBColorSpace // encode like the on-screen output
    // A throwaway camera matching the main one's lens, so stills frame like flights.
    const cam = new THREE.PerspectiveCamera(
      ctx.camera.fov,
      THUMB_W / THUMB_H,
      ctx.camera.near,
      ctx.camera.far,
    )
    const buf = new Uint8Array(THUMB_W * THUMB_H * 4)

    for (const card of cards) {
      const p = card.preset
      cam.position.set(p.position.x, p.position.y, p.position.z)
      cam.lookAt(p.target.x, p.target.y, p.target.z)
      cam.updateMatrixWorld(true)

      ctx.renderer.setRenderTarget(rt)
      ctx.renderer.render(ctx.scene, cam) // plain render — no outline/hover decorations
      ctx.renderer.readRenderTargetPixels(rt, 0, 0, THUMB_W, THUMB_H, buf)
      ctx.renderer.setRenderTarget(null)

      card.img.src = toDataURL(buf)
    }

    rt.dispose()
  }

  return { capture }
}

/** Turns a bottom-up RGBA pixel buffer (WebGL order) into a top-down PNG data URL. */
function toDataURL(buf: Uint8Array): string {
  const canvas = document.createElement('canvas')
  canvas.width = THUMB_W
  canvas.height = THUMB_H
  const c = canvas.getContext('2d')!
  const image = c.createImageData(THUMB_W, THUMB_H)
  const rowBytes = THUMB_W * 4
  for (let y = 0; y < THUMB_H; y++) {
    const src = (THUMB_H - 1 - y) * rowBytes // flip vertically into canvas order
    image.data.set(buf.subarray(src, src + rowBytes), y * rowBytes)
  }
  c.putImageData(image, 0, 0)
  return canvas.toDataURL()
}
