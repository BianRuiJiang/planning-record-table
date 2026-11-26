import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  fetchAllPlanningDays,
  fetchAllPlanningEntries,
  fetchAllPlanningTasks,
} from '../lib/api'
import {
  buildAllMarkdown,
  buildDayMarkdown,
  downloadText,
  markdownFileName,
  totalMinutes,
  type DayArchiveData,
} from '../lib/export'
import { markExported, readExportMarks, type ExportMarks } from '../lib/export-marks'
import { saveExportFiles, supportsDirectoryExport } from '../lib/export-directory'
import { beijingDate, differenceLabel, durationLabel, planningDay, shiftDate, weekdayLabel } from '../lib/time'
import type { PlanningEntry, PlanningTask } from '../lib/types'

const WEEK_LABELS = ['一', '二', '三', '四', '五', '六', '日']

function pad(value: number) {
  return String(value).padStart(2, '0')
}

function dayNumber(dayText: string) {
  return Number(dayText.slice(8, 10))
}

function monthLabel(cursor: { year: number; month: number }) {
  return `${cursor.year}年${pad(cursor.month)}月`
}

function shiftMonth(cursor: { year: number; month: number }, delta: number) {
  const next = new Date(Date.UTC(cursor.year, cursor.month - 1 + delta, 1))
  return { year: next.getUTCFullYear(), month: next.getUTCMonth() + 1 }
}

function calendarDays(cursor: { year: number; month: number }) {
  const firstDay = `${cursor.year}-${pad(cursor.month)}-01`
  const weekday = (new Date(`${firstDay}T00:00:00Z`).getUTCDay() + 6) % 7
  const start = shiftDate(firstDay, -weekday)
  return Array.from({ length: 42 }, (_, index) => shiftDate(start, index))
}

function sortByOrder<T extends { sort_order: number }>(rows: T[]) {
  return [...rows].sort((left, right) => left.sort_order - right.sort_order)
}

export function hasContent(archive: DayArchiveData) {
  return (
    archive.main.length + archive.flex.length + archive.plan.length + archive.actual.length > 0 ||
    Boolean(archive.reflection?.trim())
  )
}

interface Props {
  userId: string
  onClose: () => void
  onError: (message: string) => void
  onToast: (message: string) => void
}

