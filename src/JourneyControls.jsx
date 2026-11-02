import {useEffect,useRef} from 'react'
import {useFrame,useThree} from '@react-three/fiber'
import {Vector3,CubicBezierCurve3,MathUtils} from 'three'
import {OrbitControls} from 'three/addons/controls/OrbitControls.js'
import {orbitSpec,orbitPosition,galaxyDistance,avoidPlanets} from './living-universe.js'
import {memoryPosition} from './memory-stars.js'
import {createFlight,sampleFlight,phaseAt,flightProgress,flightSpeed,smooth,orbitOffset,departureEye} from './journey.js'

export default function JourneyControls({motion,stages,focusId,reading,stageId,lockedId,resetToken,instant,active,cruise,onStopCruise,finishToken,onFlightChange,onJourneyChange,fast=false}){
 const {camera,gl,invalidate,size,scene}=useThree(),controls=useRef(),transition=useRef(null),initial=useRef(true),previous=useRef(null),phase=useRef('OVERVIEW'),drift=useRef(0),cruiseAngle=useRef(0),overview=useRef(null),lastStage=useRef(null)
 const latest=useRef();latest.current={onStopCruise,onFlightChange,onJourneyChange}
 const distance=galaxyDistance(stages.length,size.width/size.height),index=stages.findIndex(s=>s.id===stageId),lockIndex=stages.findIndex(s=>s.id===lockedId)
 const center=()=>new Vector3(...(index>=0?orbitPosition(index,motion.current.time):[0,0,0]))
 const requestFrame=()=>{if(!motion.current.autoTick)invalidate()}
 function publish(next){if(phase.current!==next){phase.current=next;if(scene.userData.journey)scene.userData.journey.phase=next;latest.current.onJourneyChange?.(next);latest.current.onFlightChange(next==='RETURNING'||next.startsWith('FLIGHT_')||next==='ORBIT_ARRIVAL')}}
 function finish(){const c=controls.current;transition.current=null;motion.current.flightSpeed=0;camera.fov=42;camera.updateProjectionMatrix();if(c){c.enabled=active;c.enableDamping=true}publish(index>=0?(reading?'READING':'ORBIT_DOCKED'):lockIndex>=0?'TARGET_LOCKED':'OVERVIEW')}
 useEffect(()=>{
  const c=new OrbitControls(camera,gl.domElement);controls.current=c;c.enableDamping=true;c.dampingFactor=.08;c.enablePan=true;c.panSpeed=.35;c.rotateSpeed=.3;c.zoomSpeed=.48;c.minPolarAngle=.08;c.maxPolarAngle=Math.PI-.08
  const start=()=>{drift.current=0;latest.current.onStopCruise();motion.current.dragging=true;invalidate()},end=()=>{motion.current.dragging=false;invalidate()};c.addEventListener('start',start);c.addEventListener('end',end);c.addEventListener('change',requestFrame)
  return()=>{c.removeEventListener('start',start);c.removeEventListener('end',end);c.removeEventListener('change',requestFrame);c.dispose();transition.current=null;motion.current.flightSpeed=0}
 },[camera,gl,invalidate,motion])
 useEffect(()=>{if(controls.current)controls.current.enabled=active&&!transition.current},[active])
 useEffect(()=>{
  const c=controls.current;if(!c)return
  if(index>=0&&lastStage.current===null&&!initial.current)overview.current={eye:camera.position.clone(),aim:c.target.clone()}
  lastStage.current=stageId
  const target=center(),radius=index>=0?1.58*orbitSpec(index).scale:1,offset=index>=0?orbitOffset(target.toArray(),radius,index):new Vector3(0,distance*.835,distance*.55)
  c.minDistance=index>=0?radius*2.55:6.5;c.maxDistance=Math.max(260,distance*1.5);camera.far=Math.max(700,distance*2+200);camera.updateProjectionMatrix()
  const aim=target.clone();if(index>=0)aim.x+=radius*.52
  const eye=target.clone().add(offset)
  if(index<0&&overview.current){eye.copy(overview.current.eye);aim.copy(overview.current.aim)}
  if(initial.current||instant){initial.current=false;camera.position.copy(eye);c.target.copy(aim);c.update();finish()}
  else{
   c.enabled=false;c.enableDamping=false
   // Flush any pending OrbitControls damping before taking ownership of the camera.
   c.update();const from=camera.position.clone()
   const departure=departureEye(from.toArray(),c.target.toArray())
   transition.current=index>=0?{kind:'flight',fromEye:from,departure,path:createFlight(departure.toArray(),target.toArray(),radius,index),elapsed:0,duration:fast?2.4:7,fromTarget:c.target.clone(),radius}:{kind:'return',curve:new CubicBezierCurve3(from,from.clone().lerp(eye,.28).add(new Vector3(0,3,0)),eye.clone().lerp(from,.15),eye),elapsed:0,duration:2.8,fromTarget:c.target.clone(),aim,radius}
   publish(index>=0?'FLIGHT_PREPARING':'RETURNING')
  }
  previous.current=target;invalidate()
 },[stageId,resetToken,instant])
 // R3F updates the projection on resize. Keep an ongoing flight and its elapsed
 // time intact instead of starting a new curve when the aspect ratio changes.
 useEffect(()=>{camera.far=Math.max(700,distance*2+200);camera.updateProjectionMatrix();invalidate()},[distance,camera,invalidate])
 useEffect(()=>{if(!transition.current&&index>=0)publish(reading?'READING':'ORBIT_DOCKED')},[reading])
 useEffect(()=>{if(stageId===null&&!transition.current)publish(lockIndex>=0?'TARGET_LOCKED':'OVERVIEW');invalidate()},[lockedId])
 useEffect(()=>{const t=transition.current,c=controls.current;if(!finishToken||!t||!c)return;if(t.kind==='flight'){const target=center();camera.position.copy(target).add(t.path.offset);c.target.copy(target);c.target.x+=t.radius*.52}else{camera.position.copy(t.curve.v3);c.target.copy(t.aim)}finish();c.update();invalidate()},[finishToken])
 useFrame((_,dt)=>{
  const c=controls.current;if(!c)return
  const delta=active?Math.min(Math.max(dt,0),.05):0,target=center(),t=transition.current
  if(!active){scene.userData.journey={...scene.userData.journey,active:false};return}
  let speed=0,elapsed=0,progress=0
  if(t){
   t.elapsed=Math.min(t.duration,t.elapsed+delta);elapsed=t.elapsed;progress=t.kind==='flight'?flightProgress(elapsed,t.duration):smooth(elapsed/t.duration)
   if(t.kind==='flight'){
    if(elapsed<t.duration*.8/7)camera.position.lerpVectors(t.fromEye,t.departure,smooth(elapsed/(t.duration*.8/7)))
    else sampleFlight(t.path,target.toArray(),progress,camera.position)
    const aim=target.clone();aim.x+=t.radius*.52*progress
    c.target.lerpVectors(t.fromTarget,aim,smooth(Math.min(1,elapsed/t.duration*3.3)))
    speed=flightSpeed(elapsed,t.duration);publish(phaseAt(elapsed,t.duration))
   }else{t.curve.getPoint(progress,camera.position);c.target.lerpVectors(t.fromTarget,t.aim,progress)}
   if(elapsed>=t.duration)finish();requestFrame()
  }else if(index>=0&&previous.current){const shift=target.clone().sub(previous.current);camera.position.add(shift);c.target.add(shift)}
  else if(cruise){cruiseAngle.current+=delta*.018;const a=delta*.018;camera.position.applyAxisAngle(new Vector3(0,1,0),a);c.target.set(0,0,0);requestFrame()}
  else if(lockIndex>=0){const aim=new Vector3(...orbitPosition(lockIndex,motion.current.time)).multiplyScalar(.18);c.target.lerp(aim,1-Math.exp(-delta*1.7));requestFrame()}
  else if(drift.current>0&&!instant){const time=motion.current.time??0;camera.position.x+=Math.cos(time*.075)*delta*.009*drift.current;camera.position.y+=Math.cos(time*.06)*delta*.005*drift.current}
  previous.current=target;c.update(delta)
  const positions=stages.map((_,i)=>orbitPosition(i,motion.current.time)),safe=avoidPlanets(camera.position.toArray(),positions,stages.map((_,i)=>orbitSpec(i).scale));camera.position.fromArray(safe);camera.lookAt(c.target)
  const lens=instant?42:MathUtils.damp(camera.fov,42+speed*9,5,delta)
  if(Math.abs(camera.fov-lens)>.0001){camera.fov=lens;camera.updateProjectionMatrix();requestFrame()}
  motion.current.flightProgress=progress;motion.current.flightSpeed=speed;motion.current.flightPhase=phase.current
  scene.userData.journey={phase:phase.current,elapsed,progress,speed,active:true,target:stageId,center:target.toArray(),aim:c.target.toArray(),overview:overview.current?{eye:overview.current.eye.toArray(),aim:overview.current.aim.toArray()}:null,distance:camera.position.distanceTo(target),path:t?.path?{from:t.path.curve.v0.toArray(),control1:t.path.curve.v1.toArray(),control2:t.path.curve.v2.toArray(),end:t.path.curve.v3.toArray()}:null}
 },-1)
 return null
}
