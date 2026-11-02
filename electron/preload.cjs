const { contextBridge, ipcRenderer } = require('electron')
window.addEventListener('keydown', event => {
  if (event.key === 'F11' && !event.repeat) {
    event.preventDefault()
    ipcRenderer.send('window:toggle-fullscreen')
  }
}, { capture: true })
let phase = 'locked', session = -1
const listeners = new Set()
function update(state) {
  if (!state || state.session < session) return
  phase = state.phase; session = state.session
  for (const listener of listeners) listener(state)
}
ipcRenderer.on('auth:state', (_event, state) => update(state))
async function auth(channel, ...args) {
  const result = await ipcRenderer.invoke(channel, ...args)
  update(result.state)
  return result
}
async function privateInvoke(channel, ...args) {
  if (phase !== 'unlocked') return { ok: false, error: '私人空间已锁定，请重新解锁。' }
  const version = session
  const result = await ipcRenderer.invoke(channel, ...args)
  if (phase !== 'unlocked' || version !== session) return { ok: false, error: '私人空间已锁定，请重新解锁。' }
  return result
}
contextBridge.exposeInMainWorld('xinyuDiary', Object.freeze({
  loadStages: () => privateInvoke('stages:load'),
  saveStages: stages => privateInvoke('stages:save', stages),
  load: () => privateInvoke('diary:load'),
  save: entries => privateInvoke('diary:save', entries),
  backup: () => privateInvoke('diary:backup'),
  importImages: remaining => privateInvoke('diary:import-images', remaining),
  readImage: meta => privateInvoke('diary:read-image', meta),
  discardImages: ids => privateInvoke('diary:discard-images', ids),
  restore: () => privateInvoke('diary:restore')
}))
contextBridge.exposeInMainWorld('xinyuLock', Object.freeze({
  status: () => auth('auth:status'),
  setup: (password, confirmation) => auth('auth:setup', password, confirmation),
  unlock: password => auth('auth:unlock', password),
  lock: () => { update({ phase: 'locked', session: session + 1 }); return auth('auth:lock') },
  changePassword: (oldPassword, password, confirmation) => auth('auth:change-password', oldPassword, password, confirmation),
  setIdle: minutes => auth('auth:set-idle', minutes),
  onStateChanged: listener => { listeners.add(listener); return () => listeners.delete(listener) }
}))
// Only trusted input events in this isolated world renew the idle timer.
// Rendering, pointer animation, polling and private IPC calls do not count as activity.
let lastActivity = 0
for (const name of ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart']) {
  window.addEventListener(name, event => {
    if (event.isTrusted && phase === 'unlocked' && Date.now() - lastActivity > 1000) {
      lastActivity = Date.now(); ipcRenderer.send('auth:activity')
    }
  }, { capture: true, passive: true })
}
