// Chromium decodes all three supported formats in an isolated, invisible window.
// No filesystem API or preload is exposed to this window.
export function createImageDecoder(BrowserWindow) {
  let window, ready
  return {async decode(bytes,mimeType) {
    if(!window||window.isDestroyed()) {
      window=new BrowserWindow({show:false,width:16,height:16,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false,webSecurity:true}})
      window.webContents.setWindowOpenHandler(()=>({action:'deny'}))
      ready=window.loadURL('data:text/html,<meta http-equiv="Content-Security-Policy" content="default-src %27none%27; img-src blob:">')
    }
    await ready
    return window.webContents.executeJavaScript(`(async()=>{const bytes=Uint8Array.from(atob(${JSON.stringify(bytes.toString('base64'))}),c=>c.charCodeAt(0));const image=await createImageBitmap(new Blob([bytes],{type:${JSON.stringify(mimeType)}}));const size={width:image.width,height:image.height};image.close();return size})()`)
  },close(){if(window&&!window.isDestroyed())window.destroy();window=null}}
}
