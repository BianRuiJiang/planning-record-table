import { durationMinutes } from './time'
import type { PlanningEntry } from './types'

type EntryPatch = Partial<Pick<PlanningEntry, 'title' | 'start_time' | 'end_time' | 'duration_min'>>

/**
 * 起止时间齐全时，耗时只认时间差，手填值会被覆盖；
 * 只填了一端（例如导入时只有一个时间点）才保留手填耗时。
 */
export function applyEntryPatch(row: PlanningEntry, patch: EntryPatch): PlanningEntry {
  const next = { ...row, ...patch }
  if (next.start_time && next.end_time) {
    next.duration_min = durationMinutes(next.start_time, next.end_time)
  } else if ('start_time' in patch || 'end_time' in patch) {
    next.duration_min = null
  }
  return next
}

/** 读入历史记录时校正：与起止时间不一致的耗时一律改成时间差。 */
export function withAutoDuration(row: PlanningEntry): PlanningEntry {
  if (!row.start_time || !row.end_time) return row
  const computed = durationMinutes(row.start_time, row.end_time)
  return computed === row.duration_min ? row : { ...row, duration_min: computed }
}
