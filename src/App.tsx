import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import AuthForm from './components/AuthForm'
import EntrySection from './components/EntrySection'
import TaskSection from './components/TaskSection'
import {
  deleteEntry,
  deleteTask,
  ensurePlanningDay,
  fetchEntries,
  fetchPeriodActivities,
  fetchTasks,
  insertEntry,
  insertTask,
  updateEntry,
  updatePlanningDay,
  updateTask,
} from './lib/api'
import { supabase, configError } from './lib/supabase'
import {
  dayRange,
  durationFromTimestamps,
  durationMinutes,
  isoMinute,
  planningDay,
  weekdayLabel,
} from './lib/time'
import type {
  EntryKind,
  PlanningDay,
  PlanningEntry,
  PlanningTask,
  SaveStatus,
  Session,
} from './lib/types'

const weatherOptions = ['晴', '多云', '阴', '雨', '雪', '大风', '雾霾']
const moodOptions = ['平静', '专注', '高效', '疲惫', '焦虑', '低落', '开心', '紧张']
const dayPattern = /^\d{4}-\d{2}-\d{2}$/

type TaskPatch = Partial<Pick<PlanningTask, 'title' | 'done'>>
type EntryPatch = Partial<Pick<PlanningEntry, 'title' | 'start_time' | 'end_time' | 'duration_min'>>

function sortRows<T extends { sort_order: number }>(rows: T[]) {
  return [...rows].sort((left, right) => left.sort_order - right.sort_order)
}

function totalMinutes(rows: PlanningEntry[]) {
  const values = rows.map((row) => row.duration_min).filter((value): value is number => value !== null)
  return values.length ? values.reduce((sum, value) => sum + value, 0) : null
}

