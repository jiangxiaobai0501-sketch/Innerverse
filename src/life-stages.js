export const STAGE_IDS = ['childhood', 'primary', 'junior', 'senior', 'college', 'future']
export const DEFAULT_STAGES = STAGE_IDS.map((id, i) => ({ id, name: ['童年星球','小学星球','初中星球','高中星球','大学星球','工作与未来星球'][i], range: ['0–6 岁','7–12 岁','13–15 岁','16–18 岁','19–22 岁','23 岁以后'][i], description: '' }))
export const STAGE_COLORS = ['#e1c48a','#72cdbd','#9689dd','#8fa6d0','#b2a0ea','#d7e9f1']
export const isStageId=id=>STAGE_IDS.includes(id)||(typeof id==='string'&&/^custom-[a-z0-9-]{1,56}$/.test(id))
export function validateStages(value) {
 if(!Array.isArray(value)||value.length<6||value.length>24||new Set(value.map(s=>s?.id)).size!==value.length||!STAGE_IDS.every(id=>value.some(s=>s?.id===id))||!Array.from(value).every(s=>s&&isStageId(s.id)&&['name','range','description'].every(k=>typeof s[k]==='string'&&s[k].length<=({name:40,range:100,description:1000}[k]))&&s.name.trim()))throw Error('阶段信息格式不正确，原信息已保留。')
 return value.map(({id,name,range,description})=>({id,name,range,description}))
}
export const stageOf=entry=>isStageId(entry?.stageId)?entry.stageId:'unclassified'
export const entriesForStage=(entries,id)=>id===null?entries:entries.filter(e=>stageOf(e)===id)
export const stageCounts=(entries,stages=DEFAULT_STAGES)=>Object.fromEntries([...new Set([...stages.map(s=>s.id),...entries.map(stageOf),'unclassified'])].map(id=>[id,entriesForStage(entries,id).length]))
export function stagePosition(index) { return [(index-2.5)*3.8, 1.4-Math.pow(index-2.5,2)*.46, -Math.abs(index-2.5)*.6] }
