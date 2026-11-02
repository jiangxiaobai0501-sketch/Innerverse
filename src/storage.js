import {isStageId} from './life-stages.js'
export const STORAGE_KEY = 'xinyu.diary.v1'
const MOODS = new Set(['happy', 'calm', 'sad', 'anxious'])
const IMAGE_EXTENSIONS = { 'image/png': ['png'], 'image/jpeg': ['jpg', 'jpeg'], 'image/webp': ['webp'] }

export function localDate(now = new Date()) {
  return `${String(now.getFullYear()).padStart(4, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}
export function validImage(image) {
  if (!image || typeof image !== 'object' || Array.isArray(image)) return false
  if (typeof image.id !== 'string' || image.id.length > 128 || !/^[A-Za-z0-9]/.test(image.id) || /[^A-Za-z0-9_-]/.test(image.id)) return false
  if (/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i.test(image.id)) return false
  if (typeof image.mimeType !== 'string' || typeof image.relativePath !== 'string') return false
  const extensions = Object.hasOwn(IMAGE_EXTENSIONS, image.mimeType) ? IMAGE_EXTENSIONS[image.mimeType] : []
  // Only canonical managed paths; no absolute paths, backslashes, traversal or encoded aliases.
  return extensions.some(extension => image.relativePath === `attachments/${image.id}.${extension}`)
}
function validMetadata(entry) {
  if (Object.hasOwn(entry,'stageId') && entry.stageId !== null && !isStageId(entry.stageId)) return false
  if (Object.hasOwn(entry, 'mood') && entry.mood !== null && !MOODS.has(entry.mood)) return false
  if (Object.hasOwn(entry, 'isFavorite') && typeof entry.isFavorite !== 'boolean') return false
  if (!Object.hasOwn(entry, 'images')) return true
  return Array.isArray(entry.images) && entry.images.length <= 3 && Array.from(entry.images).every(validImage)
    && new Set(entry.images.map(image => image.id.toLowerCase())).size === entry.images.length
}
export function validEntry(entry) {
  if (!entry || typeof entry !== 'object') return false
  if (!['id', 'title', 'date', 'content', 'createdAt', 'updatedAt'].every(key => typeof entry[key] === 'string')) return false
  const date = new Date(`${entry.date}T00:00:00`)
  return entry.id.length > 0 && entry.title.trim().length > 0 && entry.content.trim().length > 0 && /^\d{4}-\d{2}-\d{2}$/.test(entry.date) && !isNaN(date) && localDate(date) === entry.date && !isNaN(Date.parse(entry.createdAt)) && !isNaN(Date.parse(entry.updatedAt)) && validMetadata(entry)
}
export function validateEntries(entries) {
  if (!Array.isArray(entries) || !Array.from(entries).every(validEntry) || new Set(entries.map(e => e.id)).size !== entries.length) throw new Error('日记文件格式不正确，已阻止覆盖。')
  if (entries.some(e => e.title.length > 80 || e.content.length > 100000)) throw new Error('日记内容超过允许长度。')
  return entries
}
export function normalizeEntries(entries) {
  validateEntries(entries)
  return entries.map(entry => ({
    ...entry,
    mood: Object.hasOwn(entry, 'mood') ? entry.mood : null,
    isFavorite: Object.hasOwn(entry, 'isFavorite') ? entry.isFavorite : false,
    images: Object.hasOwn(entry, 'images') ? entry.images.map(image => ({ ...image })) : []
  }))
}
export function normalizeEntry(entry) { return normalizeEntries([entry])[0] }

// Ordinary editing may change only these fields. Identity and all metadata come from the original.
export function applyDiaryEdit(original, changes, now, newId) {
  if (!changes || typeof changes !== 'object' || Array.isArray(changes)) throw new Error('日记修改内容不正确。')
  const editable = Object.fromEntries(['title', 'date', 'content'].filter(key => Object.hasOwn(changes, key)).map(key => [key, changes[key]]))
  const entry = original
    ? { ...normalizeEntry(original), ...editable, id: original.id, createdAt: original.createdAt, updatedAt: now }
    : { ...editable, id: newId, createdAt: now, updatedAt: now, mood: null, isFavorite: false, images: [] }
  return normalizeEntry(entry)
}
export function loadEntries(storage) {
  try {
    const raw = storage.getItem(STORAGE_KEY)
    if (raw === null) return { entries: [], error: '', raw: null }
    return { entries: normalizeEntries(JSON.parse(raw)), error: '', raw }
  } catch {
    return { entries: [], error: '无法读取本地日记。为保护原数据，已暂停保存，请先导出原始备份。', raw: null }
  }
}
export function saveEntries(storage, entries) {
  // Normalize in memory, then perform the single write. Validation failure never touches storage.
  storage.setItem(STORAGE_KEY, JSON.stringify(normalizeEntries(entries)))
}
// Explicit metadata edits cannot replace identity, body or attachments.
export function applyDiaryMetadata(original, changes) {
  if (!changes || typeof changes !== 'object' || Array.isArray(changes)) throw new Error('日记元数据不正确。')
  const patch = Object.fromEntries(['mood', 'isFavorite', 'stageId'].filter(key => Object.hasOwn(changes, key)).map(key => [key, changes[key]]))
  return normalizeEntry({ ...normalizeEntry(original), ...patch })
}
export function searchEntries(entries, query, favoritesOnly = false) {
  const term = query.trim().toLocaleLowerCase()
  return entries.filter(e => (!favoritesOnly || e.isFavorite === true) && (!term || `${e.title}\n${e.content}`.toLocaleLowerCase().includes(term)))
    .sort((a, b) => String(b.date ?? '').localeCompare(String(a.date ?? '')) || String(b.updatedAt ?? '').localeCompare(String(a.updatedAt ?? '')))
}

