import { createScene } from './scene'
import { loadModel } from './loader'
import { createDebugUi } from './debugUi'
import { createCameraSwitcher, applyStartCamera } from './cameras'

const container = document.getElementById('app')
if (!container) {
  throw new Error('Missing #app container in index.html')
}

// Boot the scene, start on the overview camera (before the first frame),
// mount the debug UI + camera switcher, then load the model.
const ctx = createScene(container)
applyStartCamera(ctx)
createDebugUi(ctx)
createCameraSwitcher(ctx)
loadModel(ctx)
