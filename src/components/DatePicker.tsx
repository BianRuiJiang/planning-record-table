import { useEffect, useRef, useState } from 'react'
import { shiftDate } from '../lib/time'

interface Props {
  value: string
  onChange: (day: string) => void
}

const weekLabels = ['一', '二', '三', '四', '五', '六', '日']

function dayText(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function monthDays(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

export default function DatePicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const [month, setMonth] = useState(() => value.slice(0, 7))
  const rootRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (open) setMonth(value.slice(0, 7))
  }, [open, value])

  useEffect(() => {
    if (!open) return
    function handleOutside(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleOutside)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleOutside)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  const year = Number(month.slice(0, 4))
  const monthNumber = Number(month.slice(5, 7))
  const firstWeekday = (new Date(Date.UTC(year, monthNumber - 1, 1)).getUTCDay() + 6) % 7
  const selectedMonth = value.slice(0, 7)

  function moveMonth(step: number) {
    const next = new Date(Date.UTC(year, monthNumber - 1 + step, 1))
    setMonth(`${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}`)
  }

  function select(day: string) {
    onChange(day)
    setOpen(false)
  }

  return (
    <div className="date-picker" ref={rootRef}>
      <button
        className="date-trigger"
        type="button"
        aria-label="选择周期起始日"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        {value.replaceAll('-', '/')}
      </button>
      <div className={`date-popover${open ? ' open' : ''}`} aria-hidden={!open}>
        <div className="date-popover-head">
          <button type="button" aria-label="上一月" onClick={() => moveMonth(-1)}>‹</button>
          <strong>{year}年{monthNumber}月</strong>
          <button type="button" aria-label="下一月" onClick={() => moveMonth(1)}>›</button>
        </div>
        <div className="date-week-grid">
          {weekLabels.map((label) => <span key={label}>{label}</span>)}
        </div>
        <div className="date-day-grid">
          {Array.from({ length: firstWeekday }, (_, index) => <span key={`blank-${index}`} />)}
          {Array.from({ length: monthDays(year, monthNumber) }, (_, index) => {
            const current = dayText(year, monthNumber, index + 1)
            return (
              <button
                key={current}
                type="button"
                className={current === value ? 'selected' : current === shiftDate(value, 0) && selectedMonth === month ? 'today' : ''}
                onClick={() => select(current)}
              >
                {index + 1}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
