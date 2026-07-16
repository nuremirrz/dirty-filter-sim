import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type { SceneContext } from './scene'

// BASE_URL keeps the path relative (base: './') so it works when embedded in an iframe.
const MODEL_URL = import.meta.env.BASE_URL + 'house_hvac.glb'

// The objects the rest of the simulation will rely on. This is the main skeleton check.
const REQUIRED_OBJECTS = ['house_shell', 'supply_duct', 'return_grille', 'filter']

/**
 * Loads house_hvac.glb (plain GLTFLoader, no Draco), adds it to the scene,
 * logs the scene hierarchy, verifies the required named objects exist, and
 * frames the camera on the model.
 */
export function loadModel(ctx: SceneContext): void {
  const loader = new GLTFLoader()
  console.log(`Loading model: ${MODEL_URL}`)

  loader.load(
    MODEL_URL,
    (gltf) => {
      ctx.scene.add(gltf.scene)
      console.log('✅ Model loaded')

      logHierarchy(gltf.scene)
      checkRequiredObjects(gltf.scene)
      frameCamera(ctx, gltf.scene)
    },
    undefined,
    (error) => {
      console.error(`❌ Failed to load model at "${MODEL_URL}"`)
      console.error(error)
    },
  )
}

/** Logs the full object tree so real mesh names are visible if a lookup fails. */
function logHierarchy(root: THREE.Object3D): void {
  console.log('--- Scene hierarchy ---')
  const walk = (obj: THREE.Object3D, depth: number) => {
    const indent = '  '.repeat(depth)
    console.log(`${indent}${obj.type}: ${obj.name || '(unnamed)'}`)
    for (const child of obj.children) {
      walk(child, depth + 1)
    }
  }
  walk(root, 0)
}

/** Verifies every required object exists; ✅ found / ❌ MISSING per name. */
function checkRequiredObjects(root: THREE.Object3D): void {
  console.log('--- Required object check ---')
  for (const name of REQUIRED_OBJECTS) {
    const found = root.getObjectByName(name)
    if (found) {
      console.log(`✅ found: ${name}`)
    } else {
      console.error(`❌ MISSING: ${name}`)
    }
  }
}

/**
 * Centers and frames the camera on the loaded model using its bounding box,
 * so the whole house is in view without hunting for it manually.
 */
function frameCamera(ctx: SceneContext, model: THREE.Object3D): void {
  const box = new THREE.Box3().setFromObject(model)
  const size = box.getSize(new THREE.Vector3())
  const center = box.getCenter(new THREE.Vector3())

  const maxDim = Math.max(size.x, size.y, size.z)
  const fov = ctx.camera.fov * (Math.PI / 180)
  const distance = (maxDim / (2 * Math.tan(fov / 2))) * 1.5 // *1.5 = padding

  const dir = new THREE.Vector3(1, 0.7, 1).normalize()
  ctx.camera.position.copy(center).addScaledVector(dir, distance)
  ctx.camera.near = Math.max(distance / 100, 0.01)
  ctx.camera.far = distance * 100
  ctx.camera.updateProjectionMatrix()
  ctx.camera.lookAt(center)

  ctx.controls.target.copy(center)
  ctx.controls.update()
}
