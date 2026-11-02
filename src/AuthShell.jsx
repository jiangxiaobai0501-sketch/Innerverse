import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { LockKeyhole, ShieldCheck, X } from 'lucide-react'
const PrivateApp = lazy(() => import('./App.jsx'))
const bridge = window.xinyuLock

function PasswordField({ id, label, value, onChange, autoComplete = 'new-password', autoFocus = false }) {
  return <label className="lock-field" htmlFor={id}>{label}<input className="form-input" id={id} type="password" value={value} onChange={e => onChange(e.target.value)} autoComplete={autoComplete} autoFocus={autoFocus} required /></label>
}
function SecuritySettings({ state, onState, onClose }) {
  const dialog = useRef(null)
  const [oldPassword, setOldPassword] = useState(''), [password, setPassword] = useState(''), [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  useEffect(() => { const element = dialog.current; element.showModal(); return () => element.close() }, [])
  async function change(event) {
    event.preventDefault(); setBusy(true); setError('')
    try {
      const result = await bridge.changePassword(oldPassword, password, confirmation)
      setOldPassword(''); setPassword(''); setConfirmation('')
      if (!result.ok) setError(result.error)
      onState(result.state)
    } catch { setError('修改失败，旧密码配置仍予保留。') }
    finally { setBusy(false) }
  }
  async function idle(event) {
    setBusy(true); setError('')
    try { const result = await bridge.setIdle(Number(event.target.value)); if (!result.ok) setError(result.error); onState(result.state) }
    catch { setError('自动锁定设置未保存，请重试。') }
    finally { setBusy(false) }
  }
  return <dialog ref={dialog} className="diary-dialog security-dialog" aria-labelledby="security-title" onCancel={onClose}>
    <div className="dialog-toolbar"><span className="eyebrow"><ShieldCheck size={16} /> 私人空间</span><button className="icon-button" aria-label="关闭安全设置" onClick={onClose}><X size={20} /></button></div>
    <h2 id="security-title">安全设置</h2>
    <label className="lock-field" htmlFor="idle-minutes">闲置自动锁定<select aria-label="闲置自动锁定" id="idle-minutes" className="form-input" disabled={busy} value={state.idleMinutes ?? 0} onChange={idle}>{[0,5,15,30].map(value => <option value={value} key={value}>{value ? `闲置 ${value} 分钟` : '关闭（默认）'}</option>)}</select></label>
    <p className="lock-note">按此窗口内的真实鼠标、键盘和触摸操作计时。在其他应用中操作不会延长解锁时间。锁定会清除未保存的编辑，请先保存。</p>
    <form onSubmit={change}><h3>修改密码</h3><fieldset disabled={busy} className="lock-fields">
      <PasswordField id="old-password" label="当前密码" value={oldPassword} onChange={setOldPassword} autoComplete="current-password" />
      <PasswordField id="new-password" label="新密码（至少 8 个字符）" value={password} onChange={setPassword} />
      <PasswordField id="new-confirmation" label="再次输入新密码" value={confirmation} onChange={setConfirmation} />
      <button className="primary-button" type="submit">{busy ? '正在处理…' : '更新密码并锁定'}</button>
    </fieldset></form>
    {error && <p role="alert" className="form-error">{error}</p>}
    <p className="lock-note">没有邮箱找回或万能密码。请妥善保存密码，并在应用关闭后备份完整数据目录（包含 security）。此应用锁不加密日记或导出的备份，无法阻止拥有本机文件权限的人直接读取文件。</p>
  </dialog>
}
export default function AuthShell() {
  const [state, setState] = useState({ phase: 'loading', session: -1 }), [settings, setSettings] = useState(false)
  const [password, setPassword] = useState(''), [confirmation, setConfirmation] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const generation = useRef(0)
  function receive(next) {
    if (!next) return
    setState(previous => next.session < previous.session ? previous : next)
    if (next.phase !== 'unlocked') { generation.current++; setSettings(false); setPassword(''); setConfirmation('') }
  }
  useEffect(() => {
    if (!bridge) { setState({ phase: 'unavailable', session: 0 }); return }
    let active = true
    const unsubscribe = bridge.onStateChanged(next => { if (active) receive(next) })
    bridge.status().then(result => { if (active) receive(result.state) }).catch(() => { if (active) setState({ phase: 'blocked', session: 0 }) })
    return () => { active = false; unsubscribe() }
  }, [])
  async function submit(event) {
    event.preventDefault(); setError(''); setBusy(true)
    const version = generation.current
    try {
      const result = state.phase === 'setup' ? await bridge.setup(password, confirmation) : await bridge.unlock(password)
      setPassword(''); setConfirmation('')
      if (!result.ok) setError(result.error + (result.retryAfterMs ? ` 请等待约 ${Math.ceil(result.retryAfterMs / 1000)} 秒。` : ''))
      // Main-process state events are authoritative; a manual lock cancels old form submissions.
      if (version === generation.current || result.state?.phase !== 'unlocked') receive(result.state)
    } catch { setError('暂时无法验证，请重试。') }
    finally { setBusy(false) }
  }
  function manualLock() {
    setState(previous => ({ ...previous, phase: 'locked' })); setSettings(false); generation.current++
    bridge.lock().then(result => receive(result.state)).catch(() => setError('锁定响应失败，请关闭应用后重启。'))
  }
  if (state.phase === 'unlocked') return <><Suspense fallback={<div className="lock-screen"><p>正在打开私人空间…</p></div>}><PrivateApp key={state.session} onLock={manualLock} onSecuritySettings={() => setSettings(true)} /></Suspense>{settings && <SecuritySettings state={state} onState={receive} onClose={() => setSettings(false)} />}</>
  const setup = state.phase === 'setup'
  return <main className="lock-screen"><section className="lock-card" aria-labelledby="lock-title"><div className="lock-symbol"><LockKeyhole size={32} strokeWidth={1.3} /></div><span className="eyebrow">心屿 · XINYU</span>
    <h1 id="lock-title">{setup ? '为心事设一道门' : state.phase === 'loading' ? '正在检查私人空间' : '你的宇宙，静候开启'}</h1>
    {['setup','locked'].includes(state.phase) ? <><p className="lock-note">{setup ? '设置本机密码，至少 8 个字符。支持粘贴和密码管理器。' : '输入本机密码，打开你的记忆。'}</p><form onSubmit={submit}><fieldset disabled={busy} className="lock-fields">
      <PasswordField id="lock-password" label={setup ? '设置密码' : '密码'} value={password} onChange={setPassword} autoComplete={setup ? 'new-password' : 'current-password'} autoFocus />
      {setup && <PasswordField id="lock-confirmation" label="再次输入密码" value={confirmation} onChange={setConfirmation} />}
      <button className="primary-button" type="submit">{busy ? '正在验证…' : setup ? '设置并进入' : '解锁私人空间'}</button>
    </fieldset></form><p className="lock-note">忘记密码？本应用没有邮箱找回。请保管好密码，删除单个密码配置不会进入重新设置。应用锁不等于文件加密。</p></> : state.phase === 'blocked' ? <p className="form-error" role="alert">安全配置缺失、损坏或无法读取，已拒绝访问。请关闭应用，备份当前数据，再从可信备份恢复完整 security 文件夹。请勿删除配置重设密码。</p> : state.phase === 'unavailable' ? <p className="lock-note">请使用心屿桌面应用打开。浏览器预览没有安全的本机密码验证服务，已暂停私人数据访问。</p> : <p className="lock-note">日记和附件尚未加载。</p>}
    {error && <p className="form-error" role="alert">{error}</p>}
  </section></main>
}
