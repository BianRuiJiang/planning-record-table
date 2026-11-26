import { beijingStamp, differenceLabel, durationLabel, weekdayLabel } from './time'
import type { PlanningEntry, PlanningTask } from './types'

export interface ExportFile {
  name: string
  content: string
}

export interface DayArchiveData {
  day: string
  weather: string | null
  mood: string | null
  reflection: string | null
  main: PlanningTask[]
  flex: PlanningTask[]
  plan: PlanningEntry[]
  actual: PlanningEntry[]
}

function cell(value: string | number | null | undefined) {
  return String(value ?? '')
    .replace(/\r\n|\r|\n/g, '<br>')
    .replace(/\|/g, '\\|')
}

// PostgreSQL 的 time 列返回 HH:MM:SS，导出只保留到分钟。
export function clockText(value: string | null) {
  if (!value) return ''
  return value.slice(0, 5)
}

export function totalMinutes(rows: PlanningEntry[]) {
  const values = rows
    .map((row) => row.duration_min)
    .filter((value): value is number => typeof value === 'number')
  return values.length ? values.reduce((sum, value) => sum + value, 0) : null
}

export function markdownFileName(day: string) {
  return `planning-records-${day}.md`
}

function entryTable(rows: PlanningEntry[]) {
  if (rows.length === 0) return ['（无）']
  const lines = [
    '| # | 事件 | 开始 | 结束 | 耗时 |',
    '| --- | --- | --- | --- | --- |',
  ]
  rows.forEach((row, index) => {
    lines.push(`| ${index + 1} | ${cell(row.title)} | ${clockText(row.start_time)} | ${clockText(row.end_time)} | ${row.duration_min === null ? '' : durationLabel(row.duration_min)} |`)
  })
  return lines
}

function taskLines(tasks: PlanningTask[]) {
  if (tasks.length === 0) return ['（无）']
  return tasks.map((task) => `- [${task.done ? 'x' : ' '}] ${cell(task.title)}`)
}

export function buildDayMarkdown(data: DayArchiveData, exportedAt = new Date()) {
  const planTotal = totalMinutes(data.plan)
  const actualTotal = totalMinutes(data.actual)
  const doneCount = [...data.main, ...data.flex].filter((task) => task.done).length
  const taskCount = data.main.length + data.flex.length

  const lines = [
    `# 规划记录 · ${data.day}（${weekdayLabel(data.day)}）`,
    '',
    `- 导出时间：${beijingStamp(exportedAt)}（Asia/Shanghai）`,
    '- 日期周期：05:00 至次日 05:00',
    `- 天气：${data.weather?.trim() || '—'}`,
    `- 心态：${data.mood?.trim() || '—'}`,
    '',
    '## 今日任务',
    '',
    '### 主线任务',
    ...taskLines(data.main),
    '',
    '### 弹性任务',
    ...taskLines(data.flex),
    '',
    `> 共 ${taskCount} 项，完成 ${doneCount} 项`,
    '',
    '## 规划记录',
    '',
    '### 计划完成',
    '',
    ...entryTable(data.plan),
    '',
    '### 实际完成',
    '',
    ...entryTable(data.actual),
    '',
    `> 计划合计：${durationLabel(planTotal)}　实际合计：${durationLabel(actualTotal)}　差值：${
      planTotal === null && actualTotal === null
        ? '--'
        : differenceLabel(actualTotal ?? 0, planTotal ?? 0)
    }`,
    '',
    '## 反思',
    '',
    data.reflection?.trim() ? data.reflection.trim() : '（未填写）',
    '',
  ]
  return lines.join('\n')
}

export function buildAllMarkdown(archives: DayArchiveData[], exportedAt = new Date()) {
  const head = [
    '# 规划记录导出',
    '',
    `- 导出时间：${beijingStamp(exportedAt)}（Asia/Shanghai）`,
    `- 覆盖日期：${archives.length} 天`,
    ...(archives.length ? [`- 起止：${archives[0].day} 至 ${archives[archives.length - 1].day}`] : []),
    '',
  ]
  const body = archives.map((item) => buildDayMarkdown(item, exportedAt))
  return [...head, ...body].join('\n---\n\n')
}

// 目录不可用（Safari / Firefox）时的兜底：走浏览器默认下载位置。
export function downloadText(content: string, filename: string, type = 'text/markdown;charset=utf-8') {
  const blob = new Blob([content], { type })
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = filename
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  link.remove()
  // 部分浏览器点击后仍会异步读取 URL，立即释放会导致下载失败。
  window.setTimeout(() => URL.revokeObjectURL(link.href), 1000)
}
