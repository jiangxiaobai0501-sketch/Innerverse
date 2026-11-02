import test from 'node:test'
import assert from 'node:assert/strict'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { createDiaryStore } from './store.mjs'
const root = path.resolve('work/store-tests')
await fs.mkdir(root, { recursive: true })
const entry = { id: 'a', title: '晚风与星光', date: '2026-10-28', content: '中文日记\n第二行', createdAt: '2026-10-28T01:02:03.000Z', updatedAt: '2026-10-28T01:02:03.000Z' }
async function setup(t) { const folder=await fs.mkdtemp(path.join(root,'test-'));t.after(()=>fs.rm(folder,{recursive:true,force:true}));return { folder, store:createDiaryStore(folder) } }
test('首次读取不创建假日记，保存关闭后重新打开数据仍在', async t => { const {folder,store}=await setup(t);assert.deepEqual(await store.read(),[]);await store.save([entry]);assert.deepEqual(await createDiaryStore(folder).read(),model.normalizeEntries([entry])) })
test('修改保留上一版备份，删除后的空数组能够持久化', async t => { const {store}=await setup(t);await store.save([entry]);const next={...entry,content:'已修改'};await store.save([next]);assert.deepEqual(JSON.parse(await fs.readFile(store.filename+'.bak','utf8')),model.normalizeEntries([entry]));await store.save([]);assert.deepEqual(await store.read(),[]);assert.deepEqual(JSON.parse(await fs.readFile(store.filename+'.bak','utf8')),model.normalizeEntries([next])) })
test('坏JSON和重复编号阻止覆盖，原文件字节不变', async t => { const {store}=await setup(t);await fs.writeFile(store.filename,'{broken');await assert.rejects(store.read());await assert.rejects(store.save([entry]));assert.equal(await fs.readFile(store.filename,'utf8'),'{broken');await assert.rejects(async()=>store.save([entry,entry]));assert.equal(await store.snapshot(),'{broken') })
test('主文件丢失但备份存在时不假装是新用户', async t => {const {store}=await setup(t);await fs.writeFile(store.filename+'.bak',JSON.stringify([entry]));await assert.rejects(store.read(),/备份/);await assert.rejects(store.save([]),/备份/);assert.deepEqual(JSON.parse(await fs.readFile(store.filename+'.bak','utf8')),[entry])})
test('连续写入被串行化，最后版本及上一版备份有效，无临时残留', async t => {const {folder,store}=await setup(t);await Promise.all([store.save([entry]),store.save([{...entry,title:'第二版'}]),store.save([{...entry,title:'第三版'}])]);assert.equal((await store.read())[0].title,'第三版');assert.equal(JSON.parse(await fs.readFile(store.filename+'.bak','utf8'))[0].title,'第二版');assert.equal((await fs.readdir(folder)).filter(f=>f.endsWith('.tmp')).length,0)})
test('写盘失败不会报告成功或丢失原数据', async t => {const {store}=await setup(t);await store.save([entry]);await fs.mkdir(store.filename+'.bak');await assert.rejects(store.save([{...entry,title:'不应写入'}]));assert.deepEqual(await store.read(),model.normalizeEntries([entry]))})

