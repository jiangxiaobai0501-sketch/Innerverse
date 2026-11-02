import {useMemo,useRef} from 'react'
import {useFrame} from '@react-three/fiber'
import {BackSide} from 'three'
import {noiseGLSL} from './planet-material.js'

// One distant sky draw. Nearby galaxy layers supply parallax; the sky stays at infinity.
export default function CosmicSky({low}) {
 const sky=useRef()
 useFrame(({camera})=>{if(sky.current)sky.current.position.copy(camera.position)})
 const fragment=useMemo(()=>`${noiseGLSL.replace('i<5',low?'i<2':'i<4')}
 varying vec3 direction;
 void main(){
  vec3 p=normalize(direction);float lane=p.x*.42+p.y*.81-p.z*.4;
  float cloud=fbm(p*4.5+vec3(4.,2.,7.));
  float detail=fbm(p*15.+cloud*2.);
  float band=exp(-pow((lane+(cloud-.5)*.65)/.19,2.));
  float dust=smoothstep(.39,.65,detail)*band;
  vec3 blue=mix(vec3(.009,.022,.05),vec3(.045,.072,.13),cloud);
  vec3 violet=vec3(.06,.027,.093);
  vec3 nebula=mix(blue,violet,smoothstep(-.6,.8,p.x));
  vec3 c=vec3(.0015,.003,.009)+nebula*band*(.25+detail*1.25);
  c*=1.-dust*.78;
  float light=pow(max(0.,dot(p,normalize(vec3(-.8,.15,-1.)))),180.);
  c+=vec3(.12,.24,.36)*light;
  gl_FragColor=vec4(c,1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
 }`,[low])
 return <mesh ref={sky} name="cosmic-sky" renderOrder={-10} raycast={()=>null}>
  <sphereGeometry args={[350,32,20]}/>
  <shaderMaterial side={BackSide} depthWrite={false} vertexShader={`varying vec3 direction;void main(){direction=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`} fragmentShader={fragment}/>
 </mesh>
}
