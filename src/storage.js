export const STORAGE_KEY = 'xinyu.diary.v1'
export function localDate(now = new Date()) {
  return `${String(now.getFullYear()).padStart(4, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}
function validEntry(entry) {
  if (!entry || typeof entry !== 'object') return false
  if (!['id', 'title', 'date', 'content', 'createdAt', 'updatedAt'].every(key => typeof entry[key] === 'string')) return false
  const date = new Date(`${entry.date}T00:00:00`)
  return entry.id.length > 0 && entry.title.trim().length > 0 && entry.content.trim().length > 0 && /^\d{4}-\d{2}-\d{2}$/.test(entry.date) && !isNaN(date) && localDate(date) === entry.date && !isNaN(Date.parse(entry.createdAt)) && !isNaN(Date.parse(entry.updatedAt))
}
export function loadEntries(storage) {
  try {
    const raw = storage.getItem(STORAGE_KEY)
    if (raw === null) return { entries: [], error: '', raw: null }
    const entries = JSON.parse(raw)
    if (!Array.isArray(entries) || !entries.every(validEntry) || new Set(entries.map(e => e.id)).size !== entries.length) throw new Error('invalid')
    return { entries, error: '', raw }
  } catch {
    return { entries: [], error: '无法读取本地日记。为保护原数据，已暂停保存，请先导出原始备份。', raw: null }
  }
}
export function saveEntries(storage, entries) {
  // setItem失败时向调用方抛错，界面仅在写入成功后更新。
  if (!Array.isArray(entries) || !entries.every(validEntry)) throw new Error('invalid entries')
  storage.setItem(STORAGE_KEY, JSON.stringify(entries))
}
export function searchEntries(entries, query) {
  const term = query.trim().toLocaleLowerCase()
  return entries.filter(e => !term || `${e.title}\n${e.content}`.toLocaleLowerCase().includes(term))
    .sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt))
}

