export const CINEMA_SETTINGS_KEY = 'xinyu.cinema.v1'
export const MIN_CAMERA_Z = 3.4
export const THEMES = Object.freeze([
  {color:'#8fc9df',accent:'#d5c09a',terrain:0,clouds:.22,ring:0},
  {color:'#65bbb2',accent:'#a3c8a6',terrain:1,clouds:.26,ring:0},
  {color:'#a58ebd',accent:'#e0bea0',terrain:2,clouds:.08,ring:.5},
  {color:'#b88b6d',accent:'#d6b6a0',terrain:3,clouds:.06,ring:0},
  {color:'#788dcf',accent:'#b7a8cf',terrain:4,clouds:.22,ring:.24},
  {color:'#c7dce1',accent:'#9dc5d5',terrain:5,clouds:.1,ring:0}
])
export function stageTheme(index) { return THEMES[((Number.isInteger(index)?index:0)%6+6)%6] }
export function qualityProfile(quality) {
  if(quality==='low')return {segments:40,rings:72,clouds:false,dust:0,nebula:false,fps:60,dpr:1}
  if(quality==='high')return {segments:96,rings:160,clouds:true,dust:100,nebula:true,fps:60,dpr:1.25}
  return {segments:64,rings:120,clouds:true,dust:48,nebula:true,fps:60,dpr:1}
}
export function readCinemaSettings(storage) {
  try {const v=JSON.parse(storage.getItem(CINEMA_SETTINGS_KEY));return {autoCamera:v?.autoCamera!==false,showNames:v?.showNames===true}}catch{return {autoCamera:true,showNames:false}}
}
export function saveCinemaSettings(storage,value) {
  try{storage.setItem(CINEMA_SETTINGS_KEY,JSON.stringify({autoCamera:value.autoCamera!==false,showNames:value.showNames===true}));return true}catch{return false}
}
export function smoothFlight(from,to,progress) {
  const t=Math.max(0,Math.min(1,Number.isFinite(progress)?progress:0)),e=t*t*t*(t*(t*6-15)+10)
  const result=from.map((value,i)=>value+(to[i]-value)*e)
  // Stay in the open space in front of the galaxy, including when interrupted.
  result[2]=Math.max(MIN_CAMERA_Z,result[2]+Math.min(2.5,Math.abs(to[0]-from[0])*.12)*Math.sin(Math.PI*t)**2)
  return result
}
export function overviewDistance(aspect) {return Math.max(25,17/Math.max(.2,Number.isFinite(aspect)?aspect:1))}
export function canCruise({active,reduced,motion,autoCamera}) {return active&&!reduced&&motion==='full'&&autoCamera}
