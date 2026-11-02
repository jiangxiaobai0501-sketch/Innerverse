import {NO_CONTEXT} from './operation.mjs'
import {promises as fs} from 'node:fs'
import path from 'node:path'
import {randomUUID} from 'node:crypto'
import {createDiaryStore} from './store.mjs'
import {createAttachments,digest,readBounded,writeExclusive,MAX_IMAGE_BYTES} from './attachments.mjs'
import {normalizeEntries,validImage} from '../src/storage.js'
const imageKey=meta=>meta.relativePath.toLowerCase()
const imagesOf=entries=>new Map(entries.flatMap(entry=>entry.images??[]).map(meta=>[imageKey(meta),meta]))
const MAX_BACKUP_BYTES=200*1024*1024
export function createDiaryService(userData,decode) {
  const store=createDiaryStore(path.join(userData,'diary')),attachments=createAttachments(userData,decode)
  let queue=Promise.resolve()
  function serial(action){const operation=queue.then(action);queue=operation.catch(()=>{});return operation}
  async function backupEntries(){try{return normalizeEntries(JSON.parse(await fs.readFile(store.filename+'.bak','utf8')))}catch(error){if(error.code==='ENOENT')return [];throw error}}
  async function saveInternal(entries,ctx=NO_CONTEXT) {
    ctx.check()
    const next=normalizeEntries(entries),previous=await store.read(),known=imagesOf(previous)
    for(const [key,meta]of imagesOf(next)) {
      if(attachments.pending.has(meta.id))continue
      const existing=known.get(key)
      if(!existing||existing.mimeType!==meta.mimeType)throw new Error('新增图片必须先通过本机文件选择器导入。')
    }
    let priorBackup
    try {priorBackup=await backupEntries()}catch{priorBackup=null}
    const promoted=await attachments.promote(next,ctx)
    try {await store.save(next,ctx)}catch(error){for(const meta of promoted)await attachments.remove(meta).catch(()=>{});throw error}
    const warnings=[]
    await attachments.finish(promoted).catch(error=>warnings.push('临时图片清理失败：'+error.message))
    // Keep the current file AND the previous-version .bak usable.
    // If an old backup cannot be parsed, retain files instead of guessing.
    let authorized=true;try{ctx.check()}catch{authorized=false}
    if(authorized&&priorBackup!==null) {
      const retained=imagesOf([...next,...previous]),candidates=imagesOf([...previous,...priorBackup])
      for(const [key,meta]of candidates)if(!retained.has(key))await ctx.commit(()=>attachments.remove(meta)).catch(error=>warnings.push('附件保留待检查：'+error.message))
    }
    return {entries:next,warnings}
  }
  async function bundle(entries,ctx=NO_CONTEXT) {
    ctx.check()
    const normalized=normalizeEntries(entries),metas=[...imagesOf(normalized).values()]
    if(!metas.length)return JSON.stringify(normalized,null,2)
    const files=[]
    for(const meta of metas){ctx.check();const bytes=await attachments.read(meta,false);ctx.check();files.push({...meta,sha256:digest(bytes),data:bytes.toString('base64')})}
    const text=JSON.stringify({app:'Xinyu',version:2,entries:normalized,attachments:files},null,2)
    if(Buffer.byteLength(text)>MAX_BACKUP_BYTES)throw new Error('图文备份超过 200 MiB，请分批整理后再备份。')
    return text
  }
  async function parseBackup(text,ctx=NO_CONTEXT) {
    ctx.check()
    if(typeof text!=='string'||Buffer.byteLength(text)>MAX_BACKUP_BYTES)throw new Error('备份超过 200 MiB 或格式不正确。')
    const data=JSON.parse(text)
    const legacy=Array.isArray(data)||data?.app==='Xinyu'&&data.version===1&&Array.isArray(data.entries)
    const entries=normalizeEntries(Array.isArray(data)?data:data?.entries)
    const refs=imagesOf(entries)
    if(legacy){if(refs.size)throw new Error('旧备份有图片引用但未包含图片，不能安全恢复。');return {entries,files:[]}}
    if(data?.app!=='Xinyu'||data.version!==2||!Array.isArray(data.attachments)||data.attachments.length!==refs.size)throw new Error('图文备份的附件清单不完整。')
    const files=[],seen=new Set()
    for(const item of data.attachments){
      if(!validImage(item)||seen.has(imageKey(item)))throw new Error('备份图片元数据无效或重复。')
      seen.add(imageKey(item));const ref=refs.get(imageKey(item))
      if(!ref||ref.id!==item.id||ref.mimeType!==item.mimeType||typeof item.data!=='string'||item.data.length>Math.ceil(MAX_IMAGE_BYTES/3)*4||typeof item.sha256!=='string'||!(/^[a-f0-9]{64}$/).test(item.sha256))throw new Error('备份图片引用或校验信息不匹配。')
      const bytes=Buffer.from(item.data,'base64')
      if(bytes.toString('base64')!==item.data||digest(bytes)!==item.sha256)throw new Error('备份图片完整性校验失败。')
      await attachments.validate(bytes,item.mimeType);ctx.check();files.push({meta:ref,bytes,mimeType:ref.mimeType})
    }
    return {entries,files}
  }
  async function restoreInternal(text,ctx=NO_CONTEXT) {
    ctx.check()
    const parsed=await parseBackup(text,ctx) // Complete validation BEFORE any write.
    const current=await store.read(),safetyText=await bundle(current,ctx)
    const recovery=path.join(userData,'recovery');await ctx.commit(()=>fs.mkdir(recovery,{recursive:true}))
    const info=await fs.lstat(recovery);if(!info.isDirectory()||info.isSymbolicLink()||path.resolve(await fs.realpath(recovery)).toLowerCase()!==path.join(await fs.realpath(userData),'recovery').toLowerCase())throw new Error('恢复备份目录不安全。')
    const recoveryPath=path.join(recovery,`before-restore-${Date.now()}-${randomUUID()}.json`)
    await ctx.commit(()=>writeExclusive(recoveryPath,Buffer.from(safetyText)))
    const staged=parsed.files.length?await attachments.stage(parsed.files,ctx):[]
    // Fresh attachment IDs prevent restoring a backup from overwriting current image bytes.
    const mapping=new Map(parsed.files.map((file,index)=>[imageKey(file.meta),staged[index]]))
    const next=parsed.entries.map(entry=>({...entry,images:entry.images.map(meta=>({...meta,...mapping.get(imageKey(meta))}))}))
    try {const result=await saveInternal(next,ctx);return {...result,recoveryPath}}
    finally {await attachments.discard(staged.map(meta=>meta.id)).catch(()=>{})}
  }
  return {store,attachments,
    load:(ctx=NO_CONTEXT)=>serial(()=>{ctx.check();return store.read()}),
    save:(entries,ctx=NO_CONTEXT)=>{ctx.check();const next=normalizeEntries(entries);return serial(()=>saveInternal(next,ctx))},
    importImages:(paths,remaining,ctx=NO_CONTEXT)=>serial(()=>attachments.importFiles(paths,remaining,ctx)),
    discardImages:(ids,ctx=NO_CONTEXT)=>serial(async()=>{ctx.check();if(!Array.isArray(ids)||ids.length>100||ids.some(id=>typeof id!=='string'))throw new Error('临时图片编号不正确。');await ctx.commit(()=>attachments.discard(ids));return {}}),
    readImage:(meta,ctx=NO_CONTEXT)=>serial(async()=>{ctx.check();
      if(!validImage(meta))throw new Error('图片元数据无效。')
      const current=imagesOf(await store.read()),known=current.get(imageKey(meta)),pending=attachments.pending.get(meta.id)
      if(!pending&&(!known||known.id!==meta.id||known.mimeType!==meta.mimeType))throw new Error('只能读取当前日记或当前编辑中的图片。')
      const bytes=await attachments.read(meta,!known);return {dataUrl:`data:${meta.mimeType};base64,${bytes.toString('base64')}`}
    }),
    backupText:(ctx=NO_CONTEXT)=>serial(async()=>{ctx.check();const raw=await store.snapshot();let entries;try{entries=normalizeEntries(JSON.parse(raw))}catch{return raw}return bundle(entries,ctx)}),
    exportTo:(filename,ctx=NO_CONTEXT)=>serial(async()=>{ctx.check();
      const parent=await fs.realpath(path.dirname(filename)),target=path.join(parent,path.basename(filename)),root=await fs.realpath(userData),relative=path.relative(root,target)
      if(!relative||!relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative))throw new Error('请选择 userData 数据目录之外的备份位置。')
      const raw=await store.snapshot();let text;try{const entries=normalizeEntries(JSON.parse(raw));text=await bundle(entries,ctx)}catch(error){try{normalizeEntries(JSON.parse(raw))}catch{text=raw}if(text===undefined)throw error}
      const temporary=target+'.'+randomUUID()+'.tmp'
      try {await ctx.commit(()=>writeExclusive(temporary,Buffer.from(text)));await ctx.commit(()=>fs.rename(temporary,target))}finally{await fs.unlink(temporary).catch(()=>{})}
      return {}
    }),
    restoreText:(text,ctx=NO_CONTEXT)=>serial(()=>restoreInternal(text,ctx)),
    restoreFile:(filename,ctx=NO_CONTEXT)=>serial(async()=>{ctx.check();return restoreInternal((await readBounded(filename,MAX_BACKUP_BYTES)).toString('utf8'),ctx)}),
    dispose:()=>serial(()=>attachments.dispose())
  }
}
