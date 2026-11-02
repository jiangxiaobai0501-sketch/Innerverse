import {useEffect,useRef} from 'react'
import {useFrame,useThree} from '@react-three/fiber'
import {ACESFilmicToneMapping,Vector2,MathUtils} from 'three'
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js'
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js'
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js'
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js'
import {ShaderPass} from 'three/addons/postprocessing/ShaderPass.js'
import {BokehPass} from 'three/addons/postprocessing/BokehPass.js'

// Use the bundled Three.js passes; one scene render and a bounded bloom chain.
export default function StarseaEffects({quality,motion}) {
 const {gl,scene,camera,size,invalidate}=useThree(),pipeline=useRef(null)
 useEffect(()=>{
  const saved={tone:gl.toneMapping,exposure:gl.toneMappingExposure,reset:gl.info.autoReset}
  gl.toneMapping=ACESFilmicToneMapping;gl.toneMappingExposure=1.12;gl.info.autoReset=false
  if(quality!=='low'){
   const composer=new EffectComposer(gl),render=new RenderPass(scene,camera)
   const bloom=new UnrealBloomPass(new Vector2(1,1),quality==='high'?.24:.16,.45,.78)
   const bokeh=quality==='high'?new BokehPass(scene,camera,{focus:30,aperture:.00004,maxblur:.001}):null
   const grade=new ShaderPass({uniforms:{tDiffuse:{value:null}},vertexShader:`varying vec2 p;void main(){p=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`uniform sampler2D tDiffuse;varying vec2 p;void main(){vec4 c=texture2D(tDiffuse,p);float vignette=1.-.17*smoothstep(.16,.73,length(p-.5));c.rgb*=mix(vec3(.985,1.,1.02),vec3(1.),smoothstep(.04,.6,dot(c.rgb,vec3(.2126,.7152,.0722))));gl_FragColor=vec4(c.rgb*vignette,c.a);}`})
   const output=new OutputPass()
   composer.addPass(render);if(bokeh){bokeh.enabled=false;composer.addPass(bokeh)}composer.addPass(bloom);composer.addPass(grade);composer.addPass(output)
   pipeline.current={composer,bloom,bokeh}
  }
  invalidate()
  return()=>{
   const p=pipeline.current
   if(p){for(const pass of p.composer.passes)pass.dispose();p.bloom.materialHighPassFilter.dispose();p.composer.dispose()}
   pipeline.current=null;gl.toneMapping=saved.tone;gl.toneMappingExposure=saved.exposure;gl.info.autoReset=saved.reset
  }
 },[gl,scene,camera,quality,invalidate])
 useEffect(()=>{
  const p=pipeline.current
  if(p){p.composer.setPixelRatio(gl.getPixelRatio());p.composer.setSize(size.width,size.height);p.bloom.setSize(Math.ceil(size.width*gl.getPixelRatio()*.55),Math.ceil(size.height*gl.getPixelRatio()*.55))}
  scene.userData.starsea={bloom:!!p,exposure:1.12,volumeSteps:quality==='low'?10:quality==='high'?32:22}
  invalidate()
 },[quality,size.width,size.height,gl,scene,invalidate])
 useFrame((_,delta)=>{
  const speed=motion?.current.flightSpeed??0
  gl.toneMappingExposure=MathUtils.damp(gl.toneMappingExposure,1.12+speed*.07,3,Math.min(delta,.05))
  const bokeh=pipeline.current?.bokeh
  if(bokeh){bokeh.enabled=speed>.15;bokeh.uniforms.focus.value=scene.userData.journey?.distance??30;bokeh.uniforms.maxblur.value=.001*speed}
  gl.info.reset()
  if(pipeline.current)pipeline.current.composer.render(delta)
  else gl.render(scene,camera)
  scene.userData.renderedFrames=(scene.userData.renderedFrames??0)+1
  scene.userData.starsea.exposure=gl.toneMappingExposure;scene.userData.starsea.dof=!!bokeh?.enabled
 },1)
 return null
}
