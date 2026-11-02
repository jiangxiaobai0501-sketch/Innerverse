import test from 'node:test'
import assert from 'node:assert/strict'
import { loadEntries, saveEntries, searchEntries, STORAGE_KEY, localDate } from './storage.js'
const sample = { id: 'a', title: '海边', date: '2026-10-28', content: '今天看到了 Purple 晚霞。', createdAt: '2026-10-28T00:00:00.000Z', updatedAt: '2026-10-28T00:00:00.000Z' }
function memory(raw = null) { return { raw, getItem() { return this.raw }, setItem(key, value) { assert.equal(key, STORAGE_KEY); this.raw = value } } }
test('保存后可重新加载中文与换行', () => { const s = memory(); assert.deepEqual(loadEntries(s).entries, []); saveEntries(s, [{ ...sample, content: '中文\n第二行' }]); assert.equal(loadEntries(s).entries[0].content, '中文\n第二行') })
test('标题及正文搜索，英文忽略大小写', () => { assert.equal(searchEntries([sample], '海边').length, 1); assert.equal(searchEntries([sample], ' PURPLE ').length, 1); assert.equal(searchEntries([sample], '不存在').length, 0) })
test('按日记日期倒序排列', () => { assert.equal(searchEntries([sample, { ...sample, id: 'b', date: '2026-10-29' }], '')[0].id, 'b') })
test('坏JSON、缺失字段和重复编号不覆盖原数据', () => { for (const raw of ['{bad', '{}', '[{"id":"a"}]', JSON.stringify([sample, sample])]) { const s = memory(raw); assert.ok(loadEntries(s).error); assert.equal(s.raw, raw) } })
test('拒绝非法日历日期', () => { assert.ok(loadEntries(memory(JSON.stringify([{ ...sample, date: '2026-02-30' }]))).error) })
test('存储失败抛错，不冒充成功', () => { assert.throws(() => saveEntries({ setItem() { throw new Error('QuotaExceededError') } }, [sample]), /QuotaExceededError/) })
test('删除后持久化为空数组', () => { const s = memory(); saveEntries(s, [sample]); saveEntries(s, []); assert.deepEqual(loadEntries(s).entries, []) })
test('本地日期不转换为UTC', () => { assert.equal(localDate(new Date(2026, 9, 28, 0, 1)), '2026-10-28') })

