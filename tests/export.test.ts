import { describe, expect, it } from 'vitest'
import {
  buildAllMarkdown,
  buildDayMarkdown,
  clockText,
  markdownFileName,
  totalMinutes,
  type DayArchiveData,
} from '../src/lib/export'
import { markExported, readExportMarks } from '../src/lib/export-marks'
import { saveExportFiles } from '../src/lib/export-directory'
import type { PlanningEntry, PlanningTask } from '../src/lib/types'

const at = new Date('2026-11-26T02:05:00Z') // 北京时间 10:05

function task(id: string, lane: 'main' | 'flex', title: string, done = false, sort = 0): PlanningTask {
  return { id, user_id: 'u1', day_id: 'd1', lane, title, done, sort_order: sort }
}

function entry(id: string, kind: 'plan' | 'actual', title: string, start: string | null, end: string | null, duration: number | null, sort = 0): PlanningEntry {
  return {
    id,
    user_id: 'u1',
    day_id: 'd1',
    kind,
    title,
    start_time: start,
    end_time: end,
    duration_min: duration,
    sort_order: sort,
    source: 'manual',
    source_activity_id: null,
  }
}

const archive: DayArchiveData = {
  day: '2026-11-26',
  weather: '晴',
  mood: '专注',
  reflection: '上午效率高，下午被打断。',
  main: [task('t1', 'main', '视觉重构', true, 0), task('t2', 'main', '整理笔记', false, 1)],
  flex: [task('t3', 'flex', '回复邮件', false, 0)],
  plan: [entry('e1', 'plan', '视觉重构', '09:00:00', '11:00:00', 120, 0)],
  actual: [entry('e2', 'actual', '视觉重构', '09:10:00', '11:20:00', 130, 0)],
}

describe('导出内容', () => {
  it('文件名按日期生成', () => {
    expect(markdownFileName('2026-11-26')).toBe('planning-records-2026-11-26.md')
  })

  it('时间列只保留到分钟', () => {
    expect(clockText('09:05:00')).toBe('09:05')
    expect(clockText('09:05')).toBe('09:05')
    expect(clockText(null)).toBe('')
  })

  it('合计只统计有耗时的行', () => {
    expect(totalMinutes([entry('a', 'plan', 'x', null, null, 30), entry('b', 'plan', 'y', null, null, null)])).toBe(30)
    expect(totalMinutes([])).toBeNull()
  })

  it('单日 Markdown 含任务、对称记录与合计', () => {
    const md = buildDayMarkdown(archive, at)
    expect(md).toContain('# 规划记录 · 2026-11-26（星期四）')
    expect(md).toContain('- 导出时间：2026-11-26 10:05（Asia/Shanghai）')
    expect(md).toContain('- [x] 视觉重构')
    expect(md).toContain('- [ ] 整理笔记')
    expect(md).toContain('| 1 | 视觉重构 | 09:00 | 11:00 | 2时00分 |')
    expect(md).toContain('| 1 | 视觉重构 | 09:10 | 11:20 | 2时10分 |')
    expect(md).toContain('计划合计：2时00分')
    expect(md).toContain('实际合计：2时10分')
    expect(md).toContain('差值：+10分')
    expect(md).toContain('共 3 项，完成 1 项')
    expect(md).toContain('上午效率高，下午被打断。')
  })

  it('空数据也给出明确占位', () => {
    const empty: DayArchiveData = {
      day: '2026-11-20', weather: null, mood: null, reflection: '',
      main: [], flex: [], plan: [], actual: [],
    }
    const md = buildDayMarkdown(empty, at)
    expect(md).toContain('（无）')
    expect(md).toContain('（未填写）')
    expect(md).toContain('差值：--')
  })

  it('表格单元里的竖线和换行被转义', () => {
    const tricky: DayArchiveData = {
      ...archive,
      plan: [entry('e9', 'plan', 'a|b\nc', '09:00:00', '10:00:00', 60)],
    }
    const md = buildDayMarkdown(tricky, at)
    expect(md).toContain('| 1 | a\\|b<br>c |')
  })

  it('合并导出包含表头与全部日期', () => {
    const second: DayArchiveData = { ...archive, day: '2026-11-27', reflection: null }
    const md = buildAllMarkdown([archive, second], at)
    expect(md).toContain('# 规划记录导出')
    expect(md).toContain('- 覆盖日期：2 天')
    expect(md).toContain('- 起止：2026-11-26 至 2026-11-27')
    expect(md).toContain('# 规划记录 · 2026-11-27')
  })
})

describe('导出记录标记', () => {
  it('写入后能读回，未知用户返回空对象', () => {
    const marks = markExported('user-a', ['2026-11-26', '2026-11-27'], ['a.md', 'b.md'])
    expect(marks['2026-11-26'].fileName).toBe('a.md')
    expect(readExportMarks('user-a')['2026-11-27'].fileName).toBe('b.md')
    expect(readExportMarks('user-unknown')).toEqual({})
  })

  it('损坏的本地数据不抛异常', () => {
    localStorage.setItem('planning-exported:user-b', '{not json')
    expect(readExportMarks('user-b')).toEqual({})
  })
})

describe('导出目录', () => {
  it('浏览器不支持目录选择时回退为普通下载', async () => {
    expect('showDirectoryPicker' in window).toBe(false)
    await expect(saveExportFiles([{ name: 'a.md', content: 'x' }])).resolves.toEqual({ mode: 'download' })
  })
})
