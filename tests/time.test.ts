import { describe, expect, it } from 'vitest'
import {
  dayRange,
  differenceLabel,
  durationFromTimestamps,
  durationLabel,
  durationMinutes,
  planningDay,
  weekdayLabel,
} from '../src/lib/time'

describe('05:00 周期', () => {
  it('凌晨 04:59 归属前一天', () => {
    expect(planningDay(new Date('2026-11-25T04:59:00+08:00'))).toBe('2026-11-24')
  })

  it('凌晨 05:00 归属当天', () => {
    expect(planningDay(new Date('2026-11-25T05:00:00+08:00'))).toBe('2026-11-25')
  })

  it('周期范围是当日 05:00 到次日 05:00', () => {
    const range = dayRange('2026-11-25')
    expect(range.start.toISOString()).toBe('2026-11-24T21:00:00.000Z')
    expect(range.end.toISOString()).toBe('2026-11-25T21:00:00.000Z')
    expect(weekdayLabel('2026-11-25')).toBe('星期三')
  })
})

describe('耗时计算', () => {
  it('结束早于开始时按跨天处理', () => {
    expect(durationMinutes('23:50', '00:10')).toBe(20)
    expect(durationMinutes('09:00', '10:30')).toBe(90)
  })

  it('时间戳耗时和显示格式正确', () => {
    expect(durationFromTimestamps('2026-11-25T01:00:00Z', '2026-11-25T02:30:00Z')).toBe(90)
    expect(durationLabel(90)).toBe('1时30分')
    expect(durationLabel(20)).toBe('20分')
  })

  it('实际减计划差值带方向', () => {
    expect(differenceLabel(90, 60)).toBe('+30分')
    expect(differenceLabel(60, 90)).toBe('-30分')
    expect(differenceLabel(60, 60)).toBe('持平')
  })
})
