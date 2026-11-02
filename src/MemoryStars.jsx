import { memo, useLayoutEffect, useMemo, useEffect, useRef } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import { AdditiveBlending, BufferGeometry, Float32BufferAttribute, Color, Vector3 } from 'three'
import { memoryAppearance, memoryPosition, isMemoryClick, memoryMatchWeights } from './memory-stars.js'
const vertex = `attribute vec3 memoryColor; attribute float favorite; attribute float importance; attribute float matchWeight; varying float vMatch; uniform float pixelRatio; uniform float coreRadius; varying vec3 vColor; varying float vFavorite; varying float vCoreClear;varying float seed;
void main(){vColor=memoryColor;vMatch=matchWeight;vFavorite=max(favorite,importance*.7);seed=position.x*3.+position.y;vec3 world=(modelMatrix*vec4(position,1.)).xyz;vec3 planetCenter=(modelMatrix*vec4(0.,0.,0.,1.)).xyz;vCoreClear=step(coreRadius,length(cross(planetCenter-cameraPosition,normalize(world-cameraPosition))));gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_PointSize=(8.+favorite*6.+importance*3.)*pixelRatio;}`
const fragment = `uniform float reveal;uniform float time;varying float seed;varying float vMatch; varying vec3 vColor; varying float vFavorite; varying float vCoreClear;
void main(){if(vCoreClear<.5)discard;float r=length(gl_PointCoord*2.-1.);float core=exp(-r*r*24.);float halo=exp(-r*r*5.)*(.32+vFavorite*.25);float alpha=(core+halo)*(.94+.06*sin(time*.8+seed));if(r>1.||alpha<.01)discard;gl_FragColor=vec4(vColor,alpha*vMatch*reveal);
#include <colorspace_fragment>
}`
export default memo(function MemoryStars({ entries, gesture, motion, onHover, onSelect, matchingIds, animate = true, coreRadius = 1.66 }) {
  const dpr = useThree(state => state.viewport.dpr)
  const signature = entries.map(entry => entry.id).join('\0')
  const geometry = useMemo(() => {
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new Float32BufferAttribute(entries.flatMap(entry => memoryPosition(entry.id)), 3))
    geometry.setAttribute('memoryColor', new Float32BufferAttribute(new Float32Array(entries.length * 3), 3))
    geometry.setAttribute('matchWeight', new Float32BufferAttribute(new Float32Array(entries.length), 1))
    geometry.setAttribute('favorite', new Float32BufferAttribute(new Float32Array(entries.length), 1))
    geometry.setAttribute('importance', new Float32BufferAttribute(new Float32Array(entries.length), 1))
    geometry.computeBoundingSphere()
    return geometry
  }, [signature])
  useEffect(() => () => geometry.dispose(), [geometry])
  useLayoutEffect(() => {
    const colors = geometry.getAttribute('memoryColor'), favorites = geometry.getAttribute('favorite'), importance=geometry.getAttribute('importance')
    const palette = new Map()
    entries.forEach((entry, index) => {
      const appearance = memoryAppearance(entry)
      if (!palette.has(appearance.color)) palette.set(appearance.color, new Color(appearance.color))
      const color = palette.get(appearance.color)
      colors.setXYZ(index, color.r, color.g, color.b)
      favorites.setX(index, appearance.favorite ? 1 : 0)
      importance.setX(index,entry.isImportant===true||entry.importance==='high'?1:0)
    })
    colors.needsUpdate = true; favorites.needsUpdate = true;importance.needsUpdate=true
  }, [entries, geometry])
  const invalidate = useThree(state => state.invalidate)
  useLayoutEffect(() => {
    geometry.getAttribute('matchWeight').array.set(memoryMatchWeights(entries, matchingIds))
    geometry.getAttribute('matchWeight').needsUpdate = true
    invalidate()
  }, [entries, matchingIds, geometry, invalidate])
  const material = useRef()
  const uniforms = useMemo(() => ({ pixelRatio: { value: dpr }, coreRadius: { value: coreRadius }, reveal: { value: animate ? 0 : 1 },time:{value:0} }), [dpr,coreRadius,animate])
  useFrame((_,delta)=>{if(material.current){const u=material.current.uniforms;u.reveal.value=animate?Math.min(1,u.reveal.value+Math.min(delta,.05)/.9):1;u.time.value=motion.current.time}})
  const center = useMemo(() => new Vector3(), [])
  const entryFor = event => { event.object.localToWorld(center.set(0,0,0)); return event.ray.distanceSqToPoint(center) < coreRadius ** 2 ? null : entries[event.index] }
  return <points name="memory-stars" userData={{ memoryIds: entries.map(entry => entry.id) }}
    onPointerMove={event => { event.stopPropagation(); if (!motion.current.dragging && (!event.buttons || !gesture.current?.moved)) onHover(entryFor(event)?.id ?? null, event) }}
    onPointerOut={() => onHover(null)}
    onPointerDown={event => { event.stopPropagation(); if (gesture.current) gesture.current.id = entryFor(event)?.id }}
    onClick={event => { event.stopPropagation(); const entry = entryFor(event); if (entry && isMemoryClick(gesture.current, event, entry.id)) { onHover(null); onSelect(entry.id) } }}>
    <primitive object={geometry} attach="geometry" />
    <shaderMaterial ref={material} uniforms={uniforms} vertexShader={vertex} fragmentShader={fragment} transparent depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
  </points>
})
