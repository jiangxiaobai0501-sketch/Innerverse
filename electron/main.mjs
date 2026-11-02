import {createStageStore} from './stages.mjs'
import { app, BrowserWindow, dialog, ipcMain, session } from 'electron'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createDiaryService } from './diary-service.mjs'
import { createImageDecoder } from './image-decoder.mjs'
import { createPasswordLock } from './password-lock.mjs'
import { allowPublicFile } from './operation.mjs'

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const index = path.join(root, 'dist', 'index.html')
const indexURL = pathToFileURL(index).href
// A stable per-user directory, independent of installation directory and app version.
const override = app.commandLine.getSwitchValue('user-data-dir')
app.setPath('userData', override ? path.resolve(override) : path.join(app.getPath('appData'), 'Xinyu'))
mkdirSync(app.getPath('userData'), { recursive: true })
app.setAppUserModelId('com.xinyu.diary')
app.commandLine.appendSwitch('disable-background-networking')
const decoder = createImageDecoder(BrowserWindow)
const service = createDiaryService(app.getPath('userData'), decoder.decode)
const store = service.store
const stages = createStageStore(app.getPath('userData'))
let disposed = false, disposing = false
// Clean drafts only after the user has accepted closing all windows.
app.on('will-quit', event => { if (!disposed) { event.preventDefault(); if (!disposing) { disposing = true; service.dispose().catch(() => {}).finally(() => { disposed = true; decoder.close(); app.quit() }) } } })
let window
const lock = createPasswordLock(app.getPath('userData'), { onChange(state) {
  if (window && !window.webContents.isDestroyed()) window.webContents.send('auth:state', state)
  if (state.phase !== 'unlocked') service.dispose().catch(() => {})
} })

