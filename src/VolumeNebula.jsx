import {useMemo,useRef} from 'react'
import {useFrame} from '@react-three/fiber'
import {BackSide,Color,Vector3} from 'three'
import {noiseGLSL} from './planet-material.js'
import {spiralAngle} from './galaxy-model.js'

const vertex=`varying vec3 localPoint;void main(){localPoint=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`
function Cloud({index,steps,motion}) {
 const mesh=useRef(),eye=useMemo(()=>new Vector3(),[])
 const radius=9+index*3.2,angle=spiralAngle(radius,index%4)
 const uniforms=useMemo(()=>({localEye:{value:new Vector3()},time:{value:0},seed:{value:index*3.17},tint:{value:new Color(index%2?'#bb80b6':'#6794c8')}}),[index])
 const fragment=useMemo(()=>`
 ${noiseGLSL.replace('i<5','i<3')}
 varying vec3 localPoint;uniform vec3 localEye;uniform float time;uniform float seed;uniform vec3 tint;
 void main(){
  vec3 ray=normalize(localPoint-localEye),inv=1./(ray+vec3(.00001));
  vec3 a=(-vec3(.5)-localEye)*inv,b=(vec3(.5)-localEye)*inv;
  vec3 lo=min(a,b),hi=max(a,b);float entry=max(0.,max(lo.x,max(lo.y,lo.z))),exit=min(hi.x,min(hi.y,hi.z));
  if(exit<=entry)discard;
  float stepSize=(exit-entry)/float(${steps});vec4 sum=vec4(0.);
  for(int i=0;i<${steps};i++){
   vec3 p=localEye+ray*(entry+(float(i)+.5)*stepSize);
   float envelope=pow(max(0.,1.-length(p*2.)),1.4);
   vec3 q=p*5.+vec3(seed,time*.006,seed*.3);
   float n=fbm(q+noise(q*.7)*1.6);
   float density=smoothstep(.25,.68,n)*envelope;
   float opacity=1.-exp(-density*stepSize*1.9);
   float light=noise(q+vec3(-.6,.8,.2));
   vec3 emission=mix(tint*.35,vec3(.6,.57,.7),smoothstep(.42,.7,light));
   sum.rgb+=(1.-sum.a)*opacity*emission;sum.a+=(1.-sum.a)*opacity;
  }
  if(sum.a<.001)discard;
  gl_FragColor=vec4(sum.rgb/max(.001,sum.a),sum.a*.7);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
 }`,[steps])
 useFrame(({camera})=>{
  if(mesh.current){mesh.current.worldToLocal(eye.copy(camera.position));uniforms.localEye.value.copy(eye);uniforms.time.value=motion.current.time}
 })
 return <mesh ref={mesh} name={'volume-cloud-'+index} position={[Math.cos(angle)*radius,-1.1,Math.sin(angle)*radius]} rotation={[0,-angle,0]} scale={[15,5+index*.3,9]} raycast={()=>null} renderOrder={0}>
  <boxGeometry/><shaderMaterial side={BackSide} transparent depthWrite={false} uniforms={uniforms} vertexShader={vertex} fragmentShader={fragment}/>
 </mesh>
}
export default function VolumeNebula({quality,motion}) {
 if(quality==='low')return null
 return <group name="volumetric-nebula" rotation={[-.38,0,0]}>{Array.from({length:quality==='high'?5:3},(_,i)=><Cloud key={i} index={i} steps={quality==='high'?32:20} motion={motion}/>)}</group>
}
