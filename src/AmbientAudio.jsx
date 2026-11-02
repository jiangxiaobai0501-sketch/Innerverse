import {useEffect,useRef,useState} from 'react'
// Local synthesis only. Starts exclusively from a deliberate button click.
export default function AmbientAudio({active}) {
  const [enabled,setEnabled]=useState(false),[failed,setFailed]=useState(false),audio=useRef(null)
  async function toggle(){if(enabled){setEnabled(false);return}try{if(!audio.current){const context=new AudioContext(),gain=context.createGain();gain.gain.value=0;gain.connect(context.destination);const voices=[130.81,196,261.63].map((frequency,i)=>{const o=context.createOscillator(),g=context.createGain();o.type='sine';o.frequency.value=frequency;g.gain.value=.16/(i+1);o.connect(g);g.connect(gain);o.start();return o});audio.current={context,gain,voices}}await audio.current.context.resume();setEnabled(true);setFailed(false)}catch{setFailed(true)}}
  useEffect(()=>{const a=audio.current;if(!a)return;a.gain.gain.setTargetAtTime(enabled&&active?.08:0,a.context.currentTime,.4);if(!enabled||!active){const timer=setTimeout(()=>a.context.suspend().catch(()=>{}),1800);return()=>clearTimeout(timer)}a.context.resume().catch(()=>setFailed(true))},[active,enabled])
  useEffect(()=>()=>{const a=audio.current;a?.voices.forEach(o=>o.stop());a?.context.close().catch(()=>{})},[])
  return <button type="button" aria-pressed={enabled} onClick={toggle} title={failed?'音频暂不可用，可继续使用日记':'本地合成氛围音，默认关闭'}>{enabled?'关闭氛围音':'开启氛围音'}</button>
}
