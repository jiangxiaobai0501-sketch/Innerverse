import {useMemo,useRef} from 'react'
import {useFrame} from '@react-three/fiber'
import {BackSide,Vector3} from 'three'
import {noiseGLSL} from './planet-material.js'
import {galaxyRadius} from './galaxy-model.js'

// A finite 3D density field integrates internal light and self extinction.
export default function BoundlessNebula({quality,motion,count=6}) {
 const mesh=useRef(),eye=useMemo(()=>new Vector3(),[]),steps=quality==='low'?10:quality==='high'?32:22
 const radius=galaxyRadius(count)
 const uniforms=useMemo(()=>({localEye:{value:new Vector3()},time:{value:0},radius:{value:radius}}),[radius])
 const fragment=useMemo(()=>`
 ${noiseGLSL.replace('i<5',quality==='low'?'i<2':'i<3')}
 varying vec3 localPoint;uniform vec3 localEye;uniform float time;uniform float radius;
 void main(){
  vec3 ray=normalize(localPoint-localEye),inv=1./(ray+vec3(.00001));
  vec3 a=(-vec3(.5)-localEye)*inv,b=(vec3(.5)-localEye)*inv;
  vec3 lo=min(a,b),hi=max(a,b);float entry=max(0.,max(lo.x,max(lo.y,lo.z))),exit=min(hi.x,min(hi.y,hi.z));
  if(exit<=entry)discard;
  float stepSize=(exit-entry)/float(${steps});vec3 emission=vec3(0.);float transmission=1.;
  for(int i=0;i<${steps};i++){
   vec3 p=localEye+ray*(entry+(float(i)+.5)*stepSize);
   vec2 disk=p.xz*radius*2.;float r=length(disk),edge=(1.-smoothstep(radius*.52,radius,r))*exp(-r/radius*.8);
   float angle=atan(disk.y,disk.x)-time*.0018;
   vec3 q=vec3(disk*.6,p.y*8.)+vec3(4.,time*.004,7.);
   float n=fbm(q);
   float wisps=noise(q*4.+n*2.);
   float winding=angle-log(1.+r/2.4)*2.1;
   float arm=pow(.5+.5*cos(4.*winding+(n-.5)*2.7),7.);
   float vertical=exp(-pow(p.y*6.5,2.));
   float filament=smoothstep(.36,.68,n)*(.035+arm*.965)*(.2+wisps*.8);
   float core=exp(-r*r*.045)*exp(-p.y*p.y*18.);
   float density=(filament*vertical*.75+core*.42)*edge;
   float dustLane=pow(.5+.5*cos(4.*winding-.48),14.)*vertical*(1.-exp(-r*r*.09));
   float opacity=1.-exp(-(density*2.7+dustLane*.35)*stepSize*8.);
   vec3 cool=mix(vec3(.09,.19,.34),vec3(.29,.20,.36),smoothstep(-.7,.8,sin(angle*1.4+r*.1)));
   vec3 light=mix(cool,vec3(1.08,.76,.44),min(.94,core*1.5));
   light*=.55+wisps*.8;light*=1.-dustLane*.90;
   emission+=transmission*opacity*light;transmission*=1.-opacity;
  }
  float alpha=1.-transmission;if(alpha<.002)discard;
  gl_FragColor=vec4(emission/max(alpha,.001),alpha*.7);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
 }`,[steps,quality])
 useFrame(({camera})=>{if(mesh.current){mesh.current.worldToLocal(eye.copy(camera.position));uniforms.localEye.value.copy(eye);uniforms.time.value=motion.current.time}})
 return <group name="volumetric-nebula" rotation={[-.38,0,0]}><mesh ref={mesh} name="spiral-gas-volume" scale={[radius*2,12,radius*2]} raycast={()=>null} renderOrder={0} userData={{steps}}>
  <boxGeometry/><shaderMaterial side={BackSide} transparent depthWrite={false} uniforms={uniforms} vertexShader={`varying vec3 localPoint;void main(){localPoint=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`} fragmentShader={fragment}/>
 </mesh></group>
}
