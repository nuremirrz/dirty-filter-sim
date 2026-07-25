import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type { SceneContext } from './scene'

// BASE_URL keeps the path relative (base: './') so it works when embedded in an iframe.
const MODEL_URL = import.meta.env.BASE_URL + 'house_hvac.glb'

/**
 * Loads house_hvac.glb (plain GLTFLoader, no Draco) and adds it to the scene.
 * Camera framing is handled by the overview preset.
 */
export function loadModel(ctx: SceneContext, onLoaded?: () => void): void {
  const loader = new GLTFLoader()

  loader.load(
    MODEL_URL,
    (gltf) => {
      ctx.scene.add(gltf.scene)
      // Refresh world matrices so getWorldPosition queries are accurate at once.
      ctx.scene.updateMatrixWorld(true)
      onLoaded?.()
    },
    undefined,
    (error) => {
      console.error(`Failed to load model at "${MODEL_URL}"`)
      console.error(error)
    },
  )
}
