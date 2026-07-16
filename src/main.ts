import { createScene } from './scene'
import { loadModel } from './loader'

const container = document.getElementById('app')
if (!container) {
  throw new Error('Missing #app container in index.html')
}

// Boot the Three.js scene, then kick off model loading.
const ctx = createScene(container)
loadModel(ctx)
