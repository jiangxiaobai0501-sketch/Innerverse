export const GALAXY_ARMS=4
export const spiralAngle=(radius,arm=0)=>arm*Math.PI*2/GALAXY_ARMS+Math.log1p(radius/2.4)*2.1
export const galaxyRadius=count=>3.2+Math.max(5,count-1)*3.9+6
export function galaxyBudget(quality){
 if(quality==='low')return {stars:6500,haze:480,dust:0,blur:0}
 if(quality==='high')return {stars:36000,haze:2800,dust:1700,blur:.5}
 return {stars:18000,haze:1500,dust:850,blur:.25}
}
export function galaxyParticles(count,radius,kind='stars',seed=5117){
 let state=seed;const random=()=>{state=state*16807%2147483647;return state/2147483647},normal=()=>random()+random()+random()-1.5
 const positions=new Float32Array(count*3),colors=new Float32Array(count*3),sizes=new Float32Array(count),arms=new Uint8Array(count)
 for(let i=0;i<count;i++){
  const population=random(),bulge=kind==='stars'&&population<.14,disk=kind==='stars'&&population>.88
  const r=bulge?Math.pow(random(),.7)*3.3:Math.pow(random(),.72)*radius,arm=i%GALAXY_ARMS
  const angle=disk?random()*Math.PI*2:spiralAngle(r,arm)+normal()*(kind==='haze'?.27:.16)*(1.+.5*Math.sin(r*.8+arm))+(kind==='dust'?.14:0)
  const spread=kind==='haze'?.9:kind==='dust'?.18:.2
  positions.set([Math.cos(angle)*r+normal()*spread,(bulge?normal()*2.1:normal()*(.24+.8*Math.exp(-r/7))+.13*Math.sin(r*.7+arm))*(kind==='haze'?1.7:1),Math.sin(angle)*r+normal()*spread],i*3)
  const t=Math.min(1,r/(radius*.65)),accent=random()>.86
  const warm=[.95,.66,.32],cool=accent?[.65,.39,.7]:[.40,.55,.85]
  colors.set(kind==='dust'?[.027,.018,.045]:warm.map((v,k)=>v*(1-t)+cool[k]*t),i*3)
  sizes[i]=kind==='haze'?12+random()*24:kind==='dust'?13+random()*20:.65+Math.pow(random(),4)*2.2
  arms[i]=arm
 }
 return {positions,colors,sizes,arms}
}
