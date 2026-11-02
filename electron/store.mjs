import { promises as fs } from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { NO_CONTEXT } from './operation.mjs'
import { normalizeEntries, validateEntries } from '../src/storage.js'

async function atomicWrite(filename, text, ctx) {
  const temporary = `${filename}.${randomUUID()}.tmp`
  let file
  try {
    await ctx.commit(async () => {
      file = await fs.open(temporary, 'wx')
      await file.writeFile(text, 'utf8')
      await file.sync()
      await file.close(); file = null
    })
    await ctx.commit(() => fs.rename(temporary, filename))
  } finally {
    await file?.close().catch(() => {})
    await fs.rm(temporary, { force: true }).catch(() => {})
  }
}
export function createDiaryStore(directory) {
  const filename = path.join(directory, 'diary.json')
  const backup = `${filename}.bak`
  let queue = Promise.resolve()
  async function raw() {
    try { return await fs.readFile(filename, 'utf8') }
    catch (error) {
      if (error.code !== 'ENOENT') throw error
      // An existing backup means this is not a new diary. Never silently reset it.
      try { await fs.access(backup) } catch (e) { if (e.code === 'ENOENT') return null; throw e }
      throw new Error('主日记文件缺失，但检测到备份。请先备份数据目录并恢复 diary.json.bak，已暂停保存。')
    }
  }
  async function read() {
    const text = await raw()
    return text === null ? [] : normalizeEntries(JSON.parse(text))
  }
  function save(entries, ctx = NO_CONTEXT) {
    ctx.check()
    // Copy at the boundary; queue disk writes, never partial JSON or overlapping saves.
    const next = JSON.stringify(normalizeEntries(entries), null, 2)
    const operation = queue.then(async () => {
      ctx.check()
      const previous = await raw()
      ctx.check()
      if (previous !== null) validateEntries(JSON.parse(previous))
      await ctx.commit(() => fs.mkdir(directory, { recursive: true }))
      if (previous !== null) await atomicWrite(backup, previous, ctx)
      await atomicWrite(filename, next, ctx)
    })
    queue = operation.catch(() => {})
    return operation
  }
  return { filename, read, save, async snapshot() { await queue; return (await raw()) ?? '[]' } }
}