function message(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

export default function App() {
  const [authReady, setAuthReady] = useState(false)
  const [session, setSession] = useState<Session | null>(null)
  const [selectedDay, setSelectedDay] = useState(() => planningDay())
  const [day, setDay] = useState<PlanningDay | null>(null)
  const [tasks, setTasks] = useState<PlanningTask[]>([])
  const [entries, setEntries] = useState<PlanningEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [importing, setImporting] = useState(false)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [actionError, setActionError] = useState<string | null>(null)

  const requestRef = useRef(0)
  const localIdRef = useRef(-1)
  const dayTimerRef = useRef<number | null>(null)
  const pendingDayPatchRef = useRef<Partial<Pick<PlanningDay, 'weather' | 'mood' | 'reflection'>>>({})
  const taskTimersRef = useRef(new Map<string, number>())
  const entryTimersRef = useRef(new Map<string, number>())
  const pendingSaveRef = useRef(0)
  const manualDurationRef = useRef(new Set<string>())
  const dayRef = useRef<PlanningDay | null>(null)
  const tasksRef = useRef<PlanningTask[]>([])
  const entriesRef = useRef<PlanningEntry[]>([])

  useEffect(() => {
    dayRef.current = day
  }, [day])
  useEffect(() => {
    tasksRef.current = tasks
  }, [tasks])
  useEffect(() => {
    entriesRef.current = entries
  }, [entries])

  useEffect(() => {
    if (configError) {
      setActionError(configError)
      setAuthReady(true)
      return
    }
    let mounted = true
    supabase.auth.getSession()
      .then(({ data }) => {
        if (mounted) setSession(data.session as unknown as Session | null)
      })
      .catch((error) => {
        if (mounted) setActionError(message(error, '登录状态读取失败'))
      })
      .finally(() => {
        if (mounted) setAuthReady(true)
      })
    const listener = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (mounted) setSession(nextSession as unknown as Session | null)
    })
    return () => {
      mounted = false
      listener.data.subscription.unsubscribe()
    }
  }, [])

  const loadDay = useCallback(async () => {
    if (!session) return
    const request = ++requestRef.current
    setLoading(true)
    try {
      const ensured = await ensurePlanningDay(session.user.id, selectedDay)
      if (request !== requestRef.current) return
      const [taskRows, entryRows] = await Promise.all([fetchTasks(ensured.id), fetchEntries(ensured.id)])
      if (request !== requestRef.current) return
      setDay(ensured)
      setTasks(taskRows)
      setEntries(entryRows)
      manualDurationRef.current.clear()
      setSaveStatus('idle')
    } catch (error) {
      if (request === requestRef.current) {
        setActionError(message(error, '读取规划数据失败'))
        setSaveStatus('error')
      }
    } finally {
      if (request === requestRef.current) setLoading(false)
    }
  }, [selectedDay, session])

  useEffect(() => {
    if (session) void loadDay()
    else {
      requestRef.current += 1
      setDay(null)
      setTasks([])
      setEntries([])
      setLoading(false)
      setSaveStatus('idle')
    }
  }, [loadDay, session])

  function beginSave() {
    pendingSaveRef.current += 1
    setSaveStatus('saving')
  }

  function finishSave(error?: unknown, fallback = '保存失败') {
    pendingSaveRef.current = Math.max(0, pendingSaveRef.current - 1)
    if (error) {
      setActionError(message(error, fallback))
      setSaveStatus('error')
    } else if (pendingSaveRef.current === 0) {
      setSaveStatus('saved')
    }
  }

  function changeDay(patch: Partial<Pick<PlanningDay, 'weather' | 'mood' | 'reflection'>>) {
    const current = dayRef.current
    if (!current) return
    // 快速连续修改多个日字段时，800ms 后必须一次提交合并结果，避免只保存最后一个字段。
    pendingDayPatchRef.current = { ...pendingDayPatchRef.current, ...patch }
    const next = { ...current, ...patch }
    setDay(next)
    if (dayTimerRef.current) window.clearTimeout(dayTimerRef.current)
    dayTimerRef.current = window.setTimeout(async () => {
      const savedPatch = pendingDayPatchRef.current
      pendingDayPatchRef.current = {}
      beginSave()
      try {
        await updatePlanningDay(current.id, savedPatch)
        finishSave()
      } catch (error) {
        finishSave(error, '保存日信息失败')
      }
    }, 800)
  }

  function persistTask(id: string) {
    const timers = taskTimersRef.current
    if (timers.has(id)) window.clearTimeout(timers.get(id))
    timers.set(id, window.setTimeout(async () => {
      timers.delete(id)
      const row = tasksRef.current.find((item) => item.id === id)
      if (!row || !row.title.trim()) return
      beginSave()
      try {
        if (row.id.startsWith('-')) {
          const { id: localId, ...payload } = row
          const inserted = await insertTask(session?.user.id ?? '', row.day_id, row.lane, payload.title.trim(), payload.sort_order)
          setTasks((prev) => prev.map((item) => (
            item.id === localId ? { ...inserted, title: item.title, done: item.done } : item
          )))
          finishSave()
        } else {
          await updateTask(row.id, { title: row.title.trim(), done: row.done })
          finishSave()
        }
      } catch (error) {
        finishSave(error, '保存任务失败')
      }
    }, 800))
  }

  function patchTask(id: string, patch: TaskPatch) {
    setTasks((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)))
    persistTask(id)
  }

  function ensureTask(lane: 'main' | 'flex', index: number) {
    const laneTasks = tasksRef.current.filter((item) => item.lane === lane)
    const existing = laneTasks[index]
    if (existing) return existing.id
    if (!day || !session) return ''
    const id = String(localIdRef.current--)
    const nextSort = Math.max(-1, ...laneTasks.map((item) => item.sort_order)) + 1
    const row: PlanningTask = {
      id,
      user_id: session.user.id,
      day_id: day.id,
      lane,
      title: '',
      done: false,
      sort_order: nextSort,
    }
    setTasks((prev) => [...prev, row])
    return id
  }

  async function removeTask(id: string) {
    const timers = taskTimersRef.current
    if (timers.has(id)) {
      window.clearTimeout(timers.get(id))
      timers.delete(id)
    }
    setTasks((prev) => prev.filter((item) => item.id !== id))
    if (id.startsWith('-')) return
    beginSave()
    try {
      await deleteTask(id)
      finishSave()
    } catch (error) {
      finishSave(error, '删除任务失败')
    }
  }

  function persistEntry(id: string) {
    const timers = entryTimersRef.current
    if (timers.has(id)) window.clearTimeout(timers.get(id))
    timers.set(id, window.setTimeout(async () => {
      timers.delete(id)
      const row = entriesRef.current.find((item) => item.id === id)
      if (!row || !row.title.trim()) return
      beginSave()
      try {
        if (row.id.startsWith('-')) {
          const { id: localId, ...payload } = row
          const inserted = await insertEntry(session?.user.id ?? '', {
            ...payload,
            title: payload.title.trim(),
          })
          if (manualDurationRef.current.has(localId)) {
            manualDurationRef.current.delete(localId)
            manualDurationRef.current.add(inserted.id)
          }
          setEntries((prev) => prev.map((item) => (
            item.id === localId
              ? {
                  ...inserted,
                  title: item.title,
                  start_time: item.start_time,
                  end_time: item.end_time,
                  duration_min: item.duration_min,
                }
              : item
          )))
          finishSave()
        } else {
          await updateEntry(row.id, {
            title: row.title.trim(),
            start_time: row.start_time,
            end_time: row.end_time,
            duration_min: row.duration_min,
          })
          finishSave()
        }
      } catch (error) {
        finishSave(error, '保存规划记录失败')
      }
    }, 800))
  }

  function patchEntry(id: string, patch: EntryPatch) {
    setEntries((prev) => prev.map((item) => {
      if (item.id !== id) return item
      const next = { ...item, ...patch }
      if ('duration_min' in patch) {
        if (patch.duration_min === null) manualDurationRef.current.delete(id)
        else manualDurationRef.current.add(id)
      } else if (!manualDurationRef.current.has(id)) {
        if (next.start_time && next.end_time) {
          next.duration_min = durationMinutes(next.start_time, next.end_time)
        } else {
          next.duration_min = null
        }
      }
      return next
    }))
    persistEntry(id)
  }

  function ensureEntry(kind: EntryKind, index: number) {
    const plan = sortRows(entriesRef.current.filter((item) => item.kind === 'plan'))
    const actual = sortRows(entriesRef.current.filter((item) => item.kind === 'actual'))
    const existing = kind === 'plan' ? plan[index] : actual[index]
    if (existing) return existing.id
    if (!day || !session) return ''
    const id = String(localIdRef.current--)
    const row: PlanningEntry = {
      id,
      user_id: session.user.id,
      day_id: day.id,
      kind,
      title: '',
      start_time: null,
      end_time: null,
      duration_min: null,
      sort_order: index,
      source: 'manual',
      source_activity_id: null,
    }
    setEntries((prev) => [...prev, row])
    return id
  }

  function addEntryRow() {
    if (!day || !session) return
    const rowCount = Math.max(
      entriesRef.current.filter((item) => item.kind === 'plan').length,
      entriesRef.current.filter((item) => item.kind === 'actual').length,
    )
    const baseId = localIdRef.current
    localIdRef.current -= 2
    const base: Omit<PlanningEntry, 'id' | 'kind'> = {
      user_id: session.user.id,
      day_id: day.id,
      title: '',
      start_time: null,
      end_time: null,
      duration_min: null,
      sort_order: rowCount,
      source: 'manual',
      source_activity_id: null,
    }
    setEntries((prev) => [
      ...prev,
      { ...base, id: String(baseId), kind: 'plan' as const },
      { ...base, id: String(baseId - 1), kind: 'actual' as const },
    ])
  }

  async function removeEntry(kind: EntryKind, id: string, index: number) {
    const row = sortRows(entriesRef.current.filter((item) => item.kind === kind))[index]
    if (!row || row.id !== id) return
    const timers = entryTimersRef.current
    if (timers.has(id)) {
      window.clearTimeout(timers.get(id))
      timers.delete(id)
    }
    setEntries((prev) => prev.filter((item) => item.id !== id))
    if (id.startsWith('-')) return
    beginSave()
    try {
      await deleteEntry(id)
      finishSave()
    } catch (error) {
      finishSave(error, '删除规划记录失败')
    }
  }

  async function importActual() {
    if (!day || !session || importing) return
    setImporting(true)
    setActionError(null)
    const { start, end } = dayRange(day.day)
    try {
      const activities = await fetchPeriodActivities(start, end)
      const importedIds = new Set(entriesRef.current
        .map((item) => item.source_activity_id)
        .filter((value): value is string => value !== null))
      const nextSort = Math.max(-1, ...entriesRef.current.map((item) => item.sort_order)) + 1
      const imported: PlanningEntry[] = []
      let sortOrder = nextSort
      for (const activity of activities) {
        if (importedIds.has(activity.id)) continue
        const inserted = await insertEntry(session.user.id, {
          day_id: day.id,
          kind: 'actual',
          title: activity.name,
          start_time: isoMinute(new Date(activity.started_at)),
          end_time: activity.ended_at ? isoMinute(new Date(activity.ended_at)) : null,
          duration_min: activity.ended_at ? durationFromTimestamps(activity.started_at, activity.ended_at) : null,
          sort_order: sortOrder,
          source: 'imported',
          source_activity_id: activity.id,
        })
        imported.push(inserted)
        importedIds.add(activity.id)
        sortOrder += 1
      }
      if (imported.length) {
        imported.forEach((item) => manualDurationRef.current.add(item.id))
        setEntries((prev) => [...prev, ...imported])
      }
      setSaveStatus('saved')
    } catch (error) {
      setActionError(message(error, '导入时间追踪记录失败'))
      setSaveStatus('error')
    } finally {
      setImporting(false)
    }
  }

  const planRows = useMemo(
    () => sortRows(entries.filter((item) => item.kind === 'plan')),
    [entries],
  )
  const actualRows = useMemo(
    () => sortRows(entries.filter((item) => item.kind === 'actual')),
    [entries],
  )
  const planTotal = useMemo(() => totalMinutes(planRows), [planRows])
  const actualTotal = useMemo(() => totalMinutes(actualRows), [actualRows])
  const mainTasks = useMemo(() => tasks.filter((item) => item.lane === 'main'), [tasks])
  const flexTasks = useMemo(() => tasks.filter((item) => item.lane === 'flex'), [tasks])

  if (!authReady) return <main className="shell"><div className="card status-card">正在检查登录...</div></main>
  if (configError) {
    return (
      <main className="shell">
        <div className="card status-card">
          <h1>配置不完整</h1>
          <p className="error-text">{configError}</p>
        </div>
      </main>
    )
  }
  if (!session) return <AuthForm />
  if (loading && !day) return <main className="shell"><div className="card status-card">正在加载规划数据...</div></main>

  const statusText = saveStatus === 'saving' ? '保存中' : saveStatus === 'saved' ? '已保存' : saveStatus === 'error' ? '保存失败' : '自动保存'

  return (
    <main className="shell">
      {actionError && (
        <div className="error-banner" role="alert">
          <span>{actionError}</span>
          <button type="button" onClick={() => setActionError(null)}>关闭</button>
        </div>
      )}
      <section className="module-card" aria-labelledby="day-title">
        <div className="module-head">
          <div>
            <h1 id="day-title">周期 {selectedDay}</h1>
            <p className="section-hint">{weekdayLabel(selectedDay)} · 05:00 至次日 05:00</p>
          </div>
          <div className="top-actions">
            <span className={`save-status ${saveStatus}`}>{statusText}</span>
            <button className="ghost-button" type="button" onClick={() => void supabase.auth.signOut()}>退出</button>
          </div>
        </div>
        <div className="day-fields">
          <label>
            <span>日期</span>
            <input
              type="date"
              value={selectedDay}
              onChange={(event) => {
                if (dayPattern.test(event.target.value)) setSelectedDay(event.target.value)
              }}
            />
          </label>
          <label>
            <span>星期</span>
            <input value={weekdayLabel(selectedDay)} readOnly />
          </label>
          <label>
            <span>天气</span>
            <input
              list="weather-options"
              value={day?.weather ?? ''}
              placeholder="晴 / 雨 / 自定义"
              onChange={(event) => changeDay({ weather: event.target.value })}
            />
          </label>
          <label>
            <span>心态</span>
            <input
              list="mood-options"
              value={day?.mood ?? ''}
              placeholder="平静 / 专注 / 自定义"
              onChange={(event) => changeDay({ mood: event.target.value })}
            />
          </label>
        </div>
        <datalist id="weather-options">{weatherOptions.map((item) => <option key={item} value={item} />)}</datalist>
        <datalist id="mood-options">{moodOptions.map((item) => <option key={item} value={item} />)}</datalist>
      </section>

      <section className="module-card" aria-labelledby="tasks-title">
        <div className="module-head">
          <h2 id="tasks-title">今日任务</h2>
        </div>
        <div className="two-columns">
          <TaskSection
            title="主线任务"
            lane="main"
            tasks={mainTasks}
            startIndex={0}
            onUpdate={patchTask}
            onDelete={(id) => void removeTask(id)}
            onEnsure={(index) => ensureTask('main', index)}
          />
          <TaskSection
            title="弹性任务"
            lane="flex"
            tasks={flexTasks}
            startIndex={mainTasks.length}
            onUpdate={patchTask}
            onDelete={(id) => void removeTask(id)}
            onEnsure={(index) => ensureTask('flex', index)}
          />
        </div>
      </section>

      <EntrySection
        planRows={planRows}
        actualRows={actualRows}
        planTotal={planTotal}
        actualTotal={actualTotal}
        importing={importing}
        onAddRow={addEntryRow}
        onImport={() => void importActual()}
        onFocusSide={ensureEntry}
        onChange={patchEntry}
        onDelete={(kind, id, index) => void removeEntry(kind, id, index)}
      />

      <section className="module-card" aria-labelledby="reflection-title">
        <div className="module-head">
          <h2 id="reflection-title">
            反思
            <span>（今天做了什么、没做什么、有什么收获、如何改进等等）</span>
          </h2>
        </div>
        <textarea
          value={day?.reflection ?? ''}
          placeholder="今天最有价值的是什么？计划偏差在哪？明天怎么调整？"
          onChange={(event) => changeDay({ reflection: event.target.value })}
        />
      </section>
    </main>
  )
}
