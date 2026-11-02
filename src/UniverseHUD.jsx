import {useEffect,useRef,useState} from 'react'
import {stageTheme} from './cinema.js'

export default function UniverseHUD({stages,stageId,phase,flight,onTravel,motion,viewing}) {
 const [idle,setIdle]=useState(false),progress=useRef()
 const stage=stages.find(s=>s.id===stageId)
 useEffect(()=>{
  let timer
  const wake=()=>{setIdle(false);clearTimeout(timer);timer=setTimeout(()=>setIdle(true),6500)}
  window.addEventListener('pointermove',wake);window.addEventListener('keydown',wake);wake()
  return()=>{clearTimeout(timer);window.removeEventListener('pointermove',wake);window.removeEventListener('keydown',wake)}
 },[])
 useEffect(()=>{
  if(!flight)return
  const update=()=>{if(progress.current)progress.current.style.transform=`scaleX(${motion.current.flightProgress??0})`}
  update();const timer=setInterval(update,100);return()=>clearInterval(timer)
 },[flight,motion])
 if(viewing)return null
 return <div className={'universe-hud'+(idle?' hud-idle':'')}>
  <header className="hud-brand"><div className="hud-emblem" aria-hidden="true">✧</div><div><span className="hud-eyebrow">XINYU / STARSEA ERA</span><h1>心屿<span>星海纪元</span></h1></div></header>
  <div className="hud-system"><i/><span>{flight?'航行中':stage?'近轨道观察':'宇宙总览'}</span><small>{String(stages.length).padStart(2,'0')} 个时光坐标</small></div>
  {stageId===null&&!flight&&<>
   <div className="hud-poem"><span>星海深处，皆是此生。</span><small>拖动探索宇宙 · 点击星球开始穿梭</small></div>
   <nav className="hud-destinations" aria-label="星际目的地"><div className="hud-nav-label">选择一段时光 <span>DESTINATIONS</span></div><div>{stages.map((s,i)=><button key={s.id} onClick={()=>onTravel(s.id)} aria-label={'前往'+s.name} style={{'--planet-tint':stageTheme(i).color}}><i aria-hidden="true"/><span><small>{String(i+1).padStart(2,'0')}</small>{s.name}</span><b aria-hidden="true">↗</b></button>)}</div></nav>
  </>}
  {flight&&<div className="hud-flight"><small>{phase==='RETURNING'?'RETURN TO ATLAS':'INTERSTELLAR TRANSIT'}</small><strong>{phase==='RETURNING'?'返回宇宙总览':stage?.name??'星际航行'}</strong><div className="hud-flight-track" aria-hidden="true"><i ref={progress}/></div></div>}
  <div className="hud-frame" aria-hidden="true"/>
 </div>
}
