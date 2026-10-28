import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { ArrowDownToLine, ArrowUpRight, BookOpen, Check, ChevronRight, Feather, Globe2, LockKeyhole, Orbit, Pencil, Plus, Search, ShieldCheck, Sparkles, Trash2, X } from 'lucide-react'
import { loadEntries, localDate, saveEntries, searchEntries, STORAGE_KEY } from './storage'
const PlanetScene = lazy(() => import('./PlanetScene'))
const displayDate = date => new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' }).format(new Date(`${date}T12:00:00`))
const dateParts = date => { const [y, m, d] = date.split('-'); return { day: d, month: `${y}.${m}` } }
function download(content, filename) {
  const blob = new Blob([content], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
function DiaryDialog({ entry, initialMode, onClose, onSave, onDelete }) {
  const dialog = useRef()
  const [mode, setMode] = useState(initialMode)
  const [title, setTitle] = useState(entry?.title ?? '')
  const [date, setDate] = useState(entry?.date ?? localDate())
  const [content, setContent] = useState(entry?.content ?? '')
  const [error, setError] = useState('')
  const dirty = title !== (entry?.title ?? '') || date !== (entry?.date ?? localDate()) || content !== (entry?.content ?? '')
  function close() {
    if (mode === 'edit' && dirty && !window.confirm('还有未保存的内容，确定放弃这次修改吗？')) return
    onClose()
  }
  useEffect(() => { const element = dialog.current; element.showModal(); return () => element.close() }, [])
  function submit(event) {
    event.preventDefault()
    if (!title.trim() || !content.trim()) { setError('请填写标题和正文，空白也是需要文字陪伴的。'); return }
    const now = new Date().toISOString()
    const updated = { id: entry?.id ?? crypto.randomUUID(), title: title.trim(), date, content: content.trim(), createdAt: entry?.createdAt ?? now, updatedAt: now }
    if (onSave(updated)) onClose()
    else setError('保存失败。请检查浏览器存储权限或空间；内容仍保留在这里，可先复制备份。')
  }
  return <dialog ref={dialog} className="diary-dialog" aria-labelledby="dialog-title" onCancel={e => { e.preventDefault(); close() }} onClick={e => { if (e.target === dialog.current) { const r = dialog.current.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) close() } }}>
    <div className="dialog-toolbar"><span className="eyebrow"><Feather size={15} /> {mode === 'read' ? '一页心事' : entry ? '重新拾起这一页' : '给此刻一个位置'}</span><button className="icon-button" aria-label="关闭日记" onClick={close}><X size={20} /></button></div>
    {mode === 'read' ? <><div className="read-meta">{displayDate(entry.date)}<span>仅你可见</span></div><h2 id="dialog-title" className="read-title">{entry.title}</h2><div className="read-body">{entry.content}</div><div className="dialog-footer"><button className="text-button danger" onClick={() => { if (onDelete(entry.id)) onClose() }}><Trash2 size={16} /> 删除日记</button><button className="primary-button" onClick={() => setMode('edit')}><Pencil size={16} /> 编辑这一页</button></div></> : <form onSubmit={submit}>
      <h2 id="dialog-title">{entry ? '修改日记' : '写下今天的故事'}</h2>
      <label className="field-label" htmlFor="diary-title">标题</label><input id="diary-title" className="form-input title-input" autoFocus value={title} maxLength={80} onChange={e => setTitle(e.target.value)} placeholder="今天，想记住什么？" required />
      <label className="field-label" htmlFor="diary-date">日期</label><input id="diary-date" className="form-input date-input" type="date" min="0001-01-01" max="9999-12-31" value={date} onChange={e => setDate(e.target.value)} required />
      <label className="field-label" htmlFor="diary-content">正文 <span>不用写得完美，真实就好</span></label><textarea id="diary-content" className="form-input" value={content} maxLength={100000} onChange={e => setContent(e.target.value)} placeholder="那些细小的快乐、没说出口的话，或者只是今天的天气……" required rows={9} />
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="dialog-footer"><span className="muted text-xs">{content.length.toLocaleString()} 字 · 保存在此浏览器</span><div className="flex items-center gap-3"><button type="button" className="secondary-button" onClick={close}>取消</button><button className="primary-button" type="submit"><Check size={17} /> 保存日记</button></div></div>
    </form>}
  </dialog>
}
export default function App() {
  const [initial] = useState(() => { try { return loadEntries(window.localStorage) } catch { return { entries: [], error: '浏览器阻止了本地存储，请允许此网站保存数据后刷新。' } } })
  const [entries, setEntries] = useState(initial.entries)
  const [query, setQuery] = useState('')
  const [modal, setModal] = useState(null)
  const [notice, setNotice] = useState('')
  const [activeNav, setActiveNav] = useState('home')
  const toastTimer = useRef()
  const searchRef = useRef()
  const results = searchEntries(entries, query)
  const totalWords = entries.reduce((count, entry) => count + entry.content.length, 0)
  useEffect(() => () => clearTimeout(toastTimer.current), [])
  function notify(message) { setNotice(message); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setNotice(''), 3500) }
  function commit(next) {
    if (initial.error) { notify(initial.error); return false }
    try { saveEntries(window.localStorage, next); setEntries(next); return true }
    catch { notify('无法保存：请检查浏览器存储权限或空间。'); return false }
  }
  function save(entry) { const success = commit([...entries.filter(item => item.id !== entry.id), entry]); if (success) notify('这一刻，已在心屿安放。'); return success }
  function remove(id) { if (!window.confirm('确定删除这篇日记吗？删除后无法撤销，建议先导出备份。')) return false; const success = commit(entries.filter(item => item.id !== id)); if (success) notify('日记已删除。'); return success }
  function create() { if (initial.error) { notify(initial.error); return }; setModal({ entry: null, mode: 'edit' }) }
  function exportBackup() {
    try {
      if (initial.error) { const raw = window.localStorage.getItem(STORAGE_KEY); if (raw === null) throw new Error(); download(raw, `心屿_原始备份_${localDate()}.json`) }
      else download(JSON.stringify({ app: 'Xinyu', version: 1, exportedAt: new Date().toISOString(), entries }, null, 2), `心屿_日记备份_${localDate()}.json`)
      notify('已发起备份下载，请查看浏览器下载列表。')
    } catch { notify('导出失败，浏览器当前无法访问本地数据。') }
  }
  function navigate(target) { setActiveNav(target); document.getElementById(target === 'home' ? 'home' : 'journals')?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' }) }
  return <div className="app-shell">
    <aside className="sidebar"><a className="brand" href="#home" onClick={e => { e.preventDefault(); navigate('home') }} aria-label="心屿首页"><span className="brand-icon"><Orbit size={29} strokeWidth={1.3} /></span><span className="brand-name">心屿<span>XINYU</span></span></a>
      <div className="sidebar-section-label">一个人的宇宙</div><nav aria-label="主要导航"><button className={`nav-item ${activeNav === 'home' ? 'active' : ''}`} onClick={() => navigate('home')}><Globe2 size={18} /> 我的心屿 <span className="nav-dot" /></button><button className={`nav-item ${activeNav === 'journals' ? 'active' : ''}`} onClick={() => navigate('journals')}><BookOpen size={18} /> 日记手札 <span className="nav-count">{entries.length}</span></button></nav>
      <div className="sidebar-divider" /><div className="sidebar-section-label">好好收藏</div><button className="nav-item" onClick={exportBackup}><ArrowDownToLine size={18} /> 导出备份 <ArrowUpRight className="nav-arrow" size={14} /></button>
      <div className="sidebar-poem"><span className="little-star">✧</span><p>世界很大，<br />这里刚好容得下你。</p><div className="poem-line" /></div>
      <div className="privacy-card"><ShieldCheck size={19} /><div><strong>心事，只属于你</strong><p>本地保存 · 不上传云端</p></div><span className="status-dot" /></div><div className="sidebar-footer">心屿 XINYU <span>© {new Date().getFullYear()}</span></div>
    </aside>
    <main id="home" className="main-content">
      <header className="topbar"><div className="breadcrumb">我的空间 <ChevronRight size={13} /><span>心屿</span></div><div className="topbar-right"><span className="today-label">{displayDate(localDate())}</span><span className="private-badge"><LockKeyhole size={12} /> 私人空间</span></div></header>
      <section className="hero" aria-labelledby="hero-title"><div className="hero-grid" /><div className="hero-nebula" /><div className="hero-content"><div className="hero-kicker"><span /> YOUR OWN LITTLE UNIVERSE</div><h1 id="hero-title">让心事，<br />有处<span className="serif-highlight">着陆。</span></h1><p className="hero-description">在喧嚣之外，拥有一颗自己的星球。<br />收藏日常的微光，也安放心底的潮汐。</p><button className="primary-button hero-button" onClick={create}><Plus size={18} /> 写一篇日记 <ArrowUpRight size={17} /></button><div className="hero-footnote"><span className="tiny-line" /> 每一个平凡的日子，都值得被记住</div></div>
        <div className="planet-stage" role="img" aria-label="可拖动旋转的紫色3D星球"><div className="planet-aura" /><Suspense fallback={<div className="planet-fallback"><div /><span>你的星球正在缓缓浮现</span></div>}><PlanetScene /></Suspense></div>
        <div className="planet-label"><span className="planet-label-dot" /><div>属于你的第 <strong>001</strong> 号星球<span>XINYU · A PLACE TO BE YOURSELF</span></div></div><div className="drag-hint"><Orbit size={14} /> 拖动星球，换个角度看世界</div><div className="hero-corner">EST. {new Date().getFullYear()} <span>✦</span></div>
      </section>
      <section className="summary-strip" aria-label="日记统计"><div className="summary-intro"><span className="summary-spark"><Sparkles size={20} strokeWidth={1.3} /></span><div><strong>一点一滴，都是你</strong><p>把时间写成属于自己的故事</p></div></div><div className="stat"><strong>{String(entries.length).padStart(2, '0')}</strong><span>篇日记</span></div><div className="stat"><strong>{totalWords.toLocaleString()}</strong><span>字的心事</span></div><div className="stat last-stat"><span className="status-dot" /><span>此刻，安心记录</span><LockKeyhole size={13} /></div></section>
      <section id="journals" className="journals" aria-labelledby="journals-heading"><div className="journals-header"><div><div className="section-kicker">LITTLE MOMENTS, LASTING MEMORIES</div><h2 id="journals-heading">日记手札 <span>{query.trim() ? `${results.length} 条匹配` : `${entries.length} 篇记录`}</span></h2></div><div className="journal-actions"><div className="search-field"><Search size={16} /><input ref={searchRef} value={query} onChange={e => setQuery(e.target.value)} placeholder="寻找某个瞬间…" aria-label="搜索日记标题和正文" />{query && <button className="search-clear" aria-label="清空搜索" onClick={() => { setQuery(''); searchRef.current?.focus() }}><X size={14} /></button>}</div><button className="new-entry-button" onClick={create}><Plus size={16} /> 新建日记</button></div></div>
        {initial.error && <p className="storage-error" role="alert">{initial.error}<button onClick={exportBackup}>导出原始备份 <ArrowDownToLine size={14} /></button></p>}
        {results.length ? <div className="diary-grid">{results.map(entry => { const date = dateParts(entry.date); return <button className="diary-card" key={entry.id} onClick={() => setModal({ entry, mode: 'read' })}><div className="card-top"><div className="card-date"><strong>{date.day}</strong><span>{date.month}</span></div><ArrowUpRight size={19} /></div><h3>{entry.title}</h3><p>{entry.content}</p><div className="card-bottom"><span><span className="mini-star">✧</span> 日常的一页</span><span>{entry.content.length.toLocaleString()} 字</span></div></button> })}</div> : <div className="empty-state"><div className="empty-orbit"><span /><Feather size={28} strokeWidth={1.2} /></div><h3>{query.trim() ? '这一片星空里，还没有找到它' : '故事，从今天开始'}</h3><p>{query.trim() ? '换个关键词试试，也许回忆就在下一页。' : '不必等到特别的日子。此刻的心情，就值得一页。'}</p><button className="empty-action" onClick={query.trim() ? () => setQuery('') : create}>{query.trim() ? '清空搜索' : '写下第一篇日记'} <ArrowUpRight size={15} /></button><span className="empty-stars" aria-hidden="true">✦ · ✧</span></div>}
      </section><footer className="main-footer"><span>慢慢写，慢慢生活。</span><span><LockKeyhole size={12} /> 日记仅保存在当前浏览器，请定期导出备份。</span><span>XINYU <span className="footer-star">✦</span></span></footer>
    </main>{notice && <div className="toast" role="status"><Check size={16} />{notice}</div>}{modal && <DiaryDialog entry={modal.entry} initialMode={modal.mode} onClose={() => setModal(null)} onSave={save} onDelete={remove} />}
  </div>
}
