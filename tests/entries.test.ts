import { describe, expect, it } from 'vitest'
import { applyEntryPatch, withAutoDuration } from '../src/lib/entries'
import type { PlanningEntry } from '../src/lib/types'

function row(overrides: Partial<PlanningEntry> = {}): PlanningEntry {
  return {
    id: 'e1',
    user_id: 'u1',
    day_id: 'd1',
    kind: 'plan',
    title: '写周报',
    start_time: null,
    end_time: null,
    duration_min: null,
    sort_order: 0,
    source: 'manual',
    source_activity_id: null,
    ...overrides,
  }
}

describe('耗时自动计算', () => {
  it('先填开始再填结束，耗时立刻按时间差算出', () => {
    const started = applyEntryPatch(row(), { start_time: '09:00' })
    expect(started.duration_min).toBeNull()
    const ended = applyEntryPatch(started, { end_time: '11:30' })
    expect(ended.duration_min).toBe(150)
  })

  it('改开始时间会重算，不会被之前的手填值挡住', () => {
    const filled = row({ start_time: '09:00', end_time: '11:00', duration_min: 999 })
    expect(applyEntryPatch(filled, { start_time: '08:00' }).duration_min).toBe(180)
  })

  it('改结束时间会重算', () => {
    const filled = row({ start_time: '09:00', end_time: '11:00', duration_min: 120 })
    expect(applyEntryPatch(filled, { end_time: '10:15' }).duration_min).toBe(75)
  })

  it('跨过午夜按次日计算', () => {
    const filled = row({ start_time: '23:30', end_time: '01:00' })
    expect(applyEntryPatch(filled, { title: '夜读' }).duration_min).toBe(90)
  })

  it('清掉一端时间后耗时清空，不再沿用旧值', () => {
    const filled = row({ start_time: '09:00', end_time: '11:00', duration_min: 120 })
    expect(applyEntryPatch(filled, { end_time: '' }).duration_min).toBeNull()
  })

  it('只有一个时间点时保留手填耗时', () => {
    const single = row({ start_time: '09:00', duration_min: 45 })
    expect(applyEntryPatch(single, { title: '碎片时间' }).duration_min).toBe(45)
  })

  it('只改标题不会碰耗时', () => {
    const filled = row({ start_time: '09:00', end_time: '11:00', duration_min: 120 })
    expect(applyEntryPatch(filled, { title: '改个名字' }).duration_min).toBe(120)
  })
})

describe('历史耗时校正', () => {
  it('与起止时间不一致的耗时被改成时间差', () => {
    expect(withAutoDuration(row({ start_time: '09:00', end_time: '11:00', duration_min: 30 })).duration_min).toBe(120)
  })

  it('本来就一致时不产生新对象', () => {
    const original = row({ start_time: '09:00', end_time: '11:00', duration_min: 120 })
    expect(withAutoDuration(original)).toBe(original)
  })

  it('缺少结束时间时不猜测耗时', () => {
    const single = row({ start_time: '09:00', duration_min: 45 })
    expect(withAutoDuration(single)).toBe(single)
  })
})
