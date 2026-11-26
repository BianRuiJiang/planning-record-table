import { differenceLabel, durationLabel } from '../lib/time'
import { slotCount, slotRows } from '../lib/rows'
import type { PlanningEntry } from '../lib/types'

interface Props {
  planRows: PlanningEntry[]
  actualRows: PlanningEntry[]
  planTotal: number | null
  actualTotal: number | null
  importing: boolean
  onAddRow: () => void
  onImport: () => void
  onFocusSide: (kind: 'plan' | 'actual', slot: number) => string
  onChange: (
    id: string,
    patch: Partial<Pick<PlanningEntry, 'title' | 'start_time' | 'end_time' | 'duration_min'>>,
  ) => void
  onDelete: (kind: 'plan' | 'actual', id: string) => void
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
  // 记录按 sort_order 落位：前 3 行固定预留，新增行从第 4 行开始往下接。
  const planSlots = slotRows(planRows)
  const actualSlots = slotRows(actualRows)
  const rowCount = slotCount(planSlots, actualSlots)

  function sideRows(kind: 'plan' | 'actual') {
    return kind === 'plan' ? planSlots : actualSlots
  }

  function controls(kind: 'plan' | 'actual', slot: number) {
    const row = sideRows(kind)[slot]
    const values = row ?? { title: '', start_time: '', end_time: '', duration_min: null }
    // 起止时间都填好后，耗时由时间差自动算出，不再手动输入。
    const autoDuration = Boolean(values.start_time && values.end_time)
    return (
      <div className={`entry-controls${row?.source === 'imported' ? ' imported' : ''}`}>
        <input
          type="time"
          className="time-input"
          value={values.start_time ?? ''}
          aria-label={`${kind === 'plan' ? '计划' : '实际'}开始时间`}
          onFocus={() => onFocusSide(kind, slot)}
          onChange={(event) => {
            const id = row?.id ?? onFocusSide(kind, slot)
            onChange(id, { start_time: event.target.value })
          }}
        />
        <input
          type="time"
          className="time-input"
          value={values.end_time ?? ''}
          aria-label={`${kind === 'plan' ? '计划' : '实际'}结束时间`}
          onFocus={() => onFocusSide(kind, slot)}
          onChange={(event) => {
            const id = row?.id ?? onFocusSide(kind, slot)
            onChange(id, { end_time: event.target.value })
          }}
        />
        <span className={`duration-cell${autoDuration ? ' auto' : ''}`}>
          <input
            type="number"
            min={0}
            placeholder="--"
            readOnly={autoDuration}
            value={values.duration_min ?? ''}
            title={autoDuration ? '由起止时间自动计算' : undefined}
            aria-label={`${kind === 'plan' ? '计划' : '实际'}耗时分钟${autoDuration ? '，由起止时间自动计算' : ''}`}
            onFocus={() => onFocusSide(kind, slot)}
            onChange={(event) => {
              const raw = event.target.value
              const id = row?.id ?? onFocusSide(kind, slot)
              onChange(id, { duration_min: raw === '' ? null : Math.max(0, Number(raw)) })
            }}
          />
          <span aria-hidden="true">分</span>
        </span>
        <input
          className="entry-title"
          value={values.title}
          placeholder="事情"
          onFocus={() => onFocusSide(kind, slot)}
          onChange={(event) => {
            const id = row?.id ?? onFocusSide(kind, slot)
            onChange(id, { title: event.target.value })
          }}
        />
        <button
          className={row ? 'danger-icon' : 'danger-icon invisible'}
          type="button"
          tabIndex={row ? 0 : -1}
          aria-label={`删除${kind === 'plan' ? '计划' : '实际'}第 ${slot + 1} 行`}
          onClick={row ? () => onDelete(kind, row.id) : undefined}
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
        <span className="side-label">计划完成</span>
        <span aria-hidden="true" />
        <div className="actual-head">
          <span className="side-label">实际完成</span>
          <button className="ghost-button import-button" type="button" disabled={importing} onClick={onImport}>
            {importing ? '导入中...' : '导入'}
          </button>
        </div>
      </div>
      <div className="entry-rows">
        {Array.from({ length: rowCount }, (_, slot) => (
          <div className="entry-row" key={planSlots[slot]?.id ?? actualSlots[slot]?.id ?? `blank-${slot}`}>
            {controls('plan', slot)}
            <span className="row-number">{slot + 1}</span>
            {controls('actual', slot)}
          </div>
        ))}
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
