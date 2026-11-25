import { differenceLabel, durationLabel } from '../lib/time'
import type { PlanningEntry } from '../lib/types'

interface Props {
  planRows: PlanningEntry[]
  actualRows: PlanningEntry[]
  planTotal: number | null
  actualTotal: number | null
  importing: boolean
  onAddRow: () => void
  onImport: () => void
  onFocusSide: (kind: 'plan' | 'actual', index: number) => string
  onChange: (
    id: string,
    patch: Partial<Pick<PlanningEntry, 'title' | 'start_time' | 'end_time' | 'duration_min'>>,
  ) => void
  onDelete: (kind: 'plan' | 'actual', id: string, index: number) => void
}

export default function EntrySection({
  planRows,
  actualRows,
  planTotal,
  actualTotal,
  importing,
  onAddRow,
  onImport,
  onFocusSide,
  onChange,
  onDelete,
}: Props) {
  const rowCount = Math.max(planRows.length, actualRows.length)

  function sideRows(kind: 'plan' | 'actual') {
    return kind === 'plan' ? planRows : actualRows
  }

  function controls(kind: 'plan' | 'actual', index: number) {
    const row = sideRows(kind)[index]
    const values = row ?? { title: '', start_time: '', end_time: '', duration_min: null }
    return (
      <div className={`entry-controls${row?.source === 'imported' ? ' imported' : ''}`}>
        <input
          type="time"
          className="time-input"
          value={values.start_time ?? ''}
          aria-label={`${kind === 'plan' ? '计划' : '实际'}开始时间`}
          onFocus={() => onFocusSide(kind, index)}
          onChange={(event) => {
            const id = row?.id ?? onFocusSide(kind, index)
            onChange(id, { start_time: event.target.value })
          }}
        />
        <input
          type="time"
          className="time-input"
          value={values.end_time ?? ''}
          aria-label={`${kind === 'plan' ? '计划' : '实际'}结束时间`}
          onFocus={() => onFocusSide(kind, index)}
          onChange={(event) => {
            const id = row?.id ?? onFocusSide(kind, index)
            onChange(id, { end_time: event.target.value })
          }}
        />
        <span className="duration-cell">
          <input
            type="number"
            min={0}
            placeholder="--"
            value={values.duration_min ?? ''}
            aria-label={`${kind === 'plan' ? '计划' : '实际'}耗时分钟`}
            onFocus={() => onFocusSide(kind, index)}
            onChange={(event) => {
              const raw = event.target.value
              const id = row?.id ?? onFocusSide(kind, index)
              onChange(id, { duration_min: raw === '' ? null : Math.max(0, Number(raw)) })
            }}
          />
          <span aria-hidden="true">分</span>
        </span>
        <input
          className="entry-title"
          value={values.title}
          placeholder="事情"
          onFocus={() => onFocusSide(kind, index)}
          onChange={(event) => {
            const id = row?.id ?? onFocusSide(kind, index)
            onChange(id, { title: event.target.value })
          }}
        />
        <button
          className={row ? 'danger-icon' : 'danger-icon invisible'}
          type="button"
          tabIndex={row ? 0 : -1}
          aria-label={`删除${kind === 'plan' ? '计划' : '实际'}第 ${index + 1} 行`}
          onClick={row ? () => onDelete(kind, row.id, index) : undefined}
        >
          删除
        </button>
      </div>
    )
  }

  return (
    <section className="planner-section entry-section" aria-labelledby="entries-title">
      <div className="module-head">
        <h2 id="entries-title">规划记录</h2>
        <button className="primary-button" type="button" onClick={onAddRow}>新增一行</button>
      </div>
      <div className="entry-grid-head">
        <span>计划完成</span>
        <span aria-hidden="true" />
        <span>
          实际完成
          <button className="ghost-button import-button" type="button" disabled={importing} onClick={onImport}>
            {importing ? '导入中...' : '从时间追踪导入'}
          </button>
        </span>
      </div>
      <div className="entry-rows">
        {Array.from({ length: rowCount }, (_, index) => (
          <div className="entry-row" key={planRows[index]?.id ?? actualRows[index]?.id ?? `blank-${index}`}>
            {controls('plan', index)}
            <span className="row-number">{index + 1}</span>
            {controls('actual', index)}
          </div>
        ))}
        {rowCount === 0 && <p className="empty-text">还没有规划行</p>}
      </div>
      <div className="totals">
        <span>计划合计：<strong className="time-text">{durationLabel(planTotal)}</strong></span>
        <span>实际合计：<strong className="time-text">{durationLabel(actualTotal)}</strong></span>
        <span>差值：<strong className="time-text">{
          planTotal === null && actualTotal === null
            ? '--'
            : differenceLabel(actualTotal ?? 0, planTotal ?? 0)
        }</strong></span>
      </div>
    </section>
  )
}