// Stage 01: compatibility and edit safety, using only in-memory fixtures.
const model = await import('./storage.js')
const image = { id: 'image-1', relativePath: 'attachments/image-1.png', mimeType: 'image/png' }
const extended = { ...sample, mood: 'calm', isFavorite: true, images: [image], custom: { tags: ['海'], version: 7 } }
const now = '2026-10-29T12:00:00.000Z'
test('旧记录补默认值但不修改输入，未知字段保留', () => {
  const input = Object.freeze({ ...sample, extra: { note: '保留' } })
  const entry = model.normalizeEntry(input)
  assert.equal(entry.mood, null); assert.equal(entry.isFavorite, false); assert.deepEqual(entry.images, [])
  assert.deepEqual(entry.extra, input.extra); assert.equal('mood' in input, false)
  assert.equal(entry.id, input.id); assert.equal(entry.createdAt, input.createdAt)
})
test('读取浏览器旧数据不回写原始字节', () => {
  const raw = JSON.stringify([sample], null, 3) + '\r\n'
  const s = memory(raw); const loaded = loadEntries(s)
  assert.equal(loaded.error, ''); assert.equal(loaded.entries[0].mood, null)
  assert.deepEqual(loaded.entries[0].images, []); assert.equal(s.raw, raw)
})
test('混合新旧数据保留元数据，默认图片数组和输入数组互不共享', () => {
  const result = model.normalizeEntries([sample, { ...extended, id: 'b' }])
  assert.deepEqual(result[1], { ...extended, id: 'b' })
  result[0].images.push({}); assert.equal(result[1].images.length, 1)
  result[1].images[0].relativePath = 'changed'; assert.equal(image.relativePath, 'attachments/image-1.png')
})
test('编辑只合并合法正文字段，保留元数据与未知字段，不接受ID或创建时间覆盖', () => {
  const changes = { title: '新标题', content: '新正文', id: 'injected', createdAt: now, mood: 'sad', custom: '覆盖' }
  const input = structuredClone(extended)
  const result = model.applyDiaryEdit(input, changes, now, 'should-not-be-used')
  assert.equal(result.id, sample.id); assert.equal(result.createdAt, sample.createdAt)
  assert.equal(result.updatedAt, now); assert.equal(result.date, sample.date)
  assert.equal(result.title, changes.title); assert.equal(result.content, changes.content)
  assert.equal(result.mood, 'calm'); assert.equal(result.isFavorite, true)
  assert.deepEqual(result.images, [image]); assert.deepEqual(result.custom, extended.custom)
  assert.deepEqual(input, extended); assert.equal(changes.id, 'injected')
})
test('新建使用调用方生成的ID和明确默认值，不接受补丁中的元数据', () => {
  const result = model.applyDiaryEdit(null, { title: '新日记', date: sample.date, content: '正文', id: 'untrusted', mood: 'sad', isFavorite: true, images: [image] }, now, 'new-safe-id')
  assert.equal(result.id, 'new-safe-id'); assert.equal(result.createdAt, now); assert.equal(result.updatedAt, now)
  assert.equal(result.mood, null); assert.equal(result.isFavorite, false); assert.deepEqual(result.images, [])
})
for (const mood of [null, 'happy', 'calm', 'sad', 'anxious']) {
  test(`合法心情 ${String(mood)} 可以往返保存`, () => { const s = memory(); saveEntries(s, [{ ...extended, mood }]); assert.equal(loadEntries(s).entries[0].mood, mood) })
}
const invalidMetadata = [
  ['未知心情', { mood: 'angry' }], ['数字心情', { mood: 1 }], ['显式undefined心情', { mood: undefined }],
  ['字符串收藏', { isFavorite: 'false' }], ['null收藏', { isFavorite: null }],
  ['非数组图片', { images: {} }], ['null图片', { images: null }],
  ['缺失图片字段', { images: [{ id: 'image-1' }] }],
  ['超过三张图片', { images: [1,2,3,4].map(i=>({id:'image-'+i,relativePath:'attachments/image-'+i+'.png',mimeType:'image/png'})) }],
  ['重复图片ID', { images: [image, { ...image }] }],
  ['Windows大小写不敏感的重复图片ID', { images: [image, { ...image, id: 'IMAGE-1', relativePath: 'attachments/IMAGE-1.png' }] }],
  ['绝对路径', { images: [{ ...image, relativePath: 'C:/photos/image-1.png' }] }],
  ['越界路径', { images: [{ ...image, relativePath: 'attachments/../image-1.png' }] }],
  ['反斜杠路径', { images: [{ ...image, relativePath: 'attachments\\image-1.png' }] }],
  ['UNC路径', { images: [{ ...image, relativePath: '//server/share/image-1.png' }] }],
  ['编码越界路径', { images: [{ ...image, relativePath: 'attachments/%2e%2e/image-1.png' }] }],
  ['路径ID不一致', { images: [{ ...image, relativePath: 'attachments/other.png' }] }],
  ['类型不匹配', { images: [{ ...image, mimeType: 'image/jpeg' }] }],
  ['SVG图片', { images: [{ ...image, relativePath: 'attachments/image-1.svg', mimeType: 'image/svg+xml' }] }],
  ['Windows设备名', { images: [{ id: 'CON', relativePath: 'attachments/CON.png', mimeType: 'image/png' }] }]
]
for (const [name, patch] of invalidMetadata) {
  test(`拒绝非法元数据：${name}，不写入浏览器数据`, () => {
    const s = memory(JSON.stringify([sample])); const before = s.raw
    assert.throws(() => saveEntries(s, [{ ...sample, ...patch }]))
    assert.equal(s.raw, before)
  })
}
test('合法图片元数据未知扩展保留，最多三张，支持PNG/JPEG/WebP', () => {
  const images = [image, { id: 'two', relativePath: 'attachments/two.jpg', mimeType: 'image/jpeg', extra: '保留' }, { id: 'three', relativePath: 'attachments/three.webp', mimeType: 'image/webp' }]
  const entry = model.normalizeEntry({ ...sample, images })
  assert.deepEqual(entry.images, images)
  const s = memory(); saveEntries(s, [entry]); assert.deepEqual(loadEntries(s).entries[0], entry)
})
test('未通过的核心字段不能借合并写入', () => { assert.throws(() => model.applyDiaryEdit(extended, { title: ' ' }, now)); assert.throws(() => model.applyDiaryEdit(null, { title:'x',date:'2026-02-30',content:'x' }, now, 'b')) })

for (const [name, images] of [
  ['MIME不能用数组冒充字符串', [{ ...image, mimeType: ['image/png'] }]],
  ['ID不能有换行控制字符', [{ id:'image-1\n', relativePath:'attachments/image-1\n.png', mimeType:'image/png' }]],
  ['图片数组不能有空槽', new Array(1)]
]) test(name, () => { const s=memory(JSON.stringify([sample]));const before=s.raw;assert.throws(()=>saveEntries(s,[{...sample,images}]));assert.equal(s.raw,before) })
test('日记数组不能有空槽',()=>assert.throws(()=>model.normalizeEntries(new Array(1))))

