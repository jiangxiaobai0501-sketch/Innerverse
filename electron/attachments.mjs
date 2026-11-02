import { promises as fs } from 'node:fs'
import path from 'node:path'
import { randomUUID, createHash } from 'node:crypto'
import { NO_CONTEXT } from './operation.mjs'
import { validImage } from '../src/storage.js'
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024
export const digest = bytes => createHash('sha256').update(bytes).digest('hex')
const fail = message => { throw new Error(message) }
export function inspectImage(bytes) {
  if (!Buffer.isBuffer(bytes) || !bytes.length || bytes.length > MAX_IMAGE_BYTES) fail('图片不能为空且不能超过 10 MiB。')
  let mimeType, extension, width, height
  if (bytes.length >= 33 && bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) && bytes.toString('ascii',12,16)==='IHDR') {
    mimeType='image/png';extension='png';width=bytes.readUInt32BE(16);height=bytes.readUInt32BE(20)
  } else if (bytes.length >= 12 && bytes[0]===255 && bytes[1]===216 && bytes.at(-2)===255 && bytes.at(-1)===217) {
    mimeType='image/jpeg';extension='jpg'
    let offset=2
    while(offset+4<=bytes.length) {
      if(bytes[offset++]!==255) break
      while(bytes[offset]===255)offset++
      const marker=bytes[offset++];if(marker===0xDA||marker===0xD9)break
      const length=bytes.readUInt16BE(offset);if(length<2||offset+length>bytes.length)break
      if([0xC0,0xC1,0xC2,0xC3,0xC5,0xC6,0xC7,0xC9,0xCA,0xCB,0xCD,0xCE,0xCF].includes(marker)&&length>=8){height=bytes.readUInt16BE(offset+3);width=bytes.readUInt16BE(offset+5);break}
      offset+=length
    }
  } else if(bytes.length>=30 && bytes.toString('ascii',0,4)==='RIFF' && bytes.toString('ascii',8,12)==='WEBP' && bytes.readUInt32LE(4)+8===bytes.length) {
    mimeType='image/webp';extension='webp';const chunk=bytes.toString('ascii',12,16)
    if(chunk==='VP8X'){width=bytes.readUIntLE(24,3)+1;height=bytes.readUIntLE(27,3)+1}
    else if(chunk==='VP8L'&&bytes[20]===0x2f){const bits=bytes.readUInt32LE(21);width=(bits&0x3fff)+1;height=((bits>>>14)&0x3fff)+1}
    else if(chunk==='VP8 '&&bytes[23]===0x9d&&bytes[24]===1&&bytes[25]===0x2a){width=bytes.readUInt16LE(26)&0x3fff;height=bytes.readUInt16LE(28)&0x3fff}
  }
  if(!mimeType || !width || !height || width>16384 || height>16384 || width*height>40000000)fail('图片真实格式或尺寸不受支持（仅 JPG、PNG、WebP，最多 4000 万像素）。')
  return {mimeType,extension,width,height}
}
export async function readBounded(filename, limit=MAX_IMAGE_BYTES) {
  const stat=await fs.lstat(filename);if(!stat.isFile()||stat.isSymbolicLink()||stat.size>limit)fail('文件类型或大小不符合要求。')
  const file=await fs.open(filename,'r')
  try { const actual=await file.stat();if(!actual.isFile()||actual.size>limit)fail('文件类型或大小不符合要求。');const bytes=Buffer.alloc(actual.size+1);let length=0;while(length<bytes.length){const result=await file.read(bytes,length,bytes.length-length,null);if(!result.bytesRead)break;length+=result.bytesRead}if(length!==actual.size)fail('文件在读取时发生变化，请重新选择。');return bytes.subarray(0,length) } finally {await file.close()}
}
export async function writeExclusive(filename, bytes) {
  const file=await fs.open(filename,'wx');let complete=false;try {await file.writeFile(bytes);await file.sync();complete=true} finally {await file.close();if(!complete)await fs.unlink(filename).catch(()=>{})}
}
export function createAttachments(userData, decode) {
  const directory=path.join(userData,'attachments'), draft=path.join(directory,'.draft-'+randomUUID()), pending=new Map()
  async function directorySafe(create=false) {
    if(create)await fs.mkdir(directory,{recursive:true})
    const realRoot=await fs.realpath(userData),stat=await fs.lstat(directory)
    if(!stat.isDirectory()||stat.isSymbolicLink()||path.resolve(await fs.realpath(directory)).toLowerCase()!==path.join(realRoot,'attachments').toLowerCase())fail('附件目录不是安全的本机目录。')
  }
  async function fileSafe(filename, draftFile=false) {
    await directorySafe()
    if(draftFile){const stat=await fs.lstat(draft);if(!stat.isDirectory()||stat.isSymbolicLink()||path.resolve(await fs.realpath(draft)).toLowerCase()!==path.join(await fs.realpath(directory),path.basename(draft)).toLowerCase())fail('临时附件目录不安全。')}
    const parent=await fs.realpath(path.dirname(filename)),actual=await fs.realpath(filename)
    if(path.dirname(actual).toLowerCase()!==parent.toLowerCase())fail('附件路径越界。')
    const stat=await fs.lstat(filename);if(!stat.isFile()||stat.isSymbolicLink())fail('附件不是普通文件。')
  }
  async function validate(bytes, expectedMime) {
    const info=inspectImage(bytes)
    if(expectedMime&&info.mimeType!==expectedMime)fail('图片真实类型与元数据不一致。')
    const size=await decode(bytes,info.mimeType)
    if(!size || !Number.isInteger(size.width)||!Number.isInteger(size.height)||size.width*size.height!==info.width*info.height)fail('图片损坏或无法解码。')
    return info
  }
  function metadataSafe(meta){if(!validImage(meta))fail('附件元数据或相对路径不安全。');return path.join(directory,path.basename(meta.relativePath))}
  async function stage(items, ctx = NO_CONTEXT) {
    ctx.check()
    const validated=[];for(const item of items){const info=await validate(item.bytes,item.mimeType);validated.push({...item,info})}
    const added=[]
    try {await ctx.commit(()=>directorySafe(true));await ctx.commit(()=>fs.mkdir(draft,{recursive:true}));const draftStat=await fs.lstat(draft);if(!draftStat.isDirectory()||draftStat.isSymbolicLink()||path.resolve(await fs.realpath(draft)).toLowerCase()!==path.join(await fs.realpath(directory),path.basename(draft)).toLowerCase())fail('临时附件目录不安全。');for(const {bytes,info}of validated){const id=randomUUID(),meta={id,relativePath:`attachments/${id}.${info.extension}`,mimeType:info.mimeType},filename=path.join(draft,path.basename(meta.relativePath));await ctx.commit(()=>writeExclusive(filename,bytes));pending.set(id,{meta,filename});added.push(meta);ctx.check()}return added}
    catch(error){await discard(added.map(m=>m.id));throw error}
  }
  async function importFiles(files,remaining,ctx = NO_CONTEXT) {
    ctx.check()
    if(!Number.isInteger(remaining)||remaining<1||remaining>3||!Array.isArray(files)||files.length>remaining)fail('每篇日记最多添加 3 张图片。')
    if(!files.length)return []
    const items=[];for(const filename of files){const bytes=await readBounded(filename),info=await validate(bytes);const ext=path.extname(filename).toLowerCase();if(!(info.mimeType==='image/jpeg'?['.jpg','.jpeg']:['.'+info.extension]).includes(ext))fail('图片扩展名与真实格式不一致。');items.push({bytes,mimeType:info.mimeType})}return stage(items,ctx)
  }
  async function read(meta,allowPending=true) {
    const target=metadataSafe(meta),item=allowPending?pending.get(meta.id):null
    if(item && (item.meta.relativePath!==meta.relativePath||item.meta.mimeType!==meta.mimeType))fail('临时附件元数据不匹配。')
    const filename=item?.filename??target;await fileSafe(filename,Boolean(item));const bytes=await readBounded(filename);await validate(bytes,meta.mimeType);return bytes
  }
  async function discard(ids) {for(const id of ids){const item=pending.get(id);if(item){try{await fileSafe(item.filename,true);await fs.unlink(item.filename)}catch(error){if(error.code!=='ENOENT')throw error}pending.delete(id)}}await fs.rmdir(draft).catch(()=>{})}
  async function promote(entries,ctx = NO_CONTEXT) {
    ctx.check()
    const promoted=[]
    try {for(const entry of entries)for(const meta of entry.images??[]){const item=pending.get(meta.id);if(!item||item.committed||promoted.some(m=>m.id===meta.id))continue;const bytes=await read(meta);const target=metadataSafe(meta);await ctx.commit(()=>writeExclusive(target,bytes));promoted.push(meta);ctx.check()}return promoted}
    catch(error){for(const meta of promoted)await remove(meta);throw error}
  }
  async function remove(meta){const filename=metadataSafe(meta);try{await fileSafe(filename);await fs.unlink(filename)}catch(error){if(error.code!=='ENOENT')throw error}}
  return {directory,pending,validate,stage,importFiles,read,promote,discard,remove,async finish(promoted){for(const meta of promoted){const item=pending.get(meta.id);if(item)item.committed=true}await discard(promoted.map(m=>m.id))},async dispose(){await discard([...pending.keys()])}}
}
