export const VISUAL_SETTINGS_KEY = 'xinyu.universe.v1'
export const DEFAULT_VISUAL_SETTINGS = Object.freeze({ quality: 'standard', motion: 'full' })
export function normalizeVisualSettings(value) {
  return { quality: ['low','high'].includes(value?.quality) ? value.quality : 'standard', motion: ['full', 'reduced', 'off'].includes(value?.motion) ? value.motion : 'full' }
}
export function readVisualSettings(storage) {
  try { return normalizeVisualSettings(JSON.parse(storage.getItem(VISUAL_SETTINGS_KEY))) } catch { return { ...DEFAULT_VISUAL_SETTINGS } }
}
export function saveVisualSettings(storage, value) {
  try { storage.setItem(VISUAL_SETTINGS_KEY, JSON.stringify(normalizeVisualSettings(value))); return true } catch { return false }
}