const model = await import('../src/storage.js')
const metadata = { mood: 'happy', isFavorite: true, images: [{ id:'photo-1', relativePath:'attachments/photo-1.png', mimeType:'image/png' }], custom: { untouched:['原值'] } }
test('读取旧文件只在内存补默认值，主文件字节及备份状态不变', async t => {
  const {store}=await setup(t)
  const raw='[\r\n  '+JSON.stringify({...entry,legacy:'保留'})+'\r\n]\r\n'
  await fs.writeFile(store.filename,raw,'utf8')
  const data=await store.read()
  assert.deepEqual(data[0],{...entry,legacy:'保留',mood:null,isFavorite:false,images:[]})
  assert.equal(await fs.readFile(store.filename,'utf8'),raw);assert.equal(await store.snapshot(),raw)
  await assert.rejects(fs.access(store.filename+'.bak'),{code:'ENOENT'})
})
test('编辑保存保留扩展字段及ID，重启后保持，旧文件原字节留在备份', async t => {
  const {folder,store}=await setup(t)
  const original={...entry,...metadata}
  const raw=JSON.stringify([original],null,4)+'\r\n'
  await fs.writeFile(store.filename,raw)
  const loaded=await store.read()
  const edited=model.applyDiaryEdit(loaded[0],{title:'编辑后',content:'中文编辑\n保留元数据',id:'hijack'},'2026-10-29T01:02:03.000Z')
  await store.save([edited])
  assert.equal(await fs.readFile(store.filename+'.bak','utf8'),raw)
  assert.deepEqual((await createDiaryStore(folder).read())[0],edited)
  assert.equal(edited.id,entry.id);assert.deepEqual(edited.custom,metadata.custom)
})
for(const [name,patch] of [['mood',{mood:'wrong'}],['isFavorite',{isFavorite:0}],['images',{images:[{id:'x',relativePath:'../outside.png',mimeType:'image/png'}]}]]) {
  test(`主进程拒绝非法${name}，主文件及现有备份字节不变`, async t=>{
    const {store}=await setup(t);await store.save([entry]);await store.save([{...entry,title:'有效新版本'}])
    const before=await fs.readFile(store.filename);const backup=await fs.readFile(store.filename+'.bak')
    await assert.rejects(async()=>store.save([{...entry,...patch}]))
    assert.deepEqual(await fs.readFile(store.filename),before);assert.deepEqual(await fs.readFile(store.filename+'.bak'),backup)
  })
}
test('原文件含非法新字段时拒绝读取和覆盖，不静默过滤或重置', async t=>{
  const {store}=await setup(t);const raw=JSON.stringify([{...entry,mood:'bad'}]);await fs.writeFile(store.filename,raw)
  await assert.rejects(store.read());await assert.rejects(store.save([]));assert.equal(await fs.readFile(store.filename,'utf8'),raw)
})
test('主文件替换失败时旧内容与安全备份可恢复，临时文件无残留', async t=>{
  const {folder,store}=await setup(t);await store.save([{...entry,...metadata}])
  const original=await fs.readFile(store.filename)
  const rename=fs.rename
  t.mock.method(fs,'rename',async(from,to)=>{if(to===store.filename)throw Object.assign(new Error('模拟主文件替换失败'),{code:'EACCES'});return rename(from,to)})
  await assert.rejects(store.save([{...entry,...metadata,title:'不会提交'}]),/模拟主文件替换失败/)
  assert.deepEqual(await fs.readFile(store.filename),original);assert.deepEqual(await fs.readFile(store.filename+'.bak'),original)
  assert.equal((await fs.readdir(folder)).filter(f=>f.endsWith('.tmp')).length,0)
  const recovery=await setup(t);await fs.copyFile(store.filename+'.bak',recovery.store.filename)
  assert.deepEqual(await recovery.store.read(),model.normalizeEntries([{...entry,...metadata}]))
})



// Stage 02: real file storage under isolated work/store-tests only.
for(const mood of [null,'happy','calm','sad','anxious'])test('心情修改通过主进程存储，重新创建存储实例后可读取 '+mood,async t=>{
 const {folder,store}=await setup(t);await store.save([{...entry,...metadata}]);const original=(await store.read())[0];const next=model.applyDiaryMetadata(original,{mood});await store.save([next]);assert.deepEqual((await createDiaryStore(folder).read())[0],{...original,mood})
})
test('收藏与取消收藏重启持久化，正文日期及扩展字段完全保留',async t=>{
 const {folder,store}=await setup(t);await store.save([{...entry,...metadata,isFavorite:false}]);const original=(await store.read())[0];let next=original;for(const isFavorite of [true,false]){next=model.applyDiaryMetadata(next,{isFavorite});await store.save([next]);assert.deepEqual((await createDiaryStore(folder).read())[0],{...original,isFavorite})}assert.equal((await store.read()).length,1)
})
test('收藏写盘失败后保持原状态，重启可读且备份可恢复',async t=>{
 const {folder,store}=await setup(t);await store.save([{...entry,...metadata,isFavorite:false}]);const original=await fs.readFile(store.filename);const rename=fs.rename;t.mock.method(fs,'rename',async(from,to)=>{if(to===store.filename)throw new Error('模拟收藏写盘失败');return rename(from,to)});await assert.rejects(store.save([model.applyDiaryMetadata((await store.read())[0],{isFavorite:true})]),/模拟收藏写盘失败/);assert.deepEqual(await fs.readFile(store.filename),original);assert.deepEqual(await fs.readFile(store.filename+'.bak'),original);assert.equal((await createDiaryStore(folder).read())[0].isFavorite,false)
})