export default function DatabaseOverlay({ userId, onClose, onError, onToast }: Props) {
  const [archives, setArchives] = useState<DayArchiveData[]>([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState<string | null>(null)
  const [marks, setMarks] = useState<ExportMarks>(() => readExportMarks(userId))
  const [selectedDay, setSelectedDay] = useState(() => planningDay())
  const [monthCursor, setMonthCursor] = useState(() => {
    const today = beijingDate()
    return { year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) }
  })

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [days, tasks, entries] = await Promise.all([
        fetchAllPlanningDays(),
        fetchAllPlanningTasks(),
        fetchAllPlanningEntries(),
      ])

      const tasksByDay = new Map<string, PlanningTask[]>()
      for (const task of tasks) {
        const rows = tasksByDay.get(task.day_id) ?? []
        rows.push(task)
        tasksByDay.set(task.day_id, rows)
      }

      const entriesByDay = new Map<string, PlanningEntry[]>()
      for (const entry of entries) {
        const rows = entriesByDay.get(entry.day_id) ?? []
        rows.push(entry)
        entriesByDay.set(entry.day_id, rows)
      }

      const next: DayArchiveData[] = days.map((day) => {
        const dayTasks = tasksByDay.get(day.id) ?? []
        const dayEntries = entriesByDay.get(day.id) ?? []
        return {
          day: day.day,
          weather: day.weather,
          mood: day.mood,
          reflection: day.reflection,
          main: sortByOrder(dayTasks.filter((task) => task.lane === 'main')),
          flex: sortByOrder(dayTasks.filter((task) => task.lane === 'flex')),
          plan: sortByOrder(dayEntries.filter((entry) => entry.kind === 'plan')),
          actual: sortByOrder(dayEntries.filter((entry) => entry.kind === 'actual')),
        }
      })

      setArchives(next.sort((left, right) => left.day.localeCompare(right.day)))
    } catch (error) {
      onError(error instanceof Error ? error.message : '数据库记录读取失败')
    } finally {
      setLoading(false)
    }
  }, [onError])

  useEffect(() => {
    void loadData()
  }, [loadData])

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose])

  const byDay = useMemo(() => new Map(archives.map((item) => [item.day, item])), [archives])

  const withContent = useMemo(() => archives.filter(hasContent), [archives])
  const entryCount = useMemo(
    () => archives.reduce((sum, item) => sum + item.main.length + item.flex.length + item.plan.length + item.actual.length, 0),
    [archives],
  )
  const pendingCount = useMemo(
    () => withContent.filter((item) => !marks[item.day]).length,
    [marks, withContent],
  )

  const days = useMemo(() => calendarDays(monthCursor), [monthCursor])
  const today = planningDay()
  const selected = byDay.get(selectedDay)

  function goToday() {
    const current = planningDay()
    setSelectedDay(current)
    setMonthCursor({ year: Number(current.slice(0, 4)), month: Number(current.slice(5, 7)) })
  }

  function tone(day: string) {
    if (day > today) return 'future'
    const archive = byDay.get(day)
    if (!archive || !hasContent(archive)) return 'empty'
    return marks[day] ? 'exported' : 'pending'
  }

  function applyMarks(targets: DayArchiveData[], files: string[]) {
    setMarks(markExported(userId, targets.map((item) => item.day), files))
  }

  async function downloadDay(archive: DayArchiveData) {
    if (exporting) return
    setExporting(archive.day)
    const file = { name: markdownFileName(archive.day), content: buildDayMarkdown(archive) }
    try {
      const result = await saveExportFiles([file])
      if (result.mode === 'download') {
        downloadText(file.content, file.name)
        onToast(`浏览器不支持固定目录，已下载 ${file.name}`)
      } else {
        onToast(`已保存到「${result.directory}」/ ${file.name}`)
      }
      applyMarks([archive], [file.name])
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        onError('已取消目录选择，本次未导出')
      } else {
        onError(error instanceof Error ? error.message : '导出失败，请重试')
      }
    } finally {
      setExporting(null)
    }
  }

  async function downloadAll() {
    if (exporting || withContent.length === 0) return
    setExporting('all')
    try {
      if (supportsDirectoryExport()) {
        const files = withContent.map((item) => ({
          name: markdownFileName(item.day),
          content: buildDayMarkdown(item),
        }))
        const result = await saveExportFiles(files)
        if (result.mode === 'directory') {
          onToast(`已保存 ${files.length} 个文件到「${result.directory}」`)
        } else {
          const combined = { name: `planning-records-all-${beijingDate()}.md`, content: buildAllMarkdown(withContent) }
          downloadText(combined.content, combined.name)
          onToast(`已下载合并文件 ${combined.name}`)
        }
        applyMarks(withContent, files.map((file) => file.name))
      } else {
        const combined = { name: `planning-records-all-${beijingDate()}.md`, content: buildAllMarkdown(withContent) }
        downloadText(combined.content, combined.name)
        onToast(`浏览器不支持固定目录，已下载合并文件 ${combined.name}`)
        applyMarks(withContent, withContent.map((item) => markdownFileName(item.day)))
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        onError('已取消目录选择，本次未导出')
      } else {
        onError(error instanceof Error ? error.message : '全部导出失败，请重试')
      }
    } finally {
      setExporting(null)
    }
  }

  const selectedTasks = selected ? [...selected.main, ...selected.flex] : []
  const selectedDone = selectedTasks.filter((task) => task.done).length
  const selectedPlanTotal = selected ? totalMinutes(selected.plan) : null
  const selectedActualTotal = selected ? totalMinutes(selected.actual) : null

  function entryList(rows: PlanningEntry[]) {
    if (rows.length === 0) return <p className="archive-empty">（无）</p>
    return (
      <ul className="archive-entries">
        {rows.map((row) => (
          <li key={row.id}>
            <span className="archive-entry-time">
              {row.start_time?.slice(0, 5) || '--:--'}–{row.end_time?.slice(0, 5) || '--:--'}
            </span>
            <span className="archive-entry-duration">{row.duration_min === null ? '--' : durationLabel(row.duration_min)}</span>
            <span className="archive-entry-title">{row.title}</span>
          </li>
        ))}
      </ul>
    )
  }

  return (
    <div className="archive-overlay" role="dialog" aria-modal="true" aria-label="数据库">
      <section className="archive-panel">
        <header className="archive-header">
          <div className="archive-title">
            <p className="eyebrow">数据库</p>
            <h2>全部规划记录</h2>
          </div>
          <div className="archive-summary">
            <span>{withContent.length} 天有记录</span>
            <span>{entryCount} 条条目</span>
            {pendingCount > 0 && <strong>{pendingCount} 天未导出</strong>}
          </div>
          <div className="archive-actions">
            <button
              className="ghost-button archive-export-all"
              type="button"
              onClick={() => void downloadAll()}
              disabled={exporting !== null || withContent.length === 0}
            >
              {exporting === 'all' ? '导出中…' : '全部导出'}
            </button>
            <button className="archive-close" type="button" onClick={onClose} aria-label="关闭数据库">×</button>
          </div>
        </header>

        {loading ? (
          <p className="archive-loading">正在读取数据库…</p>
        ) : (
          <div className="archive-layout">
            <aside className="archive-calendar">
              <div className="month-nav">
                <div className="month-arrows">
                  <button type="button" onClick={() => setMonthCursor(shiftMonth(monthCursor, -1))} aria-label="上一月">‹</button>
                  <strong>{monthLabel(monthCursor)}</strong>
                  <button type="button" onClick={() => setMonthCursor(shiftMonth(monthCursor, 1))} aria-label="下一月">›</button>
                </div>
                <button type="button" className="today-button" onClick={goToday}>今天</button>
              </div>
              <div className="calendar-week">
                {WEEK_LABELS.map((label) => <span key={label}>{label}</span>)}
              </div>
              <div className="calendar-grid">
                {days.map((day) => {
                  const state = tone(day)
                  const archive = byDay.get(day)
                  const count = archive ? archive.main.length + archive.flex.length + archive.plan.length + archive.actual.length : 0
                  return (
                    <button
                      key={day}
                      type="button"
                      className={[
                        'calendar-day',
                        day.startsWith(`${monthCursor.year}-${pad(monthCursor.month)}`) ? '' : 'outside',
                        day === selectedDay ? 'selected' : '',
                        state,
                      ].filter(Boolean).join(' ')}
                      disabled={state === 'future'}
                      onClick={() => setSelectedDay(day)}
                      aria-label={`${day}${state === 'future' ? '，未来日期' : ''}`}
                    >
                      <span className="calendar-number">{dayNumber(day)}</span>
                      {count > 0 && <small>{count}</small>}
                      {state === 'exported' && <i className="calendar-mark" aria-hidden="true">✓</i>}
                    </button>
                  )
                })}
              </div>
              <div className="calendar-legend">
                <span className="legend-exported">已导出</span>
                <span className="legend-pending">待导出</span>
                <span className="legend-empty">无内容</span>
              </div>
              <p className="archive-tip">
                导出会写入「时间开销」文件夹，与时间追踪项目的导出位置相同。
                {!supportsDirectoryExport() && ' 当前浏览器不支持固定目录，将改为普通下载。'}
              </p>
            </aside>

            <section className="archive-detail">
              <header className="archive-detail-head">
                <div>
                  <h3>{selectedDay}<span>{weekdayLabel(selectedDay)}</span></h3>
                  <p className="section-hint">
                    {selected ? `${selectedTasks.length} 项任务 · 完成 ${selectedDone} 项` : '这一天还没有记录'}
                    {marks[selectedDay] && selected && <span className="archive-exported-note">已导出</span>}
                  </p>
                </div>
                <button
                  className="primary-button"
                  type="button"
                  disabled={!selected || !hasContent(selected) || exporting !== null}
                  onClick={() => selected && void downloadDay(selected)}
                >
                  {exporting === selectedDay ? '导出中…' : '下载'}
                </button>
              </header>

              {!selected || !hasContent(selected) ? (
                <p className="archive-empty">这一天没有内容。</p>
              ) : (
                <div className="archive-body">
                  <div className="archive-meta">
                    <span><i>天气</i>{selected.weather?.trim() || '—'}</span>
                    <span><i>心态</i>{selected.mood?.trim() || '—'}</span>
                    <span><i>计划</i>{durationLabel(selectedPlanTotal)}</span>
                    <span><i>实际</i>{durationLabel(selectedActualTotal)}</span>
                    <span><i>差值</i>{
                      selectedPlanTotal === null && selectedActualTotal === null
                        ? '--'
                        : differenceLabel(selectedActualTotal ?? 0, selectedPlanTotal ?? 0)
                    }</span>
                  </div>

                  <div className="archive-tasks">
                    <div>
                      <h4>主线任务</h4>
                      {selected.main.length === 0
                        ? <p className="archive-empty">（无）</p>
                        : selected.main.map((task) => (
                          <p key={task.id} className={task.done ? 'archive-task done' : 'archive-task'}>
                            <i aria-hidden="true">{task.done ? '✓' : '○'}</i>{task.title}
                          </p>
                        ))}
                    </div>
                    <div>
                      <h4>弹性任务</h4>
                      {selected.flex.length === 0
                        ? <p className="archive-empty">（无）</p>
                        : selected.flex.map((task) => (
                          <p key={task.id} className={task.done ? 'archive-task done' : 'archive-task'}>
                            <i aria-hidden="true">{task.done ? '✓' : '○'}</i>{task.title}
                          </p>
                        ))}
                    </div>
                  </div>

                  <div className="archive-columns">
                    <div>
                      <h4>计划完成</h4>
                      {entryList(selected.plan)}
                    </div>
                    <div>
                      <h4>实际完成</h4>
                      {entryList(selected.actual)}
                    </div>
                  </div>

                  <div className="archive-reflection">
                    <h4>反思</h4>
                    <p>{selected.reflection?.trim() || '（未填写）'}</p>
                  </div>
                </div>
              )}
            </section>
          </div>
        )}
      </section>
    </div>
  )
}
