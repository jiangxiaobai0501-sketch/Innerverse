import { useEffect, useRef, useState } from 'react'
import { ImageOff, X, ZoomIn } from 'lucide-react'
function Photo({ image, index, onPreview, onRemove, disabled }) {
  const [state,setState]=useState({loading:true,url:'',error:''})
  useEffect(()=>{
    let active=true
    setState({loading:true,url:'',error:''})
    async function load(){try{const result=await window.xinyuDiary?.readImage(image);if(!result?.ok||!result.dataUrl)throw new Error();if(active)setState({loading:false,url:result.dataUrl,error:''})}catch{if(active)setState({loading:false,url:'',error:'照片缺失、损坏或无法读取，请从完整图文备份恢复。'})}}
    load();return()=>{active=false}
  },[image.id,image.relativePath,image.mimeType])
  return <figure className="diary-photo"><button className="photo-thumb" type="button" disabled={disabled||state.loading||Boolean(state.error)} aria-label={`预览照片 ${index+1}`} onClick={()=>onPreview(state.url)}>{state.error?<span className="photo-error"><ImageOff size={22}/>{state.error}</span>:state.loading?<span className="muted">正在读取照片…</span>:<><img src={state.url} alt={`日记照片 ${index+1}`} onError={()=>setState({loading:false,url:'',error:'照片无法显示，请检查备份。'})}/><span className="photo-zoom"><ZoomIn size={17}/></span></>}</button>{onRemove&&<button type="button" className="photo-remove" disabled={disabled} aria-label={`移除照片 ${index+1}`} onClick={()=>onRemove(image)}><X size={15}/></button>}</figure>
}
function Preview({url,onClose}){
 const dialog=useRef(null)
 useEffect(()=>{const element=dialog.current;element.showModal();return()=>element.close()},[])
 return <dialog ref={dialog} className="photo-preview" aria-label="照片放大预览" onClick={event=>{event.stopPropagation();if(event.target===dialog.current)onClose()}} onCancel={event=>{event.preventDefault();event.stopPropagation();onClose()}}><button type="button" className="icon-button" aria-label="关闭照片预览" onClick={onClose}><X size={22}/></button><img src={url} alt="日记照片放大预览"/></dialog>
}
export default function DiaryImages({images,onRemove,disabled=false}){
 const [preview,setPreview]=useState(null)
 return <><div className="diary-photos">{images.map((image,index)=><Photo key={image.id} image={image} index={index} onPreview={setPreview} onRemove={onRemove} disabled={disabled}/>)}</div>{preview&&<Preview url={preview} onClose={()=>setPreview(null)}/>}</>
}
