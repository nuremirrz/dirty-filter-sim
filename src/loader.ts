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
 * tints the debug objects. (Camera framing is handled by the overview preset.)
 */
export function loadModel(ctx: SceneContext): void {
  const loader = new GLTFLoader()
  console.log(`Loading model: ${MODEL_URL}`)

  loader.load(
    MODEL_URL,
    (gltf) => {
      ctx.scene.add(gltf.scene)
      // Refresh world matrices so getWorldPosition / bounding boxes are accurate.
      ctx.scene.updateMatrixWorld(true)
      console.log('✅ Model loaded')

      logHierarchy(gltf.scene)
      checkRequiredObjects(gltf.scene)
      highlightDebugObjects(gltf.scene)
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

// TEMPORARY debug tints so the interactive objects are easy to spot.
// house_shell is intentionally left untouched (stays grey).
const DEBUG_TINTS: { name: string; color: number }[] = [
  { name: 'supply_duct', color: 0x2196f3 }, // blue
  { name: 'return_grille', color: 0xf44336 }, // red
  { name: 'filter', color: 0xffeb3b }, // yellow
]

/**
 * Recolors the debug objects (via cloned materials, geometry untouched) and
 * logs each one's world position + bounding-box size for later camera setup.
 */
function highlightDebugObjects(root: THREE.Object3D): void {
  console.log('--- Debug highlight + coordinates ---')
  for (const { name, color } of DEBUG_TINTS) {
    const obj = root.getObjectByName(name)
    if (!obj) {
      console.warn(`⚠️ cannot highlight, missing: ${name}`)
      continue
    }
    tintObject(obj, color)
    logObjectInfo(name, obj)
  }
  console.log('house_shell: left as-is (grey)')
}

/** Clones the material(s) of every mesh under `obj` and sets their color. */
function tintObject(obj: THREE.Object3D, color: number): void {
  obj.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return
    const recolor = (mat: THREE.Material): THREE.Material => {
      const clone = mat.clone() as THREE.Material & { color?: THREE.Color }
      if (clone.color) clone.color.setHex(color)
      return clone
    }
    child.material = Array.isArray(child.material)
      ? child.material.map(recolor)
      : recolor(child.material)
  })
}

/** Logs world position + bounding-box size/center of an object. */
function logObjectInfo(name: string, obj: THREE.Object3D): void {
  const fmt = (n: number) => n.toFixed(3)
  const v = (vec: THREE.Vector3) => `(${fmt(vec.x)}, ${fmt(vec.y)}, ${fmt(vec.z)})`

  const worldPos = obj.getWorldPosition(new THREE.Vector3())
  const box = new THREE.Box3().setFromObject(obj)
  const size = box.getSize(new THREE.Vector3())
  const center = box.getCenter(new THREE.Vector3())

  console.log(`📍 ${name}`)
  console.log(`     worldPos: ${v(worldPos)}`)
  console.log(`     bbox size: ${v(size)}`)
  console.log(`     bbox center: ${v(center)}`)
}