// Stage 02: explicit metadata actions and combined filtering.
for (const mood of [null, 'happy', 'calm', 'sad', 'anxious']) test('心情显式编辑并往返：'+mood, () => {
  const next=model.applyDiaryMetadata(extended,{mood});const s=memory();saveEntries(s,[next]);assert.deepEqual(loadEntries(s).entries[0],{...extended,mood});assert.deepEqual(extended.custom,{tags:['海'],version:7})
})
test('收藏切换只改变收藏字段，忽略注入的正文、ID和其他元数据',()=>{
  const next=model.applyDiaryMetadata(extended,{isFavorite:false,id:'wrong',title:'wrong',date:'2000-01-01',content:'wrong',updatedAt:now,images:[],custom:'wrong'})
  assert.deepEqual(next,{...extended,isFavorite:false});assert.deepEqual(model.applyDiaryMetadata(next,{isFavorite:true}),extended)
})
test('旧日记编辑心情及收藏后仍可编辑标题、保存和删除',()=>{
  const s=memory();const edited=model.applyDiaryMetadata(model.applyDiaryEdit(sample,{title:'旧日记新标题'},now),{mood:'sad',isFavorite:true});saveEntries(s,[edited]);const reread=loadEntries(s).entries[0];assert.equal(reread.title,'旧日记新标题');assert.equal(reread.id,sample.id);assert.equal(reread.mood,'sad');assert.equal(reread.isFavorite,true);saveEntries(s,[]);assert.deepEqual(loadEntries(s).entries,[])
})
test('收藏筛选组合标题正文搜索，大小写、空白、排序与无结果',()=>{
  const input=[{...extended,id:'a'},{...extended,id:'b',date:'2026-10-29',isFavorite:false},{...extended,id:'c',date:'2026-10-30'}];const before=JSON.stringify(input)
  assert.deepEqual(searchEntries(input,'海边',true).map(e=>e.id),['c','a']);assert.deepEqual(searchEntries(input,' PURPLE ',true).map(e=>e.id),['c','a']);assert.equal(searchEntries(input,'',false).length,3);assert.equal(searchEntries(input,' ',true).length,2);assert.equal(searchEntries(input,'没有',true).length,0);assert.equal(searchEntries([sample],'',true).length,0);assert.equal(JSON.stringify(input),before)
})
for(const patch of [{mood:'wrong'},{isFavorite:'true'},{mood:undefined}])test('非法显式元数据不触碰有效存储 '+JSON.stringify(patch),()=>{
  const s=memory(JSON.stringify([extended]));const before=s.raw;assert.throws(()=>saveEntries(s,[model.applyDiaryMetadata(extended,patch)]));assert.equal(s.raw,before)
})
test('普通编辑保留最新收藏状态及心情，不允许正文补丁覆盖它们',()=>{
 const latest=model.applyDiaryMetadata(extended,{isFavorite:false,mood:'anxious'});const next=model.applyDiaryEdit(latest,{content:'编辑后的文字',isFavorite:true,mood:null},now);assert.equal(next.isFavorite,false);assert.equal(next.mood,'anxious');assert.deepEqual(next.images,extended.images);assert.deepEqual(next.custom,extended.custom)
})

