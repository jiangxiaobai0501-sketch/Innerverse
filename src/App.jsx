import {DEFAULT_STAGES, entriesForStage, stageOf, validateStages} from './life-stages.js'
import StagePanel from './StagePanel.jsx'
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDownToLine, ArrowUpRight, BookOpen, Check, ChevronRight, Feather, Globe2, LockKeyhole, Orbit, Pencil, Plus, Search, ShieldCheck, Sparkles, Trash2, Star, CalendarDays, ImagePlus, RotateCcw, X } from 'lucide-react'
import { loadEntries, localDate, saveEntries, searchEntries, STORAGE_KEY, applyDiaryEdit, applyDiaryMetadata, normalizeEntry } from './storage'
import Timeline from './Timeline.jsx'
import DiaryImages from './DiaryImages.jsx'
import './boundless.css'
import { diaryDateParts } from './timeline.js'
const MOODS = [{ value: 'happy', label: '开心 😊' }, { value: 'calm', label: '平静 😌' }, { value: 'sad', label: '难过 😢' }, { value: 'anxious', label: '焦虑 😰' }]
const moodLabel = mood => MOODS.find(item => item.value === mood)?.label ?? '未选择心情'
const desktop = Boolean(window.xinyuDiary)
const PlanetScene = lazy(() => import('./PlanetScene'))
const displayDate = date => !diaryDateParts(date) ? '日期待确认' : new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' }).format(new Date(`${date}T12:00:00`))
const dateParts = date => { const [y, m, d] = date.split('-'); return { day: d, month: `${y}.${m}` } }
function download(content, filename) {
  const blob = new Blob([content], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
function DiaryCard({ entry, onOpen, timeline = false }) {
  const validDate = diaryDateParts(entry.date)
  const date = validDate ? dateParts(entry.date) : { day: '—', month: '日期待确认' }
  return <button className={`diary-card ${timeline ? 'timeline-card' : ''}`} onClick={() => onOpen(entry)}><div className="card-top"><div className="card-date"><strong>{date.day}</strong><span>{date.month}</span></div><ArrowUpRight size={19} /></div>{timeline && <time className="timeline-date" dateTime={validDate ? entry.date : undefined}>{validDate ? entry.date : typeof entry.date === 'string' && entry.date ? `日期待确认 · ${entry.date}` : '日期待确认'}</time>}<h3>{entry.title}</h3><p>{entry.content}</p><div className="card-bottom"><span><span className={`mini-star ${entry.isFavorite ? 'is-favorite' : ''}`} aria-label={entry.isFavorite ? '已收藏' : undefined}>{entry.isFavorite ? '★' : '✧'}</span> {entry.mood ? moodLabel(entry.mood) : '日常的一页'}</span><span>{entry.content.length.toLocaleString()} 字</span></div></button>
}
function DiaryDialog({ entry, initialMode, onClose, onSave, onDelete, onFavorite, stages, initialStage }) {
  const dialog = useRef()
  const [mode, setMode] = useState(initialMode)
  const [title, setTitle] = useState(entry?.title ?? '')
  const [date, setDate] = useState(entry?.date ?? localDate())
  const [content, setContent] = useState(entry?.content ?? '')
  const [stageId,setStageId] = useState(entry?.stageId ?? initialStage ?? '')
  const [mood, setMood] = useState(entry?.mood ?? null)
  const [images, setImages] = useState(entry?.images ?? [])
  const imported = useRef(new Set())
  const [draftFavorite, setDraftFavorite] = useState(false)
  const [error, setError] = useState('')
  const [readActions, setReadActions] = useState(false)
  const [saving, setSaving] = useState(false)
  const dirty = stageId !== (entry?.stageId ?? initialStage ?? '') || title !== (entry?.title ?? '') || date !== (entry?.date ?? localDate()) || content !== (entry?.content ?? '') || mood !== (entry?.mood ?? null) || (!entry && draftFavorite) || JSON.stringify(images) !== JSON.stringify(entry?.images ?? [])
  async function close() {
    if (saving) return
    if (mode === 'edit' && dirty && !window.confirm('还有未保存的内容，确定放弃这次修改吗？')) return
    if (desktop && imported.current.size) {
      setSaving(true)
      const result = await window.xinyuDiary.discardImages([...imported.current]).catch(() => null)
      setSaving(false)
      if (!result?.ok) { setError('临时照片清理失败，编辑内容已保留，请重试。'); return }
      imported.current.clear()
    }
    onClose()
  }
  async function addImages() {
    setSaving(true); setError('')
    try {
      const result = await window.xinyuDiary.importImages(3 - images.length)
      if (!result.ok) throw new Error(result.error)
      if (!result.canceled) { result.images.forEach(image => imported.current.add(image.id)); setImages(current => [...current, ...result.images]) }
    } catch (error) { setError(error.message || '添加照片失败，原内容已保留。') }
    finally { setSaving(false) }
  }
  async function removeImage(image) {
    if (imported.current.has(image.id)) {
      setSaving(true)
      const result = await window.xinyuDiary.discardImages([image.id]).catch(() => null)
      setSaving(false)
      if (!result?.ok) { setError('移除临时照片失败，请重试。'); return }
      imported.current.delete(image.id)
    }
    setImages(current => current.filter(item => item.id !== image.id))
  }
  useEffect(() => { const element = dialog.current; element.showModal(); return () => element.close() }, [])
  useEffect(()=>{const key=e=>{if(mode!=='read'||e.repeat||e.ctrlKey||e.metaKey||e.altKey||e.key.toLowerCase()!=='h')return;if([...document.querySelectorAll('dialog[open]')].at(-1)!==dialog.current)return;e.preventDefault();e.stopImmediatePropagation();setReadActions(v=>!v)};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key)},[mode])
  useEffect(() => {
    const preventLoss = event => { if (dirty || saving) { event.preventDefault(); event.returnValue = '' } }
    window.addEventListener('beforeunload', preventLoss)
    return () => window.removeEventListener('beforeunload', preventLoss)
  }, [dirty, saving])
  async function submit(event) {
    event.preventDefault()
    if (!title.trim() || !content.trim()) { setError('请填写标题和正文，空白也是需要文字陪伴的。'); return }

    setSaving(true)
    if (await onSave({ title: title.trim(), date, content: content.trim(), mood, images, stageId: stageId || null, ...(!entry ? { isFavorite: draftFavorite } : {}) }, entry?.id ?? null)) onClose()
    else setError('保存失败。请检查本机文件权限或磁盘空间；内容仍保留在这里，可先复制备份。')
    setSaving(false)
  }
  const favorite = entry ? entry.isFavorite : draftFavorite
  async function toggleFavorite() {
    if (!entry) { setDraftFavorite(value => !value); return }
    setSaving(true)
    if (!await onFavorite(entry.id)) setError('收藏保存失败，原状态已保留，请重试。')
    else setError('')
    setSaving(false)
  }
  const favoriteButton = <button type="button" className={`secondary-button favorite-toggle ${favorite ? 'is-favorite' : ''}`} aria-pressed={Boolean(favorite)} disabled={saving} onClick={toggleFavorite}><Star size={16} fill={favorite ? 'currentColor' : 'none'} />{entry ? (favorite ? '取消收藏' : '收藏日记') : (favorite ? '保存时收藏 ✓' : '保存时收藏')}</button>
  return <dialog ref={dialog} className={'diary-dialog immersive-diary '+(mode==='read'?'is-reading':'is-editing')+(readActions?' read-actions-open':'')} aria-labelledby="dialog-title" onCancel={e => { e.preventDefault(); close() }} onClick={e => { if (e.target === dialog.current) { const r = dialog.current.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) close() } }}>
    <div className="dialog-toolbar"><span className="eyebrow"><Feather size={15} /> {mode === 'read' ? '一页心事' : entry ? '重新拾起这一页' : '给此刻一个位置'}</span><button className="icon-button" aria-label="关闭日记" onClick={close}><X size={20} /></button></div>
    {mode === 'read' ? <><div className="read-meta">{displayDate(entry.date)} · {stages.find(stage=>stage.id===entry.stageId)?.name ?? '未分类记忆'}<span>保存于 {new Date(entry.updatedAt).toLocaleString('zh-CN', { hour12: false })}</span></div><div className="diary-metadata"><span className="mood-badge">{moodLabel(entry.mood)}</span>{favoriteButton}</div>{error && <p className="form-error" role="alert">{error}</p>}<h2 id="dialog-title" className="read-title">{entry.title}</h2><div className="read-body">{entry.content}</div><DiaryImages images={entry.images ?? []} /><div className="dialog-footer"><button className="text-button danger" disabled={saving} onClick={async () => { setSaving(true); if (await onDelete(entry.id)) onClose(); setSaving(false) }}><Trash2 size={16} /> 删除日记</button><button className="primary-button" disabled={saving} onClick={() => setMode('edit')}><Pencil size={16} /> 编辑这一页</button></div></> : <form onSubmit={submit}>
      <h2 id="dialog-title">{entry ? '修改日记' : '写下今天的故事'}</h2>
      <label className="field-label" htmlFor="diary-title">标题</label><input id="diary-title" className="form-input title-input" disabled={saving} autoFocus value={title} maxLength={80} onChange={e => setTitle(e.target.value)} placeholder="今天，想记住什么？" required />
      <label className="field-label" htmlFor="diary-date">日期</label><input id="diary-date" className="form-input date-input" disabled={saving} type="date" min="0001-01-01" max="9999-12-31" value={date} onChange={e => setDate(e.target.value)} required />
      <label className="field-label" htmlFor="diary-stage">人生阶段</label><select id="diary-stage" className="form-input" disabled={saving} value={stageId} onChange={e=>setStageId(e.target.value)}><option value="">未分类记忆</option>{stages.map(stage=><option key={stage.id} value={stage.id}>{stage.name}</option>)}</select>
      <fieldset className="mood-picker" disabled={saving}><legend className="field-label">此刻的心情</legend><div className="mood-options">{[{ value: null, label: '不选择' }, ...MOODS].map(item => <label className="mood-option" key={item.value ?? 'none'}><input type="radio" name="diary-mood" value={item.value ?? ''} checked={mood === item.value} onChange={() => setMood(item.value)} /><span>{item.label}</span></label>)}</div></fieldset>
      <div className="diary-metadata">{favoriteButton}{!entry && <span className="muted text-xs">首次保存日记时生效</span>}</div>
      <label className="field-label" htmlFor="diary-content">正文 <span>不用写得完美，真实就好</span></label><textarea disabled={saving} id="diary-content" className="form-input" value={content} maxLength={100000} onChange={e => setContent(e.target.value)} placeholder="那些细小的快乐、没说出口的话，或者只是今天的天气……" required rows={9} />
      <div className="photos-heading"><span className="field-label">照片 · {images.length}/3</span>{desktop ? <button type="button" className="secondary-button" disabled={saving || images.length >= 3} onClick={addImages}><ImagePlus size={16} /> 添加照片</button> : <span className="muted text-xs">请使用桌面版添加本地照片</span>}</div><p className="photo-note">JPG、PNG、WebP · 单张最多 10 MiB。移除已有照片后需保存日记才生效。</p><DiaryImages images={images} onRemove={removeImage} disabled={saving} />
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="dialog-footer"><span className="muted text-xs">{content.length.toLocaleString()} 字 · {desktop ? '保存在本机日记文件' : '保存在此浏览器'}</span><div className="flex items-center gap-3"><button type="button" disabled={saving} className="secondary-button" onClick={close}>取消</button><button disabled={saving} className="primary-button" type="submit"><Check size={17} /> {saving ? '正在保存…' : '保存日记'}</button></div></div>
    </form>}
  </dialog>
}
export default function App({ onLock, onSecuritySettings }) {
  const [initial, setInitial] = useState({ loading: true, error: '', dataPath: '' })
  const [entries, setEntries] = useState([])
  const savingRef = useRef(false)
  useEffect(() => {
    let active = true
    async function load() {
      try {
        const result = desktop ? await window.xinyuDiary.load() : loadEntries(window.localStorage)
        if (!active) return
        setEntries(result.entries ?? [])
        setInitial({ loading: false, error: result.error ?? '', dataPath: result.dataPath ?? '' })
      } catch { if (active) setInitial({ loading: false, error: '读取日记失败，已暂停保存以保护原数据。', dataPath: '' }) }
    }
    load()
    return () => { active = false }
  }, [])
  const [stages,setStages]=useState(DEFAULT_STAGES),[stageError,setStageError]=useState(''),[stageId,setStageId]=useState(null),[listStage,setListStage]=useState(null)
  useEffect(()=>{let active=true;(async()=>{try{const result=desktop?await window.xinyuDiary.loadStages():{ok:true,stages:JSON.parse(localStorage.getItem('xinyu.stages.v1')??JSON.stringify(DEFAULT_STAGES))};if(!result.ok)throw Error(result.error);if(active)setStages(validateStages(result.stages))}catch(e){if(active)setStageError(e.message)}})();return()=>{active=false}},[])
  async function saveStages(next){try{validateStages(next);if(desktop){const result=await window.xinyuDiary.saveStages(next);if(!result.ok)throw Error(result.error)}else localStorage.setItem('xinyu.stages.v1',JSON.stringify(next));setStages(next);return true}catch(e){notify(e.message);return false}}
  function selectStage(id){setStageId(id);setMemoryId(null);setViewing(false);setActiveNav('home');setControlsOpen(false);setStageManager(false)}
  const [viewing,setViewing]=useState(false),[graphicsFailed,setGraphicsFailed]=useState(false)
  const [query, setQuery] = useState('')
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [modal, setModal] = useState(null)
  const [memoryId, setMemoryId] = useState(null)
  const memoryPreview = useRef(null)
  const selectMemory = useCallback(id => {setMemoryId(null);if(id){setControlsOpen(false);setSettingsOpen(false);setModal({entry:{id},mode:'read'})}}, [])
  const selectedMemory = memoryId ? entries.find(entry => entry.id === memoryId) : null
  useEffect(() => { if (memoryId) memoryPreview.current?.scrollIntoView({ block: 'nearest', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' }) }, [memoryId])
  const [notice, setNotice] = useState('')
  const [restoring, setRestoring] = useState(false)
  const [activeNav, setActiveNav] = useState('home')
  const [controlsOpen,setControlsOpen]=useState(false),[settingsOpen,setSettingsOpen]=useState(false),[stageManager,setStageManager]=useState(false)
  useEffect(()=>{
    const key=e=>{
      if(e.repeat||e.ctrlKey||e.metaKey||e.altKey||document.querySelector('dialog[open],.stage-editor'))return
      const typing=e.target instanceof HTMLElement&&(e.target.matches('input,textarea,select')||e.target.isContentEditable)
      if(e.key==='Escape'){
        if(stageManager){setStageManager(false);e.preventDefault()}
        else if(settingsOpen){setSettingsOpen(false);e.preventDefault()}
        else if(controlsOpen){setControlsOpen(false);e.preventDefault()}
        else if(activeNav!=='home'){setActiveNav('home');e.preventDefault()}
      }else if(!typing&&e.key.toLowerCase()==='h'&&activeNav==='home'){
        e.preventDefault();setSettingsOpen(false);setStageManager(false);setControlsOpen(v=>!v)
      }
    };window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key)
  },[controlsOpen,settingsOpen,stageManager,activeNav])
  const toastTimer = useRef()
  const searchRef = useRef()
  const results = useMemo(() => searchEntries(entriesForStage(entries,listStage), query, favoritesOnly), [entries, query, favoritesOnly, listStage])
  const universeEntries = useMemo(() => entriesForStage(favoritesOnly ? entries.filter(entry => entry.isFavorite === true) : entries,stageId), [entries, favoritesOnly,stageId])
  const matchingIds = useMemo(() => query.trim() ? new Set(searchEntries(entries,query,favoritesOnly).map(entry => entry.id)) : null, [results, query])
  const totalWords = entries.reduce((count, entry) => count + entry.content.length, 0)
  useEffect(() => () => clearTimeout(toastTimer.current), [])
  function notify(message) { setNotice(message); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setNotice(''), 3500) }
  async function commit(next) {
    if (initial.loading || initial.error || restoring || savingRef.current) { notify(initial.error || '正在处理日记，请稍候。'); return false }
    savingRef.current = true
    try {
      if (desktop) { const result = await window.xinyuDiary.save(next); if (!result.ok) throw new Error(result.error) }
      else saveEntries(window.localStorage, next)
      setEntries(next); return true
    } catch (error) { notify(error.message || '无法保存：请检查本机文件权限或磁盘空间。'); return false }
    finally { savingRef.current = false }
  }
  async function save(changes, originalId = null) {
    // Look up the latest record by its separate, immutable identity, not by fields in the edit patch.
    const original = originalId === null ? null : entries.find(item => item.id === originalId)
    if (originalId !== null && !original) { notify('原日记不存在，已取消保存，避免创建错误记录。'); return false }
    try {
      const edited = applyDiaryEdit(original, changes, new Date().toISOString(), original ? undefined : crypto.randomUUID())
      const metadata = applyDiaryMetadata(edited, { mood: changes.mood, stageId: changes.stageId, ...(!original ? { isFavorite: changes.isFavorite ?? false } : {}) })
      const entry = Object.hasOwn(changes, 'images') ? normalizeEntry({ ...metadata, images: changes.images }) : metadata
      const success = await commit([...entries.filter(item => item.id !== entry.id), entry])
      if (success) notify('这一刻，已在心屿安放。')
      return success
    } catch (error) { notify(error.message); return false }
  }
  async function toggleFavorite(id) {
    const original = entries.find(item => item.id === id)
    if (!original) { notify('原日记不存在，收藏未保存。'); return false }
    try {
      const updated = applyDiaryMetadata(original, { isFavorite: !original.isFavorite })
      const success = await commit(entries.map(item => item.id === id ? updated : item))
      if (success) notify(updated.isFavorite ? '已收藏这一页。' : '已取消收藏，日记仍然保留。')
      return success
    } catch (error) { notify(error.message); return false }
  }
  async function remove(id) { if (!window.confirm('确定删除这篇日记吗？删除后无法撤销，建议先导出备份。')) return false; const success = await commit(entries.filter(item => item.id !== id)); if (success) notify('日记已删除。'); return success }
  function create(initialStage = null) { if (restoring) { notify('正在恢复备份，请稍候。'); return }; if (initial.loading) { notify('正在读取本机日记，请稍候。'); return }; if (initial.error) { notify(initial.error); return }; setModal({ entry: null, mode: 'edit', initialStage: typeof initialStage==='string' && initialStage!=='unclassified'?initialStage:null }) }
  async function restoreBackup() {
    if (restoring || savingRef.current || modal) { notify('请先完成当前操作。'); return }
    setRestoring(true)
    try {
      const result = await window.xinyuDiary.restore()
      if (!result.ok) throw new Error(result.error)
      if (!result.canceled) { setEntries(result.entries); notify('备份已恢复；恢复前的数据已自动备份到本机 recovery 目录。') }
    } catch (error) { notify(error.message || '恢复失败，原有数据已保留。') }
    finally { setRestoring(false) }
  }
  async function exportBackup() {
    try {
      if (desktop) { const result = await window.xinyuDiary.backup(); if (!result.ok) throw new Error(result.error); if (!result.canceled) notify('日记备份已保存。'); return }
      if (initial.error) { const raw = window.localStorage.getItem(STORAGE_KEY); if (raw === null) throw new Error(); download(raw, `心屿_原始备份_${localDate()}.json`) }
      else download(JSON.stringify({ app: 'Xinyu', version: 1, exportedAt: new Date().toISOString(), entries }, null, 2), `心屿_日记备份_${localDate()}.json`)
      notify('已发起备份下载，请查看浏览器下载列表。')
    } catch { notify('导出失败，请检查文件访问权限或选择其他位置。') }
  }
  function navigate(target) {setControlsOpen(false);setSettingsOpen(false);setViewing(false);setActiveNav(target);requestAnimationFrame(()=>document.getElementById(target === 'home' ? 'home' : 'journals')?.scrollIntoView({behavior:'instant'}))}
  return <div className={'app-shell boundless-app '+(activeNav==='home'?'cosmos-mode':'archive-mode')+(viewing?' universe-viewing':'')}>
    {activeNav==='home'&&controlsOpen&&<section className="command-panel" aria-label="宇宙控制界面"><div className="command-heading"><span>心屿 <small>4.0 · 无界星海</small></span><button className="icon-button" aria-label="关闭控制界面" onClick={()=>setControlsOpen(false)}><X size={19}/></button></div><div className="command-links"><button onClick={()=>{setControlsOpen(false);create(stageId)}}>写一篇日记</button><button onClick={()=>navigate('journals')}>打开日记手札</button><button onClick={()=>navigate('timeline')}>时间轴</button><button onClick={()=>{setControlsOpen(false);setStageManager(true)}}>管理人生阶段</button><button onClick={()=>{setControlsOpen(false);setSettingsOpen(true)}}>银河显示设置</button><button onClick={exportBackup}>导出备份</button>{desktop&&<button disabled={restoring} onClick={restoreBackup}>恢复备份</button>}{onSecuritySettings&&<button onClick={()=>{setControlsOpen(false);onSecuritySettings()}}>安全设置</button>}{onLock&&<button onClick={onLock}>锁定私人空间</button>}</div><p>拖动观察 · 滚轮缩放 · 点击星球穿梭<br/>Esc 返回 · H 呼出或收起 · F11 全屏</p></section>}
    <aside className="sidebar"><a className="brand" href="#home" onClick={e => { e.preventDefault(); navigate('home') }} aria-label="心屿首页"><span className="brand-icon"><Orbit size={29} strokeWidth={1.3} /></span><span className="brand-name">心屿<span>XINYU</span></span></a>
      <div className="sidebar-section-label">一个人的宇宙</div><nav aria-label="主要导航"><button className={`nav-item ${activeNav === 'home' ? 'active' : ''}`} onClick={() => navigate('home')}><Globe2 size={18} /> 我的心屿 <span className="nav-dot" /></button><button className={`nav-item ${activeNav === 'journals' ? 'active' : ''}`} onClick={() => navigate('journals')}><BookOpen size={18} /> 日记手札 <span className="nav-count">{entries.length}</span></button><button className={`nav-item ${activeNav === 'timeline' ? 'active' : ''}`} onClick={() => navigate('timeline')}><CalendarDays size={18} /> 时间轴</button></nav>
      <div className="sidebar-divider" /><div className="sidebar-section-label">好好收藏</div><button className="nav-item" onClick={exportBackup}><ArrowDownToLine size={18} /> 导出备份 <ArrowUpRight className="nav-arrow" size={14} /></button>
      {desktop && <button className="nav-item" disabled={restoring} onClick={restoreBackup}><RotateCcw size={18} /> {restoring ? '正在恢复…' : '恢复备份'}</button>}
      {onSecuritySettings && <button className="nav-item" onClick={onSecuritySettings}><ShieldCheck size={18} /> 安全设置</button>}
      {onLock && <button className="nav-item" onClick={onLock}><LockKeyhole size={18} /> 锁定私人空间</button>}
      <div className="sidebar-poem"><span className="little-star">✧</span><p>世界很大，<br />这里刚好容得下你。</p><div className="poem-line" /></div>
      <div className="privacy-card"><ShieldCheck size={19} /><div><strong>心事，只属于你</strong><p>本地保存 · 不上传云端</p></div><span className="status-dot" /></div><div className="sidebar-footer">心屿 XINYU <span>© {new Date().getFullYear()}</span></div>
    </aside>
    <main id="home" className="main-content">
      <header className="topbar"><div className="breadcrumb">我的空间 <ChevronRight size={13} /><span>心屿</span></div><div className="topbar-right"><span className="today-label">{displayDate(localDate())}</span><span className="private-badge"><LockKeyhole size={12} /> 私人空间</span></div></header>
      <section className="hero" aria-labelledby="hero-title"><div className="hero-grid" /><div className="hero-nebula" /><div className="hero-content"><div className="hero-kicker"><span /> YOUR OWN LITTLE UNIVERSE</div><h1 id="hero-title">让心事，<br />有处<span className="serif-highlight">着陆。</span></h1><p className="hero-description">在人生星系，收藏每一段自己的时光。<br />收藏日常的微光，也安放心底的潮汐。</p><button className="primary-button hero-button" onClick={create}><Plus size={18} /> 写一篇日记 <ArrowUpRight size={17} /></button><div className="hero-footnote"><span className="tiny-line" /> 每一个平凡的日子，都值得被记住</div></div>
        <div className="planet-stage" role="region" aria-label="可拖动旋转的3D宇宙与记忆星图"><div className="planet-aura" /><Suspense fallback={<div className="planet-fallback" role="status" aria-label="银河加载中"><div /></div>}><PlanetScene toolsOpen={settingsOpen} onToolsChange={setSettingsOpen} onBrowseDiaries={()=>navigate('journals')} onLock={onLock} onGraphicsFailure={setGraphicsFailed} viewing={viewing} onViewingChange={setViewing} stages={stages} stageId={stageId} onStageSelect={selectStage} entries={stageId===null?[]:universeEntries} onOpenMemory={selectMemory} matchingIds={matchingIds} selectedId={memoryId} paused={Boolean(modal)||activeNav!=='home'||stageManager||controlsOpen||settingsOpen} /></Suspense></div>
        <div className="planet-label"><span className="planet-label-dot" /><div>人生星系 · LIFE GALAXY<span>XINYU · A PLACE TO BE YOURSELF</span></div></div><div className="drag-hint"><Orbit size={14} /> 拖动旋转 · 滚轮缩放 · 点击星点探索记忆</div><div className="hero-corner">EST. {new Date().getFullYear()} <span>✦</span></div>
      </section>
      {stageManager&&<div className="stage-manager"><button className="secondary-button" onClick={()=>setStageManager(false)}>返回宇宙</button><StagePanel key={stageId??'overview'} stages={stages} entries={entries} stageId={stageId} onRead={()=>{const entry=entriesForStage(entries,stageId)[0];if(entry)setModal({entry,mode:'read'})}} onSelect={selectStage} onSave={saveStages} error={stageError} onCreate={()=>create(stageId)} onView={()=>{setListStage(stageId);navigate('journals')}} /></div>}
      {selectedMemory && <section ref={memoryPreview} className="memory-preview-card" aria-labelledby="memory-preview-title"><div className="memory-preview-top"><span className="eyebrow"><Sparkles size={15} /> 记忆预览</span><button className="icon-button" aria-label="关闭记忆卡片" onClick={() => setMemoryId(null)}><X size={18} /></button></div><time dateTime={selectedMemory.date}>{selectedMemory.date}</time><h2 id="memory-preview-title">{selectedMemory.title}</h2><p className="memory-excerpt">{selectedMemory.content.slice(0, 160)}{selectedMemory.content.length > 160 ? '…' : ''}</p><div className="diary-metadata"><span className="mood-badge">{moodLabel(selectedMemory.mood)}</span>{selectedMemory.isFavorite && <span className="is-favorite"><Star size={14} fill="currentColor" /> 已收藏</span>}</div><DiaryImages images={selectedMemory.images ?? []} /><button className="primary-button" onClick={() => { setModal({ entry: selectedMemory, mode: 'read' }); setMemoryId(null) }}><BookOpen size={16} /> 打开这篇日记 <ArrowUpRight size={16} /></button></section>}
      <section className="summary-strip" aria-label="日记统计"><div className="summary-intro"><span className="summary-spark"><Sparkles size={20} strokeWidth={1.3} /></span><div><strong>一点一滴，都是你</strong><p>把时间写成属于自己的故事</p></div></div><div className="stat"><strong>{String(entries.length).padStart(2, '0')}</strong><span>篇日记</span></div><div className="stat"><strong>{totalWords.toLocaleString()}</strong><span>字的心事</span></div><div className="stat last-stat"><span className="status-dot" /><span>此刻，安心记录</span><LockKeyhole size={13} /></div></section>
      <section id="journals" className="journals" aria-labelledby="journals-heading"><div className="journals-header"><div><div className="section-kicker">LITTLE MOMENTS, LASTING MEMORIES</div><h2 id="journals-heading">{activeNav === 'timeline' ? '记忆时间轴' : '日记手札'} <span>{query.trim() || favoritesOnly ? `${results.length} 条匹配` : `${entries.length} 篇记录`}</span></h2></div><div className="journal-actions"><select className="stage-list-filter" aria-label="日记阶段筛选" value={listStage??'all'} onChange={e=>setListStage(e.target.value==='all'?null:e.target.value)}><option value="all">所有人生阶段</option>{stages.map(stage=><option key={stage.id} value={stage.id}>{stage.name}</option>)}<option value="unclassified">未分类记忆</option></select><button className={`secondary-button favorite-toggle ${favoritesOnly ? 'is-favorite' : ''}`} aria-pressed={favoritesOnly} onClick={() => setFavoritesOnly(value => !value)}><Star size={16} fill={favoritesOnly ? 'currentColor' : 'none'} />只看收藏</button><div className="search-field"><Search size={16} /><input ref={searchRef} value={query} onChange={e => setQuery(e.target.value)} placeholder="寻找某个瞬间…" aria-label="搜索日记标题和正文" />{query && <button className="search-clear" aria-label="清空搜索" onClick={() => { setQuery(''); searchRef.current?.focus() }}><X size={14} /></button>}</div><button className="new-entry-button" onClick={create}><Plus size={16} /> 新建日记</button></div></div>
        {initial.error && <p className="storage-error" role="alert">{initial.error}<button onClick={exportBackup}>导出原始备份 <ArrowDownToLine size={14} /></button></p>}
        {results.length ? (activeNav === 'timeline' ? <Timeline entries={results} renderEntry={entry => <DiaryCard key={entry.id} entry={entry} timeline onOpen={entry => setModal({ entry, mode: 'read' })} />} /> : <div className="diary-grid">{results.map(entry => <DiaryCard key={entry.id} entry={entry} onOpen={entry => setModal({ entry, mode: 'read' })} />)}</div>) : <div className="empty-state"><div className="empty-orbit"><span /><Feather size={28} strokeWidth={1.2} /></div><h3>{query.trim() ? '这一片星空里，还没有找到它' : favoritesOnly ? '还没有收藏的记忆' : '故事，从今天开始'}</h3><p>{query.trim() ? '换个关键词试试，也可以关闭收藏筛选。' : favoritesOnly ? '打开一篇日记，点亮星标，留住喜欢的瞬间。' : '不必等到特别的日子。此刻的心情，就值得一页。'}</p><button className="empty-action" onClick={query.trim() ? () => setQuery('') : favoritesOnly ? () => setFavoritesOnly(false) : create}>{query.trim() ? '清空搜索' : favoritesOnly ? '查看全部日记' : '写下第一篇日记'} <ArrowUpRight size={15} /></button><span className="empty-stars" aria-hidden="true">✦ · ✧</span></div>}
      </section><footer className="main-footer"><span>慢慢写，慢慢生活。</span><span title={initial.dataPath}><LockKeyhole size={12} /> {desktop ? '日记保存在本机 JSON 文件，请定期导出备份。' : '日记仅保存在当前浏览器，请定期导出备份。'}</span><span>XINYU <span className="footer-star">✦</span></span></footer>
    </main>{notice && <div className="toast" role="status"><Check size={16} />{notice}</div>}{modal && <DiaryDialog entry={modal.entry ? entries.find(item => item.id === modal.entry.id) ?? modal.entry : null} initialMode={modal.mode} onClose={() => setModal(null)} onSave={save} onDelete={remove} onFavorite={toggleFavorite} stages={stages} initialStage={modal.initialStage} />}
  </div>
}


