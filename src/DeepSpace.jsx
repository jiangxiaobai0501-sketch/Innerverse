import {useMemo,useRef} from 'react'
import {useFrame} from '@react-three/fiber'
import {galaxyParticles} from './galaxy-model.js'
import {AdditiveBlending,DoubleSide} from 'three'

// Three translucent procedural veils, no texture fetches or postprocessing passes.
export function Nebula({motion}){
 const ref=useRef();useFrame(()=>{ref.current?.traverse(o=>{if(o.material?.uniforms?.shade)o.material.uniforms.shade.value=o.userData.seed+Math.sin(motion.current.time*.012)*.12})})
 const clouds=[[-16,-45,-45,65,38,.2],[18,-53,-38,60,40,-.3],[5,-65,-50,70,40,.4]]
 return <group name="deep-nebula" ref={ref}>{clouds.map(([x,y,z,w,h,a],i)=><mesh key={i} userData={{seed:i}} position={[x,y,z]} rotation={[-.99,0,a]} raycast={()=>null}><planeGeometry args={[w,h]}/><shaderMaterial transparent depthWrite={false} side={DoubleSide} blending={AdditiveBlending} uniforms={{shade:{value:i}}} vertexShader={`varying vec2 uvp;void main(){uvp=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`} fragmentShader={`varying vec2 uvp;uniform float shade;
 float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
 float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1)),f.x),f.y);}
 void main(){vec2 p=uvp-.5;float fall=pow(max(0.,1.-length(p*2.)),2.);float v=n(uvp*5.+shade)*.65+n(uvp*13.)*.35;vec3 c=mix(vec3(.13,.17,.34),vec3(.25,.15,.32),shade*.4);gl_FragColor=vec4(c,fall*v*.38);}`}/></mesh>)}</group>
}
export function Stardust({count,animate,motion}) {
 const group=useRef()
 const positions=useMemo(()=>{let seed=1223;const rand=()=>{seed=seed*16807%2147483647;return seed/2147483647};return new Float32Array(Array.from({length:count*3},(_,i)=>i%3===0?(rand()-.5)*34:i%3===1?(rand()-.5)*18:-3-rand()*12))},[count])
 useFrame((_,dt)=>{if(animate&&group.current)group.current.rotation.y+=(motion.current.delta??0)*.0015})
 return <points name="near-stardust" ref={group} raycast={()=>null}><bufferGeometry><bufferAttribute attach="attributes-position" args={[positions,3]}/></bufferGeometry><pointsMaterial color="#a6b8d4" transparent opacity={.18} size={.024} depthWrite={false}/></points>
}

export function DistantGalaxy(){const positions=useMemo(()=>{return galaxyParticles(600,7,'stars',8392).positions},[]);return <points name="distant-galaxy" position={[-24,-45,-50]} rotation={[-.8,0,-.4]} raycast={()=>null}><bufferGeometry><bufferAttribute attach="attributes-position" args={[positions,3]}/></bufferGeometry><pointsMaterial color="#a69cbc" size={.09} transparent opacity={.22} depthWrite={false}/></points>}
