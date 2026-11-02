import { useRef, useState } from 'react'
import { ChevronRight, CalendarDays } from 'lucide-react'
import { groupTimelineEntries } from './timeline.js'

export default function Timeline({ entries, renderEntry }) {
  const root = useRef(null)
  const [year, setYear] = useState('')
  const [month, setMonth] = useState('')
  const groups = groupTimelineEntries(entries)
  const selectedYear = groups.years.find(item => item.year === year) ?? groups.years[0]
  const selectedMonth = selectedYear?.months.some(item => item.month === month) ? month : ''
  function locate() {
    if (!selectedYear) return
    const yearElement = root.current.querySelector(`[data-year="${selectedYear.year}"]`)
    const target = selectedMonth ? yearElement.querySelector(`[data-month="${selectedYear.year}-${selectedMonth}"]`) : yearElement
    yearElement.open = true
    target.open = true
    target.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' })
    target.querySelector('summary').focus({ preventScroll: true })
  }
  return <div className="memory-timeline" ref={root}>
    <div className="timeline-locate" aria-label="年月快速定位"><CalendarDays size={16} /><label>年份<select aria-label="定位年份" value={selectedYear?.year ?? ''} disabled={!selectedYear} onChange={event => { setYear(event.target.value); setMonth('') }}>{!selectedYear && <option value="">暂无年份</option>}{groups.years.map(item => <option key={item.year} value={item.year}>{item.year} 年</option>)}</select></label><label>月份<select aria-label="定位月份" value={selectedMonth} disabled={!selectedYear} onChange={event => setMonth(event.target.value)}><option value="">全年</option>{selectedYear?.months.map(item => <option key={item.month} value={item.month}>{Number(item.month)} 月</option>)}</select></label><button type="button" className="secondary-button" disabled={!selectedYear} onClick={locate}>定位</button></div>
    {groups.years.map(item => <details className="timeline-year" data-year={item.year} key={item.year} open><summary><ChevronRight size={18} /><span>{item.year} 年</span><small>{item.months.reduce((count, item) => count + item.entries.length, 0)} 篇</small></summary><div className="timeline-months">{item.months.map(item => <details className="timeline-month" data-month={item.key} key={item.key} open><summary><ChevronRight size={15} /><span>{Number(item.month)} 月</span><small>{item.entries.length} 篇</small></summary><div className="timeline-records">{item.entries.map(renderEntry)}</div></details>)}</div></details>)}
    {groups.undated.length > 0 && <details className="timeline-year timeline-undated" open><summary><ChevronRight size={18} /><span>日期待确认</span><small>{groups.undated.length} 篇</small></summary><p className="muted">这些记录的日期缺失或不合法，仅保留展示，不自动修复或修改原始数据。</p><div className="timeline-records">{groups.undated.map(renderEntry)}</div></details>}
  </div>
}
