import {useEffect,useMemo,useRef} from 'react'
import {useFrame,useThree} from '@react-three/fiber'
import {AdditiveBlending,NormalBlending,DoubleSide,BufferGeometry,Float32BufferAttribute} from 'three'
import {galaxyBudget,galaxyRadius,galaxyParticles} from './galaxy-model.js'

const vertex=`attribute float particleSize;varying vec3 tint;varying float defocus;uniform float time;uniform float pixelRatio;uniform float focusDepth;uniform float blur;uniform float maxPointSize;
 void main(){vec3 p=position;float angle=time*.0018,c=cos(angle),s=sin(angle);p.xz=mat2(c,s,-s,c)*p.xz;vec4 mv=modelViewMatrix*vec4(p,1.);tint=color;defocus=min(1.5,abs(-mv.z-focusDepth)/35.)*blur;gl_Position=projectionMatrix*mv;gl_PointSize=clamp(particleSize*pixelRatio*70./max(1.,-mv.z)*(1.+defocus),.7,maxPointSize);}`
const fragment=`varying vec3 tint;varying float defocus;uniform float opacity;uniform float softness;
 void main(){float r=length(gl_PointCoord-.5)*2.;if(r>1.)discard;float glow=exp(-r*r*mix(8.,3.5,softness));float core=exp(-r*r*40.)*(1.-softness);float a=(glow*.6+core*.35)*opacity/(1.+defocus*.8);gl_FragColor=vec4(tint,a);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
 }`
function Population({count,radius,kind,motion,focused,blur}){
 const material=useRef(),{camera,viewport}=useThree()
 const data=useMemo(()=>galaxyParticles(count,radius,kind,kind==='haze'?7511:kind==='dust'?9533:5117),[count,radius,kind])
 const geometry=useMemo(()=>{const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(data.positions,3));g.setAttribute('color',new Float32BufferAttribute(data.colors,3));g.setAttribute('particleSize',new Float32BufferAttribute(data.sizes,1));g.computeBoundingSphere();return g},[data])
 useEffect(()=>()=>geometry.dispose(),[geometry])
 const uniforms=useMemo(()=>({time:{value:0},pixelRatio:{value:viewport.dpr},focusDepth:{value:45},blur:{value:blur},maxPointSize:{value:kind==='stars'?6:100},opacity:{value:kind==='haze'?.014:kind==='dust'?.13:.94},softness:{value:kind==='stars'?.1:1}}),[viewport.dpr,blur,kind])
 useFrame(()=>{if(material.current){material.current.uniforms.time.value=motion.current.time;material.current.uniforms.focusDepth.value=focused?8.8:camera.position.length();material.current.uniforms.opacity.value=(kind==='haze'?.014:kind==='dust'?.13:.94)*(focused?(kind==='stars'?.55:.75):1)}})
 return <points name={'galaxy-'+kind} userData={{count,arms:4}} raycast={()=>null} renderOrder={kind==='dust'?3:kind==='haze'?1:2}><primitive object={geometry} attach="geometry"/><shaderMaterial ref={material} uniforms={uniforms} vertexShader={vertex} fragmentShader={fragment} vertexColors transparent depthWrite={false} blending={kind==='dust'?NormalBlending:AdditiveBlending}/></points>
}
function Core({motion}){
 const halo=useRef(),material=useRef(),{camera}=useThree()
 const uniforms=useMemo(()=>({pulse:{value:1}}),[])
 useFrame(()=>{halo.current?.lookAt(camera.position);if(material.current)material.current.uniforms.pulse.value=1+Math.sin(motion.current.time*.18)*.018})
 return <group name="galaxy-core"><mesh raycast={()=>null}><sphereGeometry args={[.36,32,24]}/><meshBasicMaterial color={[2.4,1.65,.85]}/></mesh><mesh ref={halo} raycast={()=>null} renderOrder={4}><planeGeometry args={[14,14]}/><shaderMaterial ref={material} uniforms={uniforms} transparent depthWrite={false} side={DoubleSide} blending={AdditiveBlending} vertexShader={`varying vec2 p;void main(){p=uv-.5;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`} fragmentShader={`varying vec2 p;uniform float pulse;void main(){float r=dot(p,p);float core=exp(-r*900.)*.7,halo=exp(-r*75.)*.24+exp(-r*15.)*.065;halo+=exp(-abs(p.y)*400.)*exp(-abs(p.x)*7.)*.13;gl_FragColor=vec4(mix(vec3(.62,.36,.18),vec3(1.,.88,.64),core),min(.72,core+halo)*pulse);}`}/></mesh></group>
}
export default function Galaxy({quality,motion,count,focused}){
 const budget=galaxyBudget(quality),radius=galaxyRadius(count)
 return <group name="life-galaxy" rotation={[-.38,0,0]}><Population count={budget.stars} radius={radius} kind="stars" motion={motion} focused={focused} blur={0}/>{budget.dust>0&&<Population count={budget.dust} radius={radius} kind="dust" motion={motion} focused={focused} blur={0}/>}<Core motion={motion}/></group>
}
