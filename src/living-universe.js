import {spiralAngle,galaxyRadius} from './galaxy-model.js'
export function orbitSpec(index) {
  return {radius:3.2+index*3.9,speed:.014/(1+index*.17),phase:spiralAngle(3.2+index*3.9,index%4),inclination:.32+(index%3)*.07,spin:.021+index*.004,scale:[.72,.83,.76,.88,.98,.82][index%6]*1.28}
}
export function orbitPosition(index,time=0,angle=null) {
  const s=orbitSpec(index),a=angle??s.phase+time*s.speed
  return [s.radius*Math.cos(a),s.radius*Math.sin(a)*Math.sin(s.inclination),s.radius*Math.sin(a)*Math.cos(s.inclination)]
}
export function galaxyDistance(count,aspect=1) {
  const tan=Math.tan(Math.PI*21/180),ratio=Math.max(.2,Number.isFinite(aspect)?aspect:1)
  let distance=20
  // Fit the actual inclined orbit volumes over a full revolution, rather than
  // a much larger spherical bound. Keep room for rings and projected labels.
  for(let i=0;i<Math.max(6,count);i++)for(let j=0;j<64;j++){
    const [x,y,z]=orbitPosition(i,0,j/64*Math.PI*2),depth=y*.835+z*.55,vertical=y*.55-z*.835
    distance=Math.max(distance,depth+Math.max((Math.abs(x)+3.1)/(tan*ratio),(Math.abs(vertical)+3.1)/tan))
  }
  for(let j=0;j<64;j++){const angle=j/64*Math.PI*2,r=galaxyRadius(count),x=r*Math.cos(angle),y=r*Math.sin(angle)*Math.sin(.38),z=r*Math.sin(angle)*Math.cos(.38);distance=Math.max(distance,y*.835+z*.55+Math.max((Math.abs(x)+1)/(tan*ratio),(Math.abs(y*.55-z*.835)+1)/tan))}
  return distance*1.05
}
export function galaxyFlight(from,to,progress) {
  const t=Math.max(0,Math.min(1,progress)),e=t*t*t*(t*(t*6-15)+10)
  return from.map((v,i)=>v+(to[i]-v)*e+(i===1?Math.sin(Math.PI*t)**2*Math.min(4,Math.abs(to[0]-from[0])*.1):0))
}
export function avoidPlanets(eye,positions,scales) {
  const p=[...eye]
  for(let pass=0;pass<3;pass++)positions.forEach((center,i)=>{const d=p.map((v,k)=>v-center[k]),length=Math.hypot(...d),radius=1.58*scales[i]+.75;if(length<radius){const dir=length>1e-8?d.map(v=>v/length):[0,0,1];for(let k=0;k<3;k++)p[k]=center[k]+dir[k]*radius}})
  return p
}
export function advanceTime(time,delta,active) {return active&&Number.isFinite(delta)&&delta>=0?time+delta:time}
