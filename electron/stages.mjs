import { promises as fs } from 'node:fs'
import path from 'node:path'
import {randomUUID} from 'node:crypto'
import {DEFAULT_STAGES,validateStages} from '../src/life-stages.js'
import {NO_CONTEXT} from './operation.mjs'
export function createStageStore(directory) {
  const filename=path.join(directory,'life-stages.json'); let queue=Promise.resolve()
  async function read() {
    try {return validateStages(JSON.parse(await fs.readFile(filename,'utf8')))} catch(e) {
      if(e.code!=='ENOENT')throw e
      try {await fs.access(filename+'.bak')}catch(error){if(error.code==='ENOENT')return validateStages(DEFAULT_STAGES);throw error}
      throw new Error('阶段主文件缺失，请保留备份后恢复。')
    }
  }
  async function atomic(file,text,ctx) {const temporary=file+'.'+randomUUID()+'.tmp';try{await ctx.commit(async()=>{const h=await fs.open(temporary,'wx');try{await h.writeFile(text);await h.sync()}finally{await h.close()}});await ctx.commit(()=>fs.rename(temporary,file))}finally{await fs.rm(temporary,{force:true})}}
  return {read,save(value,ctx=NO_CONTEXT){const next=JSON.stringify(validateStages(value),null,2);const op=queue.then(async()=>{ctx.check();const prior=await read();await ctx.commit(()=>fs.mkdir(directory,{recursive:true}));await atomic(filename+'.bak',JSON.stringify(prior,null,2),ctx);await atomic(filename,next,ctx)});queue=op.catch(()=>{});return op}}
}
