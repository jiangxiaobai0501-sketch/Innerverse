import test from 'node:test'
import assert from 'node:assert/strict'
import {createFlight,sampleFlight,phaseAt,flightProgress,flightSpeed,FLIGHT_STATES,departureEye} from './journey.js'
import {orbitPosition,orbitSpec,avoidPlanets} from './living-universe.js'

test('departure pulls back smoothly before forward flight, including fast mode',()=>{
 for(const duration of [2.4,7]){
  const from=[0,50,35],aim=[0,0,0],back=departureEye(from,aim)
  assert.ok(back.length()>Math.hypot(...from));assert.ok(back.distanceTo({x:0,y:50,z:35})<=3.201)
  assert.equal(flightProgress(duration*.8/7,duration),0)
  assert.equal(flightSpeed(duration*.8/7,duration),0)
  assert.ok(flightProgress(duration*(.8/7+.0001),duration)<1e-8)
 }
 assert.ok(departureEye([0,0,0],[0,0,0]).length()>1)
})
test('flight phases follow the cinematic rhythm; progress has zero endpoint speed',()=>{
 assert.deepEqual([.1,1,3,5,6.5].map(t=>phaseAt(t)),FLIGHT_STATES);assert.equal(phaseAt(7),'ORBIT_DOCKED')
 assert.equal(flightSpeed(0),0);assert.equal(flightSpeed(7),0);assert.ok(flightSpeed(3.5)>.9)
 let last=0;for(let i=0;i<=700;i++){const p=flightProgress(i/100);assert.ok(p>=last&&p<=1);last=p}assert.equal(last,1)
})
test('every destination has a distinct spatial route, safe moving endpoint and curved approach',()=>{
 const ends=[]
 for(let i=0;i<24;i++){
  const center=orbitPosition(i,0),radius=1.58*orbitSpec(i).scale,path=createFlight([0,50,35],center,radius,i),moving=orbitPosition(i,7)
  assert.deepEqual(sampleFlight(path,center,0).toArray(),[0,50,35])
  const end=sampleFlight(path,moving,1);assert.ok(Math.abs(end.distanceTo({x:moving[0],y:moving[1],z:moving[2]})-radius*3.55)<1e-8)
  assert.ok(path.curve.getPoint(.5).distanceTo(path.curve.v0.clone().lerp(path.curve.v3,.5))>.1)
  const centers=Array.from({length:24},(_,j)=>orbitPosition(j,3)),scales=centers.map((_,j)=>orbitSpec(j).scale)
  for(let p=0;p<=100;p++){const safe=avoidPlanets(sampleFlight(path,center,p/100).toArray(),centers,scales);centers.forEach((c,j)=>assert.ok(Math.hypot(...safe.map((v,k)=>v-c[k]))>=1.58*scales[j]+.749))}
  ends.push(end.toArray().join(','))
 }assert.equal(new Set(ends).size,24)
})
