import { promises as fs } from 'node:fs'
import path from 'node:path'
import { randomBytes, createHmac, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
const derive = promisify(scrypt)
const PARAMS = Object.freeze({ N:32768, r:8, p:1, maxmem:64*1024*1024 })
const IDLE = new Set([0,5,15,30])
const lockedError = () => Object.assign(new Error('私人空间已锁定，请重新解锁。'),{code:'LOCKED'})
const unavailable = () => Object.assign(new Error('安全配置不可用，已拒绝访问。请恢复完整安全配置，勿删除文件重设密码。'),{code:'SECURITY_CONFIG'})
const hex = (value,length) => typeof value==='string' && value.length===length && /^[a-f0-9]+$/.test(value)
function newPassword(password, confirmation) {
  if(typeof password!=='string'||Buffer.byteLength(password)>1024||[...password].length<8)throw new Error('密码需至少8个字符，且不超过1024字节。')
  if(password!==confirmation)throw new Error('两次输入的密码不一致。')
}
function content(record) { const {mac,...fields}=record;return fields }
function signature(record,anchor){return createHmac('sha256',Buffer.from(anchor.secret,'hex')).update(JSON.stringify(content(record))).digest('hex')}
function validate(record,anchor) {
 if(!anchor||anchor.version!==1||!hex(anchor.id,32)||!hex(anchor.secret,64))throw unavailable()
 if(!record||record.version!==1||record.kdf!=='scrypt'||record.N!==PARAMS.N||record.r!==8||record.p!==1||record.anchor!==anchor.id||!hex(record.salt,64)||!hex(record.verifier,64)||!hex(record.credentialId,32)||!hex(record.mac,64)||!IDLE.has(record.idleMinutes)||!Number.isSafeInteger(record.failures)||record.failures<0||record.failures>1000000000||!Number.isSafeInteger(record.blockedUntil)||record.blockedUntil<0)throw unavailable()
 const expected=Buffer.from(signature(record,anchor),'hex');if(!timingSafeEqual(expected,Buffer.from(record.mac,'hex')))throw unavailable()
 return record
}
export function createPasswordLock(userData,{now=()=>Date.now(),onChange=()=>{}}={}) {
 const directory=path.join(userData,'security'),filename=path.join(directory,'lock.json'),anchorFile=path.join(directory,'anchor.json')
 let queue=Promise.resolve(),mode='unknown',record=null,anchor=null,unlocked=false,owner=null,epoch=0,lastActivity=0,fingerprint=null
 const writes=new Set()
 function serial(action){const operation=queue.then(action);queue=operation.catch(()=>{});return operation}
 function publicState(){return {phase:mode==='blocked'?'blocked':mode==='setup'?'setup':unlocked?'unlocked':'locked',idleMinutes:record?.idleMinutes??0,retryAfterMs:Math.max(0,(record?.blockedUntil??0)-now()),session:epoch}}
 function publish(){onChange(publicState())}
 function lock(reason='manual'){unlocked=false;owner=null;fingerprint=null;epoch++;publish();return {...publicState(),reason}}
 function block(){const changed=mode!=='blocked'||unlocked;mode='blocked';if(changed)lock('configuration');throw unavailable()}
 async function safeDirectory(create=false){if(create)await fs.mkdir(directory,{recursive:true,mode:0o700});const stat=await fs.lstat(directory);if(!stat.isDirectory()||stat.isSymbolicLink()||path.resolve(await fs.realpath(directory)).toLowerCase()!==path.join(await fs.realpath(userData),'security').toLowerCase())throw unavailable()}
 async function readJSON(file){const stat=await fs.lstat(file);if(!stat.isFile()||stat.isSymbolicLink()||stat.size>16384)throw unavailable();return JSON.parse(await fs.readFile(file,'utf8'))}
 async function refresh(){
  let nextAnchor,next
  try {
   try{await safeDirectory()}catch(error){if(error.code==='ENOENT'){if(mode==='unknown'||mode==='setup'){mode='setup';return}return block()}throw error}
   const results=await Promise.allSettled([readJSON(anchorFile),readJSON(filename)])
   if(results.every(item=>item.status==='rejected'&&item.reason.code==='ENOENT')){if(mode==='unknown'||mode==='setup'){mode='setup';return}return block()}
   if(results.some(item=>item.status==='rejected'))return block()
   nextAnchor=results[0].value;next=validate(results[1].value,nextAnchor)
  }catch{return block()}
  if(unlocked&&fingerprint!==next.credentialId+next.verifier+next.salt)lock('configuration-changed')
  anchor=nextAnchor;record=next;mode='ready'
 }
 function checkIdle(){if(unlocked&&record.idleMinutes&&now()-lastActivity>=record.idleMinutes*60000)lock('idle')}
 function checkOwner(requestOwner){checkIdle();if(mode!=='ready'||!unlocked||owner!==requestOwner)throw lockedError()}
 function context(requestOwner,privateOperation=true){const version=epoch;const check=()=>{if(version!==epoch||mode==='blocked')throw lockedError();if(privateOperation)checkOwner(requestOwner)};return {check,commit(action){check();const pending=Promise.resolve().then(()=>{check();return action()});writes.add(pending);pending.then(()=>writes.delete(pending),()=>writes.delete(pending));return pending}}}
 async function atomicRecord(next,ctx){
  const signed={...content(next),mac:signature(next,anchor)}
  await ctx.commit(async()=>{
   await safeDirectory();const temporary=filename+'.'+randomBytes(12).toString('hex')+'.tmp';let file
   try{file=await fs.open(temporary,'wx',0o600);await file.writeFile(JSON.stringify(signed,null,2));await file.sync();await file.close();file=null;await fs.rename(temporary,filename)}finally{await file?.close().catch(()=>{});await fs.unlink(temporary).catch(()=>{})}
  });record=signed;return signed
 }
 async function verify(password,ctx){
  if(typeof password!=='string'||Buffer.byteLength(password)>1024)throw new Error('密码不正确或暂时无法验证。')
  if(record.blockedUntil>now())throw Object.assign(new Error('尝试过于频繁，请稍后再试。'),{retryAfterMs:record.blockedUntil-now()})
  const failures=Math.min(record.failures+1,1000000000),delay=failures<3?0:Math.min(300000,1000*2**Math.min(failures-3,9))
  // Reserve/persist the attempt before verification: read-only files cannot disable throttling.
  await atomicRecord({...record,failures,blockedUntil:now()+delay},ctx)
  const candidate=await derive(password,Buffer.from(record.salt,'hex'),32,PARAMS);ctx.check()
  if(!timingSafeEqual(candidate,Buffer.from(record.verifier,'hex')))throw Object.assign(new Error('密码不正确，请重试。'),{retryAfterMs:Math.max(0,record.blockedUntil-now())})
  await atomicRecord({...record,failures:0,blockedUntil:0},ctx);ctx.check()
 }
 return {filename,anchorFile,
  status:()=>serial(async()=>{try{await refresh();checkIdle()}catch{}return publicState()}),
  setup:(password,confirmation,requestOwner)=>serial(async()=>{
   await refresh();if(mode!=='setup')throw unavailable();newPassword(password,confirmation)
   const ctx=context(requestOwner,false),salt=randomBytes(32),verifier=await derive(password,salt,32,PARAMS);ctx.check()
   const nextAnchor={version:1,id:randomBytes(16).toString('hex'),secret:randomBytes(32).toString('hex')}
   await ctx.commit(async()=>{
    await safeDirectory(true);let created=false
    try{const file=await fs.open(anchorFile,'wx',0o600);created=true;try{await file.writeFile(JSON.stringify(nextAnchor));await file.sync()}finally{await file.close()}
     anchor=nextAnchor;await atomicRecord({version:1,kdf:'scrypt',N:32768,r:8,p:1,anchor:anchor.id,salt:salt.toString('hex'),verifier:verifier.toString('hex'),credentialId:randomBytes(16).toString('hex'),idleMinutes:0,failures:0,blockedUntil:0},ctx)
    }catch(error){if(created){try{await fs.access(filename)}catch(missing){if(missing.code==='ENOENT')await fs.unlink(anchorFile).catch(()=>{})}}throw error}
   });ctx.check();mode='ready';epoch++;unlocked=true;owner=requestOwner;fingerprint=record.credentialId+record.verifier+record.salt;lastActivity=now();publish();return publicState()
  }),
  unlock:(password,requestOwner)=>serial(async()=>{await refresh();if(mode!=='ready')throw unavailable();const ctx=context(requestOwner,false);await verify(password,ctx);ctx.check();epoch++;unlocked=true;owner=requestOwner;fingerprint=record.credentialId+record.verifier+record.salt;lastActivity=now();publish();return publicState()}),
  lock,
  changePassword:(oldPassword,password,confirmation,requestOwner)=>serial(async()=>{await refresh();checkOwner(requestOwner);newPassword(password,confirmation);const ctx=context(requestOwner);await verify(oldPassword,ctx);const salt=randomBytes(32),verifier=await derive(password,salt,32,PARAMS);ctx.check();await atomicRecord({...record,salt:salt.toString('hex'),verifier:verifier.toString('hex'),credentialId:randomBytes(16).toString('hex'),failures:0,blockedUntil:0},ctx);lock('password-changed');return publicState()}),
  setIdle:(minutes,requestOwner)=>serial(async()=>{await refresh();checkOwner(requestOwner);if(!IDLE.has(minutes))throw new Error('自动锁定选项不正确。');const ctx=context(requestOwner);await atomicRecord({...record,idleMinutes:minutes},ctx);lastActivity=now();ctx.check();publish();return publicState()}),
  activity(requestOwner){if(unlocked&&owner===requestOwner){checkIdle();if(unlocked)lastActivity=now()}},
  async runPrivate(requestOwner,action){const ctx=await serial(async()=>{await refresh();checkOwner(requestOwner);return context(requestOwner)});ctx.check();const result=await action(ctx);ctx.check();return result},
  async settled(){await Promise.allSettled([...writes])},
  tick:()=>serial(async()=>{try{await refresh();checkIdle()}catch{}return publicState()})
 }
}