if (!app.requestSingleInstanceLock()) app.quit()
else {
  app.on('second-instance', () => { if (window) { if (window.isMinimized()) window.restore(); window.focus() } })
  app.whenReady().then(async () => {
    session.defaultSession.webRequest.onBeforeRequest({ urls: ['<all_urls>'] }, ({ url }, callback) => {
      const cancel = /^(https?|wss?|ftp):/i.test(url) || url.startsWith('file:') && !allowPublicFile(url, path.dirname(index))
      callback({ cancel })
    })
    session.defaultSession.setPermissionRequestHandler((_, __, callback) => callback(false))
    session.defaultSession.setPermissionCheckHandler(() => false)
    function trusted(event) {
      if (!window || event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame || event.senderFrame.url !== indexURL) throw new Error('拒绝不可信的操作请求。')
    }
    function handle(channel, action) {
      ipcMain.handle(channel, async (event, ...args) => {
        try {
          trusted(event)
          const result = await lock.runPrivate(event.sender.id, ctx => action(ctx, ...args))
          return { ok: true, ...result }
        } catch (error) {
          return { ok: false, error: error.code === 'LOCKED' || error.code === 'SECURITY_CONFIG' ? error.message : '操作未完成，原有日记不会被重置。' + error.message }
        }
      })
    }
    function authHandle(channel, action) {
      ipcMain.handle(channel, async (event, ...args) => {
        try { trusted(event) } catch { return { ok: false, error: '拒绝不可信的操作请求。' } }
        try { return { ok: true, state: await action(event.sender.id, ...args) } }
        catch (error) { return { ok: false, error: error.code && !['LOCKED','SECURITY_CONFIG'].includes(error.code) ? '安全配置暂时无法更新，请检查文件权限与磁盘空间；已有配置不会被重置。' : error.message, retryAfterMs: error.retryAfterMs ?? 0, state: await lock.status() } }
      })
    }
    handle('stages:load', async ctx => {ctx.check();return {stages:await stages.read()}})
    handle('stages:save', async (ctx,value) => {await stages.save(value,ctx);return {}})
    authHandle('auth:status', () => lock.status())
    authHandle('auth:setup', (id, password, confirmation) => lock.setup(password, confirmation, id))
    authHandle('auth:unlock', (id, password) => lock.unlock(password, id))
    authHandle('auth:lock', async () => { const state = lock.lock(); await lock.settled(); return state })
    authHandle('auth:change-password', (id, oldPassword, password, confirmation) => lock.changePassword(oldPassword, password, confirmation, id))
    authHandle('auth:set-idle', (id, minutes) => lock.setIdle(minutes, id))
    ipcMain.on('auth:activity', event => { try { trusted(event); if (window.isFocused()) lock.activity(event.sender.id) } catch {} })
    const timer = setInterval(() => lock.tick(), 1000); timer.unref()
    app.once('will-quit', () => clearInterval(timer))
    handle('diary:load', async ctx => ({ entries: await service.load(ctx), dataPath: store.filename }))
    handle('diary:save', async (ctx, entries) => { return service.save(entries, ctx) })
    handle('diary:import-images', async (ctx, remaining) => {
      if (!Number.isInteger(remaining) || remaining < 1 || remaining > 3) throw new Error('每篇日记最多添加 3 张图片。')
      const result = await dialog.showOpenDialog(window, { title: '添加日记照片', properties: ['openFile', 'multiSelections'], filters: [{ name: '照片', extensions: ['jpg', 'jpeg', 'png', 'webp'] }] })
      ctx.check()
      if (result.canceled || !result.filePaths.length) return { canceled: true, images: [] }
      return { images: await service.importImages(result.filePaths, remaining, ctx) }
    })
    handle('diary:read-image', (ctx, meta) => service.readImage(meta, ctx))
    handle('diary:discard-images', (ctx, ids) => service.discardImages(ids, ctx))
    handle('diary:backup', async ctx => {
      const result = await dialog.showSaveDialog(window, { title: '备份心屿日记', defaultPath: path.join(app.getPath('documents'), `心屿_图文备份_${new Date().toISOString().slice(0,10)}.json`), filters: [{ name: 'JSON 图文备份', extensions: ['json'] }] })
      ctx.check()
      if (result.canceled || !result.filePath) return { canceled: true }
      await service.exportTo(result.filePath, ctx)
      return { canceled: false }
    })
    handle('diary:restore', async ctx => {
      const result = await dialog.showOpenDialog(window, { title: '恢复心屿备份', properties: ['openFile'], filters: [{ name: 'JSON 日记备份', extensions: ['json'] }] })
      ctx.check()
      if (result.canceled || !result.filePaths.length) return { canceled: true }
      const confirm = await dialog.showMessageBox(window, { type: 'warning', title: '恢复日记备份', message: '恢复将替换当前日记。校验通过后，会先自动保存当前图文数据的完整恢复备份。是否继续？', buttons: ['取消', '恢复备份'], defaultId: 0, cancelId: 0, noLink: true })
      ctx.check()
      if (confirm.response !== 1) return { canceled: true }
      return { canceled: false, ...await service.restoreFile(result.filePaths[0], ctx) }
    })
    window = new BrowserWindow({ title: '心屿 · 无界星海', width: 1380, height: 920, minWidth: 900, minHeight: 640, fullscreen: true, backgroundColor: '#030510', show: false, icon: path.join(root, 'build', 'icon.ico'), autoHideMenuBar: true,
      webPreferences: { preload: path.join(root, 'electron', 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true, spellcheck: false } })
    window.webContents.on('did-start-navigation', (_event, _url, _inPlace, isMainFrame) => { if (isMainFrame) lock.lock('navigation') })
    window.webContents.on('render-process-gone', () => lock.lock('renderer-gone'))
    window.on('closed', () => { decoder.close(); app.quit() })
    window.removeMenu()
    ipcMain.on('window:toggle-fullscreen', event => {
      try { trusted(event); window.setFullScreen(!window.isFullScreen()) } catch {}
    })
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
    window.webContents.on('will-navigate', (event, url) => { if (url !== indexURL) event.preventDefault() })
    window.webContents.on('will-attach-webview', event => event.preventDefault())
    window.webContents.on('will-prevent-unload', event => {
      const choice = dialog.showMessageBoxSync(window, { type: 'question', title: '还有未保存的日记', message: '当前内容尚未保存，确定关闭心屿吗？', buttons: ['返回编辑', '放弃并关闭'], defaultId: 0, cancelId: 0, noLink: true })
      if (choice === 1) event.preventDefault()
    })
    window.once('ready-to-show', () => window.show())
    await window.loadFile(index)
  }).catch(error => { dialog.showErrorBox('心屿启动失败', error.message); app.quit() })
  app.on('window-all-closed', () => app.quit())
}
