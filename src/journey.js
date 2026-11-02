import {CubicBezierCurve3,Vector3} from 'three'
export const FLIGHT_STATES=Object.freeze(['FLIGHT_PREPARING','FLIGHT_ACCELERATING','FLIGHT_CRUISING','FLIGHT_DECELERATING','ORBIT_ARRIVAL'])
export const smooth=t=>{const p=Math.max(0,Math.min(1,t));return p*p*p*(p*(p*6-15)+10)}
export function phaseAt(elapsed,duration=7){const t=elapsed/duration;return t<.8/7?'FLIGHT_PREPARING':t<2.5/7?'FLIGHT_ACCELERATING':t<4.5/7?'FLIGHT_CRUISING':t<6/7?'FLIGHT_DECELERATING':t<1?'ORBIT_ARRIVAL':'ORBIT_DOCKED'}
export function flightProgress(elapsed,duration=7){return smooth((elapsed-duration*.8/7)/(duration*6.2/7))}
export function flightSpeed(elapsed,duration=7){const t=Math.max(0,Math.min(1,(elapsed-duration*.8/7)/(duration*6.2/7)));return 16*t*t*(1-t)*(1-t)}
export function departureEye(eye,aim){
 const from=new Vector3(...eye),back=from.clone().sub(new Vector3(...aim))
 const length=back.length();if(length<1e-8)back.set(0,.6,1)
 return from.add(back.normalize().multiplyScalar(Math.min(3.2,Math.max(1.1,length*.045))))
}
export function orbitOffset(center,radius,index=0){
 const radial=new Vector3(center[0],0,center[2]).normalize()
 return new Vector3(radial.x*.55+(index%2?-.18:.18),.72,1.25+radial.z*.3).normalize().multiplyScalar(radius*3.55)
}
export function createFlight(eye,center,radius,index=0){
 const from=new Vector3(...eye),target=new Vector3(...center),offset=orbitOffset(center,radius,index),end=target.clone().add(offset)
 const delta=end.clone().sub(from),side=new Vector3(delta.z,0,-delta.x).normalize().multiplyScalar(Math.min(5,delta.length()*.12)*(index%2?-1:1))
 const first=from.clone().addScaledVector(delta,.3).add(side);first.y+=Math.min(3,delta.length()*.05)
 const second=end.clone().add(new Vector3(index%2?-1:1,.3,.2).normalize().multiplyScalar(radius*2.5)).addScaledVector(offset,.35)
 return {curve:new CubicBezierCurve3(from,first,second,end),center:target,offset,radius,index}
}
export function sampleFlight(path,center,progress,result=new Vector3()){
 path.curve.getPoint(progress,result)
 result.x+=(center[0]-path.center.x)*progress;result.y+=(center[1]-path.center.y)*progress;result.z+=(center[2]-path.center.z)*progress
 return result
}