// Stage 03: read-only calendar grouping; all fixtures are synthetic.
const timeline = await import('./timeline.js')
const moments = [
 {...sample,id:'old',date:'2024-12-31'},
 {...extended,id:'nov',date:'2026-11-01'},
 {...sample,id:'jan',date:'2026-01-02'},
 {...extended,id:'oct-a',date:'2026-10-21',createdAt:'2026-10-21T08:00:00Z'},
 {...sample,id:'oct-b',date:'2026-10-21',createdAt:'2026-10-21T09:00:00Z'}
]
test('时间轴按原date跨年跨月倒序，月份只保留存在的记录',()=>{
 const groups=timeline.groupTimelineEntries(moments);assert.deepEqual(groups.years.map(y=>y.year),['2026','2024']);assert.deepEqual(groups.years[0].months.map(m=>m.key),['2026-11','2026-10','2026-01']);assert.deepEqual(groups.years[1].months.map(m=>m.key),['2024-12']);assert.deepEqual(groups.undated,[])
})
test('同日多篇完整显示，按创建时间和稳定ID排序',()=>{
 const groups=timeline.groupTimelineEntries([...moments,{...moments[3],id:'oct-c'}]);assert.deepEqual(groups.years[0].months[1].entries.map(e=>e.id),['oct-b','oct-a','oct-c'])
})
test('编辑正文心情收藏与updatedAt不会改变时间轴位置，全部元数据保留',()=>{
 const positions=data=>timeline.groupTimelineEntries(data).years.flatMap(y=>y.months.flatMap(m=>m.entries.map(e=>e.id)))
 const before=positions(moments);const changed=moments.map(e=>e.id==='oct-a'?model.applyDiaryMetadata(model.applyDiaryEdit(e,{title:'更新标题',content:'更新正文'},'2099-01-01T00:00:00Z'),{mood:'anxious',isFavorite:false}):e)
 assert.deepEqual(positions(changed),before);assert.equal(changed[3].date,'2026-10-21');assert.deepEqual(changed[3].images,moments[3].images);assert.deepEqual(changed[3].custom,moments[3].custom)
})
test('时间轴明确编辑记录日期时按新日期分组，不偷偷使用创建时间',()=>{
 const edited=model.applyDiaryEdit(moments[0],{date:'2027-02-03'},now);assert.equal(timeline.groupTimelineEntries([edited]).years[0].months[0].key,'2027-02');assert.equal(edited.createdAt,moments[0].createdAt)
})
test('时间轴复用标题正文搜索与收藏组合，保留原对象和标记',()=>{
 for(const query of ['海边',' PURPLE ']){const found=searchEntries(moments,query,true);const groups=timeline.groupTimelineEntries(found);const entries=groups.years.flatMap(y=>y.months.flatMap(m=>m.entries));assert.equal(entries.length,2);assert.ok(entries.every(e=>e.isFavorite&&e.mood==='calm'));assert.equal(entries.find(e=>e.id==='oct-a'),moments[3])}assert.deepEqual(timeline.groupTimelineEntries(searchEntries(moments,'找不到',true)),{years:[],undated:[]})
})
test('时间轴分组不修改原数组、原记录或日期，不按updatedAt搬动历史日记',()=>{
 const raw=JSON.stringify(moments);const frozen=Object.freeze(moments.map(e=>Object.freeze({...e,updatedAt:'2099-01-01T00:00:00Z'})));timeline.groupTimelineEntries(frozen);assert.equal(JSON.stringify(moments),raw);assert.equal(timeline.groupTimelineEntries(frozen).years.at(-1).year,'2024')
})
test('空数组和无输入产生安全空结果',()=>{for(const input of [[],null,undefined])assert.deepEqual(timeline.groupTimelineEntries(input),{years:[],undated:[]})})
for(const date of [undefined,null,'','2026-02-30','2026-13-01','2026-00-01','2026-10-00','2026-10-21T00:00:00Z',123])test('异常日期仅进待确认分组，不影响其他年月 '+String(date),()=>{
 const bad={...sample,id:'bad',date};const groups=timeline.groupTimelineEntries([bad,...moments]);assert.equal(groups.years.length,2);assert.deepEqual(groups.undated,[bad]);assert.equal(timeline.diaryDateParts(date),null);assert.equal(bad.date,date)
})
test('日历闰年、世纪年和古早年份不经UTC转换',()=>{
 for(const date of ['2000-02-29','2024-02-29','0001-01-01','0099-12-31'])assert.ok(timeline.diaryDateParts(date));for(const date of ['1900-02-29','2100-02-29','2023-02-29','2026-04-31'])assert.equal(timeline.diaryDateParts(date),null)
})
const {spawnSync}=await import('node:child_process')
for(const timezone of ['Asia/Shanghai','America/Los_Angeles','Pacific/Kiritimati'])test('时区 '+timezone+' 不改变年月日归属',()=>{
 const code='import {groupTimelineEntries} from '+JSON.stringify(new URL('./timeline.js',import.meta.url).href)+';process.stdout.write(JSON.stringify(groupTimelineEntries('+JSON.stringify([{...sample,date:'2026-01-01'}])+').years))'
 const result=spawnSync(process.execPath,['--input-type=module','-e',code],{encoding:'utf8',env:{...process.env,TZ:timezone}});assert.equal(result.status,0,result.stderr);const groups=JSON.parse(result.stdout);assert.equal(groups[0].year,'2026');assert.equal(groups[0].months[0].key,'2026-01');assert.equal(groups[0].months[0].entries[0].date,'2026-01-01')
})

test('异常日期经过既有搜索排序后仍能进入时间轴待确认组',()=>{
 const bad=[undefined,null,'2026-02-30',123,{}].map((date,i)=>({...sample,id:'bad-'+i,date}));const found=searchEntries([...bad,...moments],'海边');const groups=timeline.groupTimelineEntries(found);assert.equal(groups.undated.length,5);assert.equal(groups.years.length,2);assert.equal(found.length,10)
})
