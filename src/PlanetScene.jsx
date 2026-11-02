import StarseaEffects from './StarseaEffects.jsx'
import VolumeNebula from './BoundlessNebula.jsx'
import Satellite from './Satellite.jsx'
import UniverseHUD from './UniverseHUD.jsx'
import './cinematic-hud.css'
import CosmicSky from './CosmicSky.jsx'
import {planetVertex as vertex,planetFragment as fragment,cloudFragment,atmosphereVertex,atmosphereFragment} from './planet-material.js'
import FlightDust from './FlightDust.jsx'
import JourneyControls from './JourneyControls.jsx'
import Galaxy from './Galaxy.jsx'
import {BookOpen,Settings2,RotateCcw,ArrowLeft,LockKeyhole} from 'lucide-react'
import AmbientAudio from './AmbientAudio.jsx'
import {orbitSpec,orbitPosition,advanceTime} from './living-universe.js'
import {Nebula,Stardust,DistantGalaxy} from './DeepSpace.jsx'
import {stageTheme,qualityProfile,readCinemaSettings,saveCinemaSettings,canCruise} from './cinema.js'
import { Component, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { AdditiveBlending, BackSide, DoubleSide, Color, MathUtils } from 'three'

import MemoryStars from './MemoryStars.jsx'
import { memoryEntries, MEMORY_PAGE_SIZE, MEMORY_COLORS, memoryCalendar, filterMemoryPeriod, memoryPosition } from './memory-stars.js'

import { readVisualSettings, saveVisualSettings } from './universe-settings.js'

function UniverseClock({motion,animate}) {
 motion.current.autoTick=animate
 const resumed=useRef(true);useEffect(()=>{resumed.current=true},[animate])
 useFrame((_,dt)=>{const delta=animate&&!resumed.current?Math.min(Math.max(dt,0),.05):0;resumed.current=false;motion.current.delta=delta;motion.current.time=advanceTime(motion.current.time??0,delta,animate)},-2);return null
}
function OrbitAnchor({index,motion,children}){const ref=useRef();useFrame(()=>{if(ref.current)ref.current.position.fromArray(index>=0?orbitPosition(index,motion.current.time):[0,0,0])});return <group ref={ref} scale={index>=0?orbitSpec(index).scale:1}>{children}</group>}
function TargetPulse({locked}){
 const ref=useRef(),age=useRef(2),{camera}=useThree(),uniforms=useMemo(()=>({age:{value:2}}),[])
 useEffect(()=>{if(locked)age.current=0},[locked])
 useFrame((_,dt)=>{if(!ref.current)return;age.current=Math.min(2,age.current+Math.min(dt,.05));ref.current.visible=locked&&age.current<1.6;ref.current.lookAt(camera.position);ref.current.material.uniforms.age.value=age.current})
 return <mesh ref={ref} name="target-lock-pulse" raycast={()=>null}><planeGeometry args={[6,6]}/><shaderMaterial uniforms={uniforms} transparent depthWrite={false} blending={AdditiveBlending} vertexShader={`varying vec2 p;void main(){p=uv-.5;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`} fragmentShader={`varying vec2 p;uniform float age;void main(){float r=length(p),ring=exp(-pow((r-(.29+age*.1))/.005,2.));float arcs=exp(-pow((r-.3)/.007,2.))*.2;gl_FragColor=vec4(.5,.84,1.,(ring+arcs)*max(0.,1.-age/1.6)*.42);}`}/></mesh>
}
function Planet({motion,animate,low,slow,index=0,stage,selected,locked,dimmed,onSelect,onTravel,gesture,quality}) {
 const body=useRef(),cloud=useRef(),atmosphere=useRef(),orbit=useRef(),theme=stageTheme(index),[hovered,setHovered]=useState(false)
 const uniforms=useMemo(()=>({tint:{value:new Color(theme.color)},accentColor:{value:new Color(theme.accent)},variant:{value:index%6},brightness:{value:1},detail:{value:.8},time:{value:0}}),[theme,index])
 const cloudUniforms=useMemo(()=>({time:{value:0},cloudColor:{value:new Color(theme.accent)},opacity:{value:theme.clouds}}),[theme])
 const glowUniforms=useMemo(()=>({glow:{value:new Color(theme.color).lerp(new Color('#b6e5ff'),.35)},strength:{value:.2}}),[theme])
 useFrame((_,dt)=>{const delta=motion.current.delta??0,surfaceUniforms=body.current?.material.uniforms??uniforms,clouds=cloud.current?.material.uniforms??cloudUniforms,glow=atmosphere.current?.material.uniforms??glowUniforms;orbit.current?.position.fromArray(orbitPosition(index,motion.current.time));surfaceUniforms.brightness.value=MathUtils.damp(surfaceUniforms.brightness.value,dimmed?.38:1,3.5,delta);surfaceUniforms.detail.value=MathUtils.damp(surfaceUniforms.detail.value,selected?1:.75,2,delta);glow.strength.value=animate?MathUtils.damp(glow.strength.value,selected?.9:hovered?.65:.42,3,delta):(hovered?.65:selected?.9:.42)
   surfaceUniforms.time.value=motion.current.time;clouds.opacity.value=MathUtils.damp(clouds.opacity.value,dimmed?theme.clouds*.15:theme.clouds,3.5,delta);if(animate&&body.current){body.current.rotation.y+=delta*orbitSpec(index).spin*(slow?.5:1);if(cloud.current)cloud.current.rotation.y+=delta*(orbitSpec(index).spin+.008);clouds.time.value+=delta}
 })
 const surface=low?fragment.replace('i<5','i<3'):fragment
 return <group ref={orbit} name={'planet-orbit-'+stage.id} position={orbitPosition(index)} scale={orbitSpec(index).scale} onPointerOver={e=>{e.stopPropagation();setHovered(true)}} onPointerOut={()=>setHovered(false)} rotation={[.17,0,-.2]} onPointerDown={e=>{e.stopPropagation();if(gesture.current)gesture.current.planet=index}} onClick={e=>{if(gesture.current?.planet===index&&!gesture.current.moved&&e.delta<=5){e.stopPropagation();onSelect(stage.id)}}} onDoubleClick={e=>{e.stopPropagation();if(!gesture.current?.moved)onTravel(stage.id)}}>
  <TargetPulse locked={locked&&animate&&!slow}/>
  <mesh ref={body} name={'life-planet-'+stage.id}><sphereGeometry args={[1.58,quality.segments,Math.floor(quality.segments*.7)]}/><shaderMaterial vertexShader={vertex} fragmentShader={surface} uniforms={uniforms}/></mesh>
  {quality.clouds&&<mesh ref={cloud} name={'cloud-layer-'+stage.id} scale={1.012} raycast={()=>null}><sphereGeometry args={[1.58,48,32]}/><shaderMaterial transparent depthWrite={false} vertexShader={vertex} fragmentShader={cloudFragment} uniforms={cloudUniforms}/></mesh>}
  <mesh ref={atmosphere} scale={low?1.035:1.028} raycast={()=>null}><sphereGeometry args={[1.58,quality.segments,Math.floor(quality.segments*.7)]}/><shaderMaterial uniforms={glowUniforms} side={BackSide} transparent blending={AdditiveBlending} depthWrite={false} vertexShader={atmosphereVertex} fragmentShader={atmosphereFragment}/></mesh>
  {(index%6===0||index%6===3)&&<Satellite index={index} motion={motion} low={low}/>}
  <group rotation={[MathUtils.degToRad(66+index*2),.1,-.28+index*.06]}><mesh raycast={()=>null}><ringGeometry args={[1.97,2.68,quality.rings]}/><shaderMaterial transparent side={DoubleSide} depthWrite={false} uniforms={{tint:{value:new Color(theme.accent)},strength:{value:theme.ring}}} vertexShader={`varying vec3 p;varying vec3 ringLight;void main(){p=position;ringLight=normalize(vec3(-1.4,.65,.65)*mat3(modelMatrix));gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`} fragmentShader={`uniform vec3 tint;uniform float strength;varying vec3 p;varying vec3 ringLight;void main(){float r=length(p.xy),t=(r-1.97)/.71;float detail=1.-smoothstep(.25,.8,fwidth(r)*80.);float stripe=mix(.6,.5+.3*sin(r*80.),detail);float gap=1.-.8*(smoothstep(.46,.48,t)-smoothstep(.51,.53,t));float fade=smoothstep(0.,.16,t)*(1.-smoothstep(.72,1.,t));float along=dot(p,ringLight),perpendicular=length(p-ringLight*along);float shadow=mix(1.,smoothstep(1.48,1.68,perpendicular),1.-smoothstep(-.1,.1,along));gl_FragColor=vec4(tint*(.12+.88*shadow),fade*stripe*gap*strength);}`}/></mesh></group>
 </group>
}
function StarLayer({ count, radius, size, brightness, seed: initialSeed, animate }) {
  const material = useRef()
  const { positions, colors } = useMemo(() => {
    let seed = initialSeed
    const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 }
    const positions=[],colors=[],palette=[[.52,.62,.85],[.62,.56,.81],[.75,.82,.93]]
    for(let i=0;i<count;i++){const z=rand()*2-1,a=rand()*Math.PI*2,r=radius+rand()*7,xy=Math.sqrt(1-z*z)*r;positions.push(xy*Math.cos(a),xy*Math.sin(a),z*r);colors.push(...palette[i%3])}
    return { positions:new Float32Array(positions), colors:new Float32Array(colors) }
  }, [count,radius,initialSeed])
  useFrame(({clock})=>{if(material.current&&animate)material.current.opacity=brightness*(.96+.04*Math.sin(clock.elapsedTime*.22+initialSeed))})
  return <points name={'distant-stars-'+initialSeed}><bufferGeometry><bufferAttribute attach="attributes-position" args={[positions,3]}/><bufferAttribute attach="attributes-color" args={[colors,3]}/></bufferGeometry><pointsMaterial ref={material} size={size} vertexColors transparent opacity={brightness} sizeAttenuation depthWrite={false}/></points>
}
function AnimationDriver({ animate, fps }) {
  const invalidate = useThree(state => state.invalidate)
  useEffect(() => {
    if (!animate) return
    let frame, previous = performance.now()
    const interval = 1000 / fps
    const tick = now => {
      const elapsed = now - previous
      if (elapsed >= interval - .5) {
        invalidate()
        previous = now - Math.max(0, elapsed - interval) % interval
      }
      frame = requestAnimationFrame(tick)
    }
    invalidate()
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [animate, fps, invalidate])
  return null
}
function Stars({ low, animate }) {
  return <group name="layered-starfield"><StarLayer count={low?320:1000} radius={180} size={.16} brightness={.32} seed={37} animate={animate}/><StarLayer count={low?60:150} radius={130} size={.15} brightness={.42} seed={73} animate={animate}/><StarLayer count={low?20:45} radius={85} size={.09} brightness={.5} seed={119} animate={animate}/></group>
}
class Boundary extends Component {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(){this.props.onError?.()}
  render() { return this.state.failed ? <div className="planet-fallback"><div /><span>3D 预览暂不可用，日记仍可正常使用</span></div> : this.props.children }
}
export default memo(function PlanetScene({ stages, stageId, onStageSelect, entries = [], onOpenMemory, matchingIds = null, selectedId = null, paused = false, viewing = false, onViewingChange, onBrowseDiaries, onLock, onGraphicsFailure, toolsOpen=false, onToolsChange }) {
  const setToolsOpen=onToolsChange,[lockedId,setLockedId]=useState(null),[phase,setPhase]=useState('OVERVIEW'),[fast,setFast]=useState(false)
  const journeyChange=useCallback(next=>setPhase(next),[])
  function lockTarget(id){if(stageId!==null||flight)return;setLockedId(id);setCruise(false);onOpenMemory?.(null)}
  function travel(id=lockedId){if(flight||stageId===id)return;if(!stages.some(s=>s.id===id))return;setLockedId(null);setToolsOpen(false);setCruise(false);onOpenMemory?.(null);onStageSelect(id);setResetToken(v=>v+1)}
  function returnOverview(){setLockedId(null);setToolsOpen(false);setCruise(false);onStageSelect(null);onOpenMemory?.(null);setResetToken(v=>v+1)}
  const lockedStage=stages.find(s=>s.id===lockedId)
  useEffect(()=>{if(stageId!==null)setLockedId(null)},[stageId])
  const [cinema,setCinema]=useState(()=>readCinemaSettings(window.localStorage)),[cruise,setCruise]=useState(false),[flight,setFlight]=useState(false),[finishToken,setFinishToken]=useState(0)
  const stopCruise=useCallback(()=>setCruise(false),[]),flightChange=useCallback(value=>setFlight(value),[])
  const savedScroll=useRef(0)
  function enterViewing(){savedScroll.current=window.scrollY;onOpenMemory?.(null);onViewingChange(true)}
  const exitViewing=useCallback(()=>{setCruise(false);onViewingChange(false);requestAnimationFrame(()=>window.scrollTo({top:savedScroll.current,behavior:'instant'}))},[onViewingChange])
  function updateCinema(patch){const next={...cinema,...patch};setCinema(next);setSettingsSaved(saveCinemaSettings(window.localStorage,next))}
  useEffect(()=>{const key=e=>{if(e.repeat||paused||document.querySelector('dialog[open]'))return;if(e.key==='Escape'&&stageId!==null){e.preventDefault();returnOverview()}};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key)},[stageId,paused])
  const motion=useRef({dragging:false,lastEnd:-Infinity,speed:1,time:0,delta:0}),gesture=useRef(null),container=useRef(null),tooltip=useRef(null)
  const [compact,setCompact]=useState(window.innerWidth<1100)
  const pageSize=compact?250:MEMORY_PAGE_SIZE
  useEffect(()=>{const resize=()=>setCompact(window.innerWidth<1100);window.addEventListener('resize',resize);return()=>window.removeEventListener('resize',resize)},[])
  const [page,setPage]=useState(0),[hovered,setHovered]=useState(null),[year,setYear]=useState(''),[month,setMonth]=useState(''),[resetToken,setResetToken]=useState(0)
  const [settings,setSettings]=useState(()=>readVisualSettings(window.localStorage)),[settingsSaved,setSettingsSaved]=useState(true)
  const [reduced,setReduced]=useState(()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches),[inView,setInView]=useState(true),[documentVisible,setDocumentVisible]=useState(!document.hidden),[windowFocused,setWindowFocused]=useState(document.hasFocus()),[failed,setFailed]=useState(false)
  useEffect(()=>{const media=window.matchMedia('(prefers-reduced-motion: reduce)'),change=()=>setReduced(media.matches);media.addEventListener('change',change);return()=>media.removeEventListener('change',change)},[])
  useEffect(()=>{const change=()=>setDocumentVisible(!document.hidden);document.addEventListener('visibilitychange',change);const element=container.current,lost=event=>{event.preventDefault();setFailed(true)};element.addEventListener('webglcontextlost',lost,true);const observer=new IntersectionObserver(([entry])=>setInView(entry.isIntersecting),{threshold:0});observer.observe(container.current);return()=>{document.removeEventListener('visibilitychange',change);observer.disconnect();element.removeEventListener('webglcontextlost',lost,true)}},[])
  useEffect(()=>{const focus=()=>setWindowFocused(true),blur=()=>setWindowFocused(false);window.addEventListener('focus',focus);window.addEventListener('blur',blur);return()=>{window.removeEventListener('focus',focus);window.removeEventListener('blur',blur)}},[])
  const memories=useMemo(()=>memoryEntries(entries),[entries]),calendar=useMemo(()=>memoryCalendar(memories.entries),[memories])
  const currentYear=calendar.some(item=>item.year===year)?year:'',months=calendar.find(item=>item.year===currentYear)?.months??[]
  const currentMonth=months.includes(month)?month:''
  const filtered=useMemo(()=>filterMemoryPeriod(memories.entries,currentYear,currentMonth),[memories,currentYear,currentMonth])
  const pageCount=Math.max(1,Math.ceil(filtered.length/pageSize)),currentPage=Math.min(page,pageCount-1)
  const visible=useMemo(()=>filtered.slice(currentPage*pageSize,(currentPage+1)*pageSize),[filtered,currentPage,pageSize])
  useEffect(()=>{if(matchingIds){const index=filtered.findIndex(entry=>matchingIds.has(entry.id));if(index>=0)setPage(Math.floor(index/pageSize))}},[matchingIds,filtered,pageSize])
  const hoverEntry=visible.find(entry=>entry.id===hovered),focusId=visible.some(entry=>entry.id===selectedId)?selectedId:null
  const active=inView&&documentVisible&&windowFocused&&!paused,animate=active&&!reduced&&settings.motion!=='off',instant=reduced||settings.motion!=='full'||!cinema.autoCamera,quality=qualityProfile(settings.quality)
  const cruiseAllowed=canCruise({active:inView&&documentVisible&&windowFocused,reduced,motion:settings.motion,autoCamera:cinema.autoCamera})
  useEffect(()=>{if(!cruiseAllowed||stageId!==null||selectedId)setCruise(false)},[cruiseAllowed,stageId,selectedId])
  useEffect(()=>{onGraphicsFailure?.(failed);if(viewing&&failed)exitViewing()},[viewing,failed,exitViewing])
  useEffect(()=>{setHovered(null)},[currentPage,entries,currentYear,currentMonth])
  useEffect(()=>{if(selectedId&&!visible.some(entry=>entry.id===selectedId))onOpenMemory?.(null)},[visible,selectedId,onOpenMemory])
  const hover=useCallback((id,event)=>{setHovered(previous=>previous===id?previous:id);if(id&&event&&tooltip.current){const bounds=container.current.getBoundingClientRect();tooltip.current.style.left=Math.max(8,Math.min(event.clientX-bounds.left+12,bounds.width-200))+'px';tooltip.current.style.top=Math.max(8,Math.min(event.clientY-bounds.top+14,bounds.height-86))+'px'}},[])
  function begin(event){if(event.target.tagName!=='CANVAS')return;gesture.current={x:event.clientX,y:event.clientY,id:null,moved:event.button!==0};setHovered(null)}
  function move(event){if(event.buttons&&gesture.current&&Math.hypot(event.clientX-gesture.current.x,event.clientY-gesture.current.y)>5)gesture.current.moved=true}
  function changePeriod(nextYear,nextMonth){setYear(nextYear);setMonth(nextMonth);setPage(0);setHovered(null);onOpenMemory?.(null)}
  function changePage(next){setPage(next);setHovered(null);onOpenMemory?.(null)}
  function updateSettings(patch){const next={...settings,...patch};setSettings(next);setSettingsSaved(saveVisualSettings(window.localStorage,next))}
  const fallback=<div className="planet-fallback"><div/><span>3D 暂不可用，仍可从列表选择记忆或正常编辑日记</span></div>
  return <div className={'memory-scene'+(viewing?' is-viewing':'')+(stageId===null?' is-overview':'')+(toolsOpen?' tools-open':'')} data-phase={phase} data-motion={settings.motion} ref={container} onPointerDown={e=>{if(!e.target.closest('.cinema-toolbar'))setCruise(false)}} onWheel={()=>setCruise(false)} onPointerDownCapture={begin} onPointerMoveCapture={move} onPointerLeave={()=>setHovered(null)} onPointerCancelCapture={()=>{if(gesture.current)gesture.current.moved=true;setHovered(null)}}>
    <div className="audio-control" hidden={!toolsOpen}><AmbientAudio active={inView&&documentVisible&&windowFocused&&!paused}/></div>
    {toolsOpen&&<section className="scene-settings" aria-label="银河显示设置"><div className="settings-heading"><h2>银河显示设置</h2><button onClick={()=>setToolsOpen(false)}>返回宇宙 · Esc</button></div>
    <div className="cinema-toolbar" role="group" aria-label="宇宙漫游"><button type="button" onClick={()=>{onStageSelect(null);onOpenMemory?.(null);setResetToken(v=>v+1);stopCruise()}}>星系总览</button>{true?<button type="button" disabled={failed} onClick={enterViewing}>纯净观赏</button>:<><button type="button" onClick={exitViewing}>退出观赏 · Esc</button></>}
      <button type="button" disabled={!cruiseAllowed||failed} aria-pressed={cruise} onClick={()=>{if(!cruise){onStageSelect(null);onOpenMemory?.(null);setResetToken(v=>v+1)}setCruise(v=>!v)}}>{cruise?'停止巡航':'开始巡航'}</button>{flight&&<><button type="button" onClick={returnOverview}>取消穿梭</button><button type="button" onClick={()=>setFinishToken(v=>v+1)}>立即抵达</button></>}</div>
    {true&&<div className="universe-controls" role="group" aria-label="记忆星图与显示设置" data-overview={stageId===null}>
      <div className="universe-filter-row"><label>年份<select aria-label="星图年份" value={currentYear} onChange={e=>changePeriod(e.target.value,'')}><option value="">全部记忆</option>{calendar.map(item=><option key={item.year} value={item.year}>{item.year} 年</option>)}</select></label><label>月份<select aria-label="星图月份" disabled={!currentYear} value={currentMonth} onChange={e=>changePeriod(currentYear,e.target.value)}><option value="">全年</option>{months.map(value=><option key={value} value={value}>{value} 月</option>)}</select></label><button type="button" className="universe-reset" onClick={()=>{onOpenMemory?.(null);setResetToken(value=>value+1)}}>重置视角</button></div>
      <div className="universe-secondary-row"><details className="universe-options" open><summary>显示设置</summary><div><label>目的地<select aria-label="选择穿梭目的地" value={lockedId??''} onChange={e=>{if(stageId!==null)onStageSelect(null);setLockedId(e.target.value||null)}}><option value="">选择一颗星球</option>{stages.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>{lockedId&&<button onClick={()=>travel()}>开始穿梭</button>}<label className="camera-option"><input type="checkbox" aria-label="快速穿梭" checked={fast} onChange={e=>setFast(e.target.checked)}/>快速穿梭</label><label>画质<select aria-label="宇宙画质" value={settings.quality} onChange={e=>updateSettings({quality:e.target.value})}><option value="standard">标准</option><option value="high">高画质</option><option value="low">低画质</option></select></label><label>动态<select aria-label="宇宙动态" value={settings.motion} onChange={e=>updateSettings({motion:e.target.value})}><option value="full">完整</option><option value="reduced">降低</option><option value="off">关闭自动动态</option></select></label><label className="camera-option"><input type="checkbox" aria-label="自动镜头运动" checked={cinema.autoCamera} onChange={e=>updateCinema({autoCamera:e.target.checked})}/>自动镜头运动</label>{reduced&&<span>已遵循系统减弱动态设置</span>}{!settingsSaved&&<span role="status">设置本次有效，未能持久保存</span>}</div></details><label className="memory-picker"><span className="sr-only">按标题选择记忆星辰</span><select aria-label="选择记忆星辰" value={focusId??''} onChange={e=>onOpenMemory?.(e.target.value||null)}><option value="">按标题定位星辰</option>{visible.filter(entry=>!matchingIds||matchingIds.has(entry.id)).map(entry=><option key={entry.id} value={entry.id}>{entry.date} · {entry.title}</option>)}</select></label>{selectedId&&<button className="universe-return" onClick={()=>onOpenMemory?.(null)}>返回宇宙</button>}</div>
    </div>}
    </section>}
    {failed?fallback:<Boundary onError={()=>setFailed(true)}><Canvas frameloop="demand" dpr={quality.dpr} camera={{position:[0,40,50],fov:42,far:500}} raycaster={{params:{Points:{threshold:.065}}}} style={{cursor:hovered?'pointer':'grab'}} gl={{antialias:false,alpha:true,powerPreference:'high-performance'}} fallback={fallback}>
      <StarseaEffects quality={settings.quality} motion={motion}/><VolumeNebula quality={settings.quality} motion={motion} count={stages.length}/><CosmicSky low={settings.quality==='low'}/><UniverseClock motion={motion} animate={animate}/><Galaxy quality={settings.quality} motion={motion} count={stages.length} focused={stageId!==null}/><AnimationDriver animate={animate} fps={quality.fps}/>{quality.nebula&&<><Nebula motion={motion}/><DistantGalaxy/></>}{quality.dust>0&&<Stardust count={quality.dust} animate={animate} motion={motion}/>}<FlightDust quality={settings.quality} motion={motion} enabled={animate&&!instant}/><Stars low={settings.quality==='low'} animate={animate}/>{stages.map((stage,i)=><Planet key={stage.id} index={i} stage={stage} quality={quality} selected={stageId===stage.id||lockedId===stage.id} locked={lockedId===stage.id} dimmed={false} onSelect={id=>{if(!flight&&stageId!==id)travel(id)}} onTravel={id=>{if(!flight&&stageId!==id)travel(id)}} gesture={gesture} motion={motion} animate={animate} low={settings.quality==='low'} slow={settings.motion==='reduced'}/>)}<JourneyControls stages={stages} lockedId={lockedId} fast={fast} onJourneyChange={journeyChange} reading={paused||!!focusId} cruise={cruise&&cruiseAllowed} onStopCruise={stopCruise} finishToken={finishToken} onFlightChange={flightChange} stageId={stageId} motion={motion} focusId={focusId} resetToken={resetToken} instant={instant} active={active}/>
      {(phase==='ORBIT_DOCKED'||phase==='READING')&&visible.length>0&&<OrbitAnchor index={stages.findIndex(s=>s.id===stageId)} motion={motion}><MemoryStars animate={animate&&!instant} coreRadius={1.66*(stages.findIndex(s=>s.id===stageId)>=0?orbitSpec(stages.findIndex(s=>s.id===stageId)).scale:1)} entries={visible} gesture={gesture} motion={motion} onHover={hover} onSelect={onOpenMemory} matchingIds={matchingIds}/></OrbitAnchor>}
    </Canvas></Boundary>}
    {toolsOpen&&<div className="memory-pages"><span>{filtered.length} 颗记忆星辰</span>{pageCount>1&&<div><button aria-label="上一页星点" disabled={!currentPage} onClick={()=>changePage(currentPage-1)}>‹</button><span>{currentPage+1} / {pageCount}</span><button aria-label="下一页星点" disabled={currentPage===pageCount-1} onClick={()=>changePage(currentPage+1)}>›</button></div>}</div>}
  </div>
})
