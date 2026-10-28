import { Component, useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { AdditiveBlending, BackSide, DoubleSide, MathUtils } from 'three'

const vertex = `varying vec3 vPosition; varying vec3 vNormal;
void main(){vPosition=position; vNormal=normal; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`
const fragment = `varying vec3 vPosition; varying vec3 vNormal;
float hash(vec3 p){p=fract(p*.3183099+vec3(.1,.2,.3));p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
float fbm(vec3 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*noise(p);p=p*2.08+vec3(5.2,1.3,2.8);a*=.49;}return v;}
void main(){vec3 p=normalize(vPosition);float n=fbm(p*4.);float warp=fbm(p*7.+n*3.);float bands=sin(p.y*22.+warp*10.+p.x*4.)*.5+.5;
vec3 dark=vec3(.20,.14,.39), purple=vec3(.48,.36,.68), rose=vec3(.79,.58,.66), cream=vec3(.91,.79,.73);
vec3 color=mix(dark,purple,smoothstep(.18,.65,n));color=mix(color,rose,smoothstep(.35,.85,bands)*.7);color=mix(color,cream,smoothstep(.64,.9,warp+bands*.16)*.7);
float detail=fbm(p*95.);color*=.78+detail*.42;float light=max(dot(normalize(vNormal),normalize(vec3(-.8,.65,1.1))),0.);color*=.16+light*.98;
float rim=pow(1.-abs(p.z),3.);color+=vec3(.29,.23,.52)*rim*.36;gl_FragColor=vec4(color,1.);}`
function Controls() {
  const { camera, gl } = useThree()
  const controls = useRef()
  useEffect(() => {
    const c = new OrbitControls(camera, gl.domElement)
    c.enableDamping = true; c.enablePan = false; c.enableZoom = false
    c.minPolarAngle = Math.PI * .25; c.maxPolarAngle = Math.PI * .75
    c.rotateSpeed = .45; controls.current = c
    return () => { controls.current = null; c.dispose() }
  }, [camera, gl])
  useFrame(() => controls.current?.update())
  return null
}
function Planet() {
  const body = useRef()
  const reduced = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches, [])
  useFrame((_, dt) => { if (body.current && !reduced) body.current.rotation.y += Math.min(dt, .05) * .075 })
  return <group rotation={[.17, 0, -.2]}>
    <mesh ref={body}><sphereGeometry args={[1.58, 80, 64]} /><shaderMaterial vertexShader={vertex} fragmentShader={fragment} /></mesh>
    <mesh scale={1.027}><sphereGeometry args={[1.58, 48, 32]} /><shaderMaterial side={BackSide} transparent blending={AdditiveBlending} depthWrite={false}
      vertexShader={`varying vec3 n; varying vec3 eye; void main(){vec4 mv=modelViewMatrix*vec4(position,1.);n=normalize(normalMatrix*normal);eye=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}`}
      fragmentShader={`varying vec3 n;varying vec3 eye;void main(){float a=pow(1.-abs(dot(n,eye)),3.);gl_FragColor=vec4(.43,.31,.8,a*.38);}`} /></mesh>
    <group rotation={[MathUtils.degToRad(69), .1, -.28]}>
      <mesh><ringGeometry args={[1.97, 2.68, 160]} /><shaderMaterial transparent side={DoubleSide} depthWrite={false}
        vertexShader={`varying vec3 p;void main(){p=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`}
        fragmentShader={`varying vec3 p;void main(){float r=length(p.xy);float t=(r-1.97)/.71;float lines=.4+.6*pow(sin(r*230.)*.5+.5,2.);float fade=smoothstep(0.,.12,t)*(1.-smoothstep(.65,1.,t));gl_FragColor=vec4(mix(vec3(.48,.37,.69),vec3(.81,.65,.75),t),fade*lines*.52);}`} /></mesh>
    </group>
  </group>
}
function Stars() {
  const positions = useMemo(() => {
    let seed = 37
    const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 }
    return new Float32Array(Array.from({ length: 450 * 3 }, () => (rand() - .5) * 30))
  }, [])
  return <points><bufferGeometry><bufferAttribute attach="attributes-position" args={[positions, 3]} /></bufferGeometry><pointsMaterial size={.022} color="#d7ceff" transparent opacity={.65} sizeAttenuation depthWrite={false} /></points>
}
class Boundary extends Component {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? <div className="planet-fallback"><div /><span>3D 预览暂不可用，日记仍可正常使用</span></div> : this.props.children }
}
export default function PlanetScene() {
  return <Boundary><Canvas dpr={[1, 1.5]} camera={{ position: [0, .2, 7.5], fov: 42 }} gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }} fallback={<div className="planet-fallback"><div /><span>浏览器不支持 WebGL，日记仍可正常使用</span></div>}>
    <Stars /><Planet /><Controls />
  </Canvas></Boundary>
}
