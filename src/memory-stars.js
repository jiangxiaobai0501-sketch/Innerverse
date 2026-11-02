import { validEntry } from './storage.js'
export const MEMORY_PAGE_SIZE = 1000
export const MEMORY_COLORS = Object.freeze({ happy: '#f2c66d', calm: '#77bfff', sad: '#ba92ef', anxious: '#f07e88', neutral: '#d5e7ff' })
function hashUnit(id, salt) {
  let hash = (2166136261 ^ salt) >>> 0
  for (let i = 0; i < id.length; i++) hash = Math.imul(hash ^ id.charCodeAt(i), 16777619)
  hash = Math.imul(hash ^ (hash >>> 16), 0x85ebca6b)
  hash = Math.imul(hash ^ (hash >>> 13), 0xc2b2ae35)
  return ((hash ^ (hash >>> 16)) >>> 0) / 4294967296
}
export function memoryPosition(id) {
  if (typeof id !== 'string' || !id) throw new Error('星点需要有效日记 ID。')
  const angle = hashUnit(id, 101) * Math.PI * 2
  // Uniform area in an elliptical annulus; a shallow depth gives real parallax.
  // Initial-view inner radius keeps the planet's core clear.
  const radius = Math.sqrt(2.65 ** 2 + hashUnit(id, 307) * (3.35 ** 2 - 2.65 ** 2))
  return [Math.cos(angle) * radius, Math.sin(angle) * radius * .78, (hashUnit(id, 911) - .5) * 1.3]
}
export function memoryAppearance(entry) {
  return { color: Object.hasOwn(MEMORY_COLORS, entry?.mood) ? MEMORY_COLORS[entry.mood] : MEMORY_COLORS.neutral, favorite: entry?.isFavorite === true }
}
export function memoryEntries(entries) {
  const unique = new Map()
  for (const entry of entries) if (validEntry(entry) && !unique.has(entry.id)) unique.set(entry.id, entry)
  return { entries: [...unique.values()].sort((a,b) => a.id.localeCompare(b.id)), ignoredCount: entries.length - unique.size }
}
export function isMemoryClick(gesture, event, id) {
  return Boolean(gesture && gesture.id === id && !gesture.moved && event.button === 0 && event.delta <= 5 && Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) <= 5)
}

// Calendar filtering is derived in memory; it never writes to diary records.
export function memoryCalendar(entries) {
  const calendar = new Map()
  for (const entry of memoryEntries(entries).entries) {
    const year = entry.date.slice(0, 4), month = entry.date.slice(5, 7)
    if (!calendar.has(year)) calendar.set(year, new Set())
    calendar.get(year).add(month)
  }
  return [...calendar].sort(([a],[b]) => b.localeCompare(a)).map(([year,months]) => ({year,months:[...months].sort()}))
}
export function filterMemoryPeriod(entries, year = '', month = '') {
  return entries.filter(entry => (!year || entry.date.slice(0,4) === year) && (!year || !month || entry.date.slice(5,7) === month))
}
export function memoryMatchWeights(entries, matchingIds) {
  return new Float32Array(entries.map(entry => !matchingIds || matchingIds.has(entry.id) ? 1 : .09))
}
