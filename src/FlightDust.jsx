import {useEffect,useMemo,useRef} from 'react'
import {useFrame,useThree} from '@react-three/fiber'
import {BufferGeometry,Float32BufferAttribute,DynamicDrawUsage,Vector3,Quaternion,AdditiveBlending} from 'three'

// A reusable world-space particle bank. Only out-of-view particles are recycled;
// points retain world positions as the camera moves through them.
export default function FlightDust({quality,motion,enabled}){
 const {camera,size}=useThree(),lines=useRef(),points=useRef(),last=useRef(new Vector3()),ready=useRef(false)
 const count=quality==='high'?420:quality==='low'?90:240
 const bank=useMemo(()=>{
  const stars=new Float32Array(count*3),segments=new Float32Array(count*6),colors=new Float32Array(count*6),fade=new Float32Array(count*2)
  for(let i=0;i<count;i++){const c=i%7===0?[1,.85,.62]:i%3===0?[.77,.86,1]:[.35,.62,.9];colors.set(c,i*6);colors.set(c,i*6+3);fade[i*2]=1;fade[i*2+1]=0}
  const pointGeometry=new BufferGeometry();pointGeometry.setAttribute('position',new Float32BufferAttribute(stars,3).setUsage(DynamicDrawUsage))
  const lineGeometry=new BufferGeometry();lineGeometry.setAttribute('position',new Float32BufferAttribute(segments,3).setUsage(DynamicDrawUsage));lineGeometry.setAttribute('color',new Float32BufferAttribute(colors,3));lineGeometry.setAttribute('fade',new Float32BufferAttribute(fade,1))
  return {stars:pointGeometry.attributes.position.array,segments:lineGeometry.attributes.position.array,pointGeometry,lineGeometry,local:new Vector3(),world:new Vector3(),direction:new Vector3(),inverse:new Quaternion(),velocity:new Vector3(),seed:8173,initialized:false}
 },[count])
 const lineUniforms=useMemo(()=>({strength:{value:0}}),[]),pointUniforms=useMemo(()=>({strength:{value:0}}),[])
 useEffect(()=>{ready.current=false;return()=>{bank.pointGeometry.dispose();bank.lineGeometry.dispose()}},[bank])
 useFrame((_,dt)=>{
  if(!lines.current||!points.current)return
  const speed=enabled?motion.current.flightSpeed??0:0,visible=speed>.008
  lines.current.visible=visible;points.current.visible=visible
  if(!visible){last.current.copy(camera.position);ready.current=false;return}
  bank.inverse.copy(camera.quaternion).invert();camera.getWorldDirection(bank.direction)
  if(ready.current){bank.velocity.copy(camera.position).sub(last.current);if(bank.velocity.lengthSq()>.00001)bank.direction.lerp(bank.velocity.normalize(),.28).normalize()}
  const rand=()=>{bank.seed=bank.seed*16807%2147483647;return bank.seed/2147483647},aspect=size.width/size.height,tan=Math.tan(camera.fov*Math.PI/360),length=.08+speed*speed*6.5
  for(let i=0;i<count;i++){
   const j=i*3,k=i*6;bank.world.fromArray(bank.stars,j);bank.local.copy(bank.world).sub(camera.position).applyQuaternion(bank.inverse)
   const depth=-bank.local.z
   if(!bank.initialized||depth<1.5||depth>90||Math.abs(bank.local.x)>depth*tan*aspect*1.35||Math.abs(bank.local.y)>depth*tan*1.35){
    const z=3+rand()*68;bank.local.set((rand()*2-1)*z*tan*aspect*1.2,(rand()*2-1)*z*tan*1.2,-z).applyQuaternion(camera.quaternion).add(camera.position);bank.world.copy(bank.local);bank.world.toArray(bank.stars,j)
   }
   bank.world.toArray(bank.segments,k);bank.world.addScaledVector(bank.direction,length*(.6+(i%11)/15)).toArray(bank.segments,k+3)
  }
  bank.initialized=true;ready.current=true;last.current.copy(camera.position)
  bank.pointGeometry.attributes.position.needsUpdate=true;bank.lineGeometry.attributes.position.needsUpdate=true
  lines.current.material.uniforms.strength.value=speed*.32;points.current.material.uniforms.strength.value=speed*.38
  lines.current.userData.speed=speed;lines.current.userData.length=length;lines.current.userData.count=count
 })
 return <group name="flight-particle-bank">
  <lineSegments ref={lines} name="interstellar-trails" raycast={()=>null} frustumCulled={false}><primitive object={bank.lineGeometry} attach="geometry"/><shaderMaterial uniforms={lineUniforms} transparent depthWrite={false} blending={AdditiveBlending} vertexColors vertexShader={`attribute float fade;varying float a;varying vec3 tint;void main(){a=fade;tint=color;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`} fragmentShader={`uniform float strength;varying float a;varying vec3 tint;void main(){gl_FragColor=vec4(tint,a*strength);}`}/></lineSegments>
  <points ref={points} name="flight-local-stars" raycast={()=>null} frustumCulled={false}><primitive object={bank.pointGeometry} attach="geometry"/><shaderMaterial uniforms={pointUniforms} transparent depthWrite={false} blending={AdditiveBlending} vertexShader={`void main(){vec4 mv=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp(40./max(1.,-mv.z),1.,3.);}`} fragmentShader={`uniform float strength;void main(){float r=length(gl_PointCoord-.5)*2.;if(r>1.)discard;gl_FragColor=vec4(.65,.82,1.,exp(-r*r*3.)*strength);}`}/></points>
 </group>
}
