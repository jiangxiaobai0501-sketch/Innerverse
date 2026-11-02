import test from 'node:test'
import assert from 'node:assert/strict'
import {promises as fs} from 'node:fs'

import path from 'node:path'
import {DEFAULT_STAGES,STAGE_IDS,validateStages,stageOf,entriesForStage,stageCounts,stagePosition} from './life-stages.js'
import {applyDiaryMetadata,normalizeEntries} from './storage.js'
import {createStageStore} from '../electron/stages.mjs'
import {createDiaryStore} from '../electron/store.mjs'
const testRoot=path.resolve('work/life-stage-tests')
await fs.mkdir(testRoot,{recursive:true})
const entry={id:'legacy',title:'旧记录',content:'不自动推断',date:'2000-01-01',createdAt:'2026-10-30T00:00:00Z',updatedAt:'2026-10-30T00:00:00Z',custom:{keep:true}}
test('six editable templates are explicit, future has no invented biography',()=>{assert.equal(validateStages(DEFAULT_STAGES).length,6);assert.ok(DEFAULT_STAGES.every(s=>s.description===''));assert.deepEqual(DEFAULT_STAGES.map(s=>s.id),STAGE_IDS)})
test('legacy normalization remains unclassified without changing source',()=>{const raw=JSON.stringify(entry);const [e]=normalizeEntries([entry]);assert.equal(stageOf(e),'unclassified');assert.equal(Object.hasOwn(e,'stageId'),false);assert.equal(JSON.stringify(entry),raw)})
test('single-stage edits preserve content identity and metadata',()=>{const e=applyDiaryMetadata(entry,{stageId:'college'});assert.equal(e.stageId,'college');assert.deepEqual(e.custom,entry.custom);assert.equal(e.content,entry.content);assert.equal(applyDiaryMetadata(e,{stageId:null}).stageId,null)})
for(const bad of ['',[],{},12,'unknown'])test('reject invalid stage '+JSON.stringify(bad),()=>assert.throws(()=>applyDiaryMetadata(entry,{stageId:bad})))
test('statistics and filtering never infer dates; no duplicate association',()=>{const list=[entry,{...entry,id:'other',stageId:'future'}],raw=JSON.stringify(list);assert.equal(stageCounts(list).unclassified,1);assert.equal(entriesForStage(list,'future').length,1);assert.equal(entriesForStage(list,null),list);assert.equal(JSON.stringify(list),raw)})
test('stage validation rejects missing duplicate names invalid structures and overlong input',()=>{for(const value of [null,[],DEFAULT_STAGES.slice(1),DEFAULT_STAGES.map(s=>({...s,id:'future'})),DEFAULT_STAGES.map(s=>({...s,name:' '})),DEFAULT_STAGES.map(s=>({...s,description:'x'.repeat(1001)}))])assert.throws(()=>validateStages(value))})
test('arc has unique stable depth coordinates in chronology',()=>{const points=STAGE_IDS.map((_,i)=>stagePosition(i));assert.equal(new Set(points.map(JSON.stringify)).size,6);assert.ok(points.every((p,i)=>!i||p[0]>points[i-1][0]));assert.deepEqual(points[0],stagePosition(0))})
test('atomic stage persistence restart previous backup and corrupt file protection',async()=>{const dir=await fs.mkdtemp(path.join(testRoot,'galaxy-stage-'));const store=createStageStore(dir);assert.deepEqual(await store.read(),DEFAULT_STAGES);assert.deepEqual(await fs.readdir(dir),[]);const next=DEFAULT_STAGES.map(s=>({...s,name:s.name+'自定义'}));await store.save(next);assert.deepEqual(await createStageStore(dir).read(),next);assert.deepEqual(JSON.parse(await fs.readFile(path.join(dir,'life-stages.json.bak'))),DEFAULT_STAGES);await fs.writeFile(path.join(dir,'life-stages.json'),'bad');await assert.rejects(store.save(DEFAULT_STAGES));assert.equal(await fs.readFile(path.join(dir,'life-stages.json'),'utf8'),'bad')})
test('legacy disk read is idempotent and stage save keeps old bytes in backup',async()=>{const dir=await fs.mkdtemp(path.join(testRoot,'galaxy-legacy-'));const file=path.join(dir,'diary.json'),raw=JSON.stringify([entry]);await fs.writeFile(file,raw);const store=createDiaryStore(dir);await store.read();await store.read();assert.equal(await fs.readFile(file,'utf8'),raw);await store.save([applyDiaryMetadata(entry,{stageId:'primary'})]);assert.equal(await fs.readFile(file+'.bak','utf8'),raw);assert.equal((await createDiaryStore(dir).read())[0].stageId,'primary')})
