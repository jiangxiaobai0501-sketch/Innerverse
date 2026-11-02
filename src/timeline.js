// Diary dates are calendar strings, not instants. Never convert them through UTC.
export function diaryDateParts(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const [year, month, day] = value.split('-').map(Number)
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  if (month < 1 || month > 12 || day < 1 || day > days[month - 1]) return null
  return { year: value.slice(0, 4), month: value.slice(5, 7), day: value.slice(8, 10), key: value.slice(0, 7) }
}
function createdTime(entry) {
  const time = typeof entry.createdAt === 'string' ? Date.parse(entry.createdAt) : NaN
  return Number.isFinite(time) ? time : 0
}
export function groupTimelineEntries(entries) {
  const years = new Map(), undated = []
  const records = (Array.isArray(entries) ? entries : []).filter(entry => entry && typeof entry === 'object')
  // updatedAt deliberately does not affect the position of an edited memory.
  records.sort((a, b) => {
    const aDate = diaryDateParts(a.date) ? a.date : ''
    const bDate = diaryDateParts(b.date) ? b.date : ''
    return bDate.localeCompare(aDate) || createdTime(b) - createdTime(a) || String(a.id).localeCompare(String(b.id))
  })
  for (const entry of records) {
    const date = diaryDateParts(entry.date)
    if (!date) { undated.push(entry); continue }
    if (!years.has(date.year)) years.set(date.year, { year: date.year, months: [] })
    const year = years.get(date.year)
    let month = year.months.find(item => item.key === date.key)
    if (!month) { month = { key: date.key, month: date.month, entries: [] }; year.months.push(month) }
    month.entries.push(entry)
  }
  return { years: [...years.values()], undated }
}
