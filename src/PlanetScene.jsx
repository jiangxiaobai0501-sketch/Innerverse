import { Component, useEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { AdditiveBlending, BackSide, DoubleSide, MathUtils } from 'three'

const vertex = `varying vec3 vPosition; varying vec3 vNormal; varying vec3 vWorldPosition;
void main(){vPosition=position;vNormal=normalize(mat3(modelMatrix)*normal);vec4 world=modelMatrix*vec4(position,1.);vWorldPosition=world.xyz;gl_Position=projectionMatrix*viewMatrix*world;}`
const fragment = `varying vec3 vPosition; varying vec3 vNormal; varying vec3 vWorldPosition;
float hash(vec3 p){p=fract(p*.3183099+vec3(.1,.2,.3));p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
float fbm(vec3 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*noise(p);p=p*2.08+vec3(5.2,1.3,2.8);a*=.49;}return v;}
void main(){
  vec3 p=normalize(vPosition);
  float land=fbm(p*3.8), folds=fbm(p*7.+land*2.8);
  float bands=.5+.5*sin(p.y*20.+folds*9.+p.x*3.);
  vec3 color=mix(vec3(.19,.15,.34),vec3(.48,.38,.66),smoothstep(.2,.64,land));
  color=mix(color,vec3(.72,.53,.64),smoothstep(.32,.87,bands)*.48);
  color=mix(color,vec3(.87,.74,.76),smoothstep(.59,.83,folds+bands*.13)*.65);
  float grain=noise(p*65.);
  color*=.91+grain*.18;
  vec3 normal=normalize(vNormal);
  // Screen-space surface gradient adds shallow relief without more geometry or FBM passes.
  float height=folds*.045+grain*.0008;
  vec3 dx=dFdx(vWorldPosition),dy=dFdy(vWorldPosition);
  vec3 tx=cross(dy,normal),ty=cross(normal,dx);
  float det=dot(dx,tx);
  normal=normalize(normal-sign(det)*(dFdx(height)*tx+dFdy(height)*ty)/max(abs(det),.00001));
  vec3 view=normalize(cameraPosition-vWorldPosition);
  vec3 light=normalize(vec3(-.8,.9,1.4));
  float diffuse=max(dot(normal,light),0.);
  float fill=max(dot(normal,normalize(vec3(1.,-.1,.5))),0.);
  vec3 lit=color*(vec3(.23,.22,.34)+vec3(.95,.86,.94)*diffuse+vec3(.14,.12,.23)*fill);
  float spec=pow(max(dot(normal,normalize(light+view)),0.),24.);
  lit+=vec3(.83,.74,.92)*spec*.09*diffuse;
  float rim=pow(1.-max(dot(normalize(vNormal),view),0.),3.);
  lit+=vec3(.23,.19,.43)*rim*.35;
  gl_FragColor=vec4(lit,1.);
}`
function Controls({ motion }) {
  const { camera, gl } = useThree()
  const controls = useRef()
  useEffect(() => {
    const c = new OrbitControls(camera, gl.domElement)
    c.enableDamping = true; c.dampingFactor = .075
    c.enablePan = false; c.enableZoom = false
    c.minPolarAngle = Math.PI * .25; c.maxPolarAngle = Math.PI * .75
    c.rotateSpeed = .38
    const start = () => { motion.current.dragging = true; motion.current.speed = 0 }
    const end = () => { motion.current.dragging = false; motion.current.lastEnd = performance.now() }
    c.addEventListener('start', start); c.addEventListener('end', end)
    controls.current = c
    return () => { c.removeEventListener('start', start); c.removeEventListener('end', end); controls.current = null; motion.current.dragging = false; c.dispose() }
  }, [camera, gl, motion])
  useFrame((_, dt) => controls.current?.update(Math.min(dt, .05)))
  return null
}
function Planet({ motion }) {
  const body = useRef()
  const reduced = useRef(window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const change = () => { reduced.current = media.matches }
    media.addEventListener('change', change)
    return () => media.removeEventListener('change', change)
  }, [])
  useFrame((_, dt) => {
    const state = motion.current
    if (!body.current || reduced.current) return
    const delta = Math.min(dt, .05)
    const target = state.dragging || performance.now()-state.lastEnd < 900 ? 0 : 1
    state.speed = MathUtils.damp(state.speed, target, 2.4, delta)
    body.current.rotation.y += delta * .055 * state.speed
  })
  return <group rotation={[.17, 0, -.2]}>
    <mesh ref={body}><sphereGeometry args={[1.58, 80, 64]} /><shaderMaterial vertexShader={vertex} fragmentShader={fragment} /></mesh>
    <mesh scale={1.021}><sphereGeometry args={[1.58, 48, 32]} /><shaderMaterial side={BackSide} transparent blending={AdditiveBlending} depthWrite={false}
      vertexShader={`varying vec3 n; varying vec3 eye; void main(){vec4 mv=modelViewMatrix*vec4(position,1.);n=normalize(normalMatrix*normal);eye=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}`}
      fragmentShader={`varying vec3 n;varying vec3 eye;void main(){float a=pow(1.-abs(dot(normalize(n),normalize(eye))),3.);gl_FragColor=vec4(.37,.32,.72,a*.27);}`} /></mesh>
    <group rotation={[MathUtils.degToRad(69), .1, -.28]}>
      <mesh><ringGeometry args={[1.97, 2.68, 160]} /><shaderMaterial transparent side={DoubleSide} depthWrite={false}
        vertexShader={`varying vec3 p;void main(){p=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`}
        fragmentShader={`varying vec3 p;void main(){float r=length(p.xy);float t=(r-1.97)/.71;float stripe=.5+.5*sin(r*80.);float detail=1.-smoothstep(.25,.8,fwidth(r)*80.);float lines=mix(.6,.35+stripe*.5,detail);float gap=1.-.8*(smoothstep(.46,.48,t)-smoothstep(.51,.53,t));float fade=smoothstep(0.,.16,t)*(1.-smoothstep(.72,1.,t));gl_FragColor=vec4(mix(vec3(.43,.37,.65),vec3(.77,.64,.78),t),fade*lines*gap*.43);}`} /></mesh>
    </group>
  </group>
}
function Stars() {
  const { positions, colors } = useMemo(() => {
    let seed = 37
    const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 }
    const positions = [], colors = []
    const palette = [[.73,.72,.94], [.91,.8,.89], [.61,.7,.92]]
    for (let i=0; i<360; i++) {
      const z=rand()*2-1, angle=rand()*Math.PI*2, radius=13+rand()*7
      const xy=Math.sqrt(1-z*z)*radius
      positions.push(xy*Math.cos(angle), xy*Math.sin(angle), z*radius)
      colors.push(...palette[i%palette.length])
    }
    return { positions: new Float32Array(positions), colors: new Float32Array(colors) }
  }, [])
  return <points><bufferGeometry><bufferAttribute attach="attributes-position" args={[positions, 3]} /><bufferAttribute attach="attributes-color" args={[colors, 3]} /></bufferGeometry><pointsMaterial size={.028} vertexColors transparent opacity={.6} sizeAttenuation depthWrite={false} /></points>
}
class Boundary extends Component {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? <div className="planet-fallback"><div /><span>3D 预览暂不可用，日记仍可正常使用</span></div> : this.props.children }
}
export default function PlanetScene() {
  const motion = useRef({ dragging: false, lastEnd: -Infinity, speed: 1 })
  return <Boundary><Canvas dpr={[1, 1.5]} camera={{ position: [0, .2, 7.5], fov: 42 }} gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }} fallback={<div className="planet-fallback"><div /><span>浏览器不支持 WebGL，日记仍可正常使用</span></div>}>
    <Stars /><Planet motion={motion} /><Controls motion={motion} />
  </Canvas></Boundary>
}

