import {useMemo,useRef} from 'react'
import {useFrame} from '@react-three/fiber'
import {Color} from 'three'
import {planetVertex,planetFragment} from './planet-material.js'

export default function Satellite({index,motion,low}) {
 const moon=useRef()
 const uniforms=useMemo(()=>({tint:{value:new Color('#aaa39c')},accentColor:{value:new Color('#d2c9b8')},variant:{value:3},brightness:{value:.65},detail:{value:.6},time:{value:0}}),[])
 useFrame(()=>{if(moon.current){const a=motion.current.time*.075+index;moon.current.position.set(Math.cos(a)*3.1,Math.sin(a*.7)*.28,Math.sin(a)*3.1);moon.current.rotation.y=motion.current.time*.018}})
 return <mesh name={'stage-moon-'+index} ref={moon} position={[3.1,0,0]} raycast={()=>null}>
  <sphereGeometry args={[.19,low?16:28,low?12:20]}/><shaderMaterial vertexShader={planetVertex} fragmentShader={planetFragment.replace('i<5','i<3')} uniforms={uniforms}/>
 </mesh>
}
