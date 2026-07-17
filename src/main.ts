import { createScene } from './scene'
import { loadModel } from './loader'
import { applyStartCamera, initCameraMotion, createCameraSwitcher } from './cameras'
import { createHud } from './hud'
import { createInteractions } from './interactive'
import { createGrille } from './grille'
import { createFilter } from './filter'
import { setLang, getInitialLang, initLocaleBridge, onChange, getLang, t } from './i18n'

const container = document.getElementById('app')
if (!container) {
  throw new Error('Missing #app container in index.html')
}

// Locale first, before anything renders: ?lang=… sets the initial locale, and a
// trusted embedding parent can switch it live over postMessage.
setLang(getInitialLang())
initLocaleBridge()

// Keep the tab title and <html lang> in sync with the active locale.
const applyDocumentMeta = () => {
  document.title = t('ui.docTitle')
  document.documentElement.lang = getLang()
}
applyDocumentMeta()
onChange(applyDocumentMeta)

// Boot the scene, start on the overview camera (before the first frame), mount
// the gameplay HUD, then load the model.
const ctx = createScene(container)
initCameraMotion(ctx)
applyStartCamera(ctx)
createCameraSwitcher(ctx)
// Shared props: the scripted buttons and direct clicks drive the same objects.
const grille = createGrille(ctx)
// The filter sits behind the grille, so it cannot be swapped until it is aside.
const filter = createFilter(ctx, () => grille.isOpen())
const hud = createHud(ctx, grille, filter)
createInteractions(ctx, grille, filter, hud)
loadModel(ctx, () => hud.syncModel())
