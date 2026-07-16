import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'

export interface SceneContext {
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  renderer: THREE.WebGLRenderer
  controls: OrbitControls
}

/**
 * Sets up the Three.js scene, camera, renderer, lighting and a debug
 * OrbitControls, then starts the render loop. Returns the core objects so
 * other modules (e.g. the loader) can reach into the scene.
 */
export function createScene(container: HTMLElement): SceneContext {
  // --- Scene ---
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x2a2a2a) // neutral grey

  // --- Camera ---
  const camera = new THREE.PerspectiveCamera(
    50,
    window.innerWidth / window.innerHeight,
    0.1,
    1000,
  )
  camera.position.set(5, 5, 5)

  // --- Renderer ---
  const renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(window.innerWidth, window.innerHeight)
  container.appendChild(renderer.domElement)

  // --- Lighting (bright, so all interior details are clearly visible) ---
  const ambient = new THREE.AmbientLight(0xffffff, 0.9)
  scene.add(ambient)

  // Key light: strong, from top-side.
  const keyLight = new THREE.DirectionalLight(0xffffff, 1.5)
  keyLight.position.set(6, 10, 7.5)
  scene.add(keyLight)

  // Fill light: softer, from the opposite side, to lift shadows.
  const fillLight = new THREE.DirectionalLight(0xffffff, 0.6)
  fillLight.position.set(-7.5, 6, -6)
  scene.add(fillLight)

  // --- Controls (TEMPORARY: debug only, remove once FNAF cameras exist) ---
  const controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.05

  // --- Resize handling ---
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(window.innerWidth, window.innerHeight)
  })

  // --- Render loop ---
  function animate() {
    requestAnimationFrame(animate)
    controls.update()
    renderer.render(scene, camera)
  }
  animate()

  return { scene, camera, renderer, controls }
}
