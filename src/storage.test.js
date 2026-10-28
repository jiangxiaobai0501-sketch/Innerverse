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
