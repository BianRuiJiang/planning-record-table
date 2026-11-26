export const TIME_ZONE = 'Asia/Shanghai'

const dateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

const minuteFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

const weekdayFormatter = new Intl.DateTimeFormat('zh-CN', {
  timeZone: TIME_ZONE,
  weekday: 'long',
})

export function planningDay(date = new Date()) {
  const dayText = beijingDate(date)
  const hour = Number(minuteFormatter.format(date).slice(0, 2))
  return hour < 5 ? shiftDate(dayText, -1) : dayText
}

// 不套用 05:00 规则的自然日，用于导出时间戳和日历。
export function beijingDate(date = new Date()) {
  return dateFormatter.format(date)
}

export function beijingStamp(date = new Date()) {
  return `${dateFormatter.format(date)} ${minuteFormatter.format(date)}`
}

export function shiftDate(dayText: string, days: number) {
  const date = new Date(`${dayText}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export function weekdayLabel(dayText: string) {
  return weekdayFormatter.format(new Date(`${dayText}T12:00:00+08:00`))
}

export function dayRange(dayText: string) {
  return {
    start: new Date(`${dayText}T05:00:00+08:00`),
    end: new Date(`${shiftDate(dayText, 1)}T05:00:00+08:00`),
  }
}

export function isoMinute(value: Date) {
  return minuteFormatter.format(value)
}

export function durationMinutes(startText: string, endText: string) {
  const start = parseClock(startText)
  const end = parseClock(endText)
  if (start === null || end === null) return null
  const diff = end - start
  return diff >= 0 ? diff : diff + 24 * 60
}

export function durationFromTimestamps(startIso: string, endIso: string) {
  const diff = Math.floor((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60000)
  return Math.max(0, diff)
}

function parseClock(value: string) {
  const match = /^(\d{2}):(\d{2})(?::\d{2})?$/.exec(value)
  if (!match) return null
  const minutes = Number(match[1]) * 60 + Number(match[2])
  return minutes >= 0 && minutes < 24 * 60 ? minutes : null
}

export function durationLabel(minutes: number | null) {
  if (minutes === null) return '--'
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours < 1) return `${rest}分`
  return `${hours}时${String(rest).padStart(2, '0')}分`
}

export function differenceLabel(actual: number, plan: number) {
  const diff = actual - plan
  if (diff === 0) return '持平'
  return `${diff > 0 ? '+' : '-'}${durationLabel(Math.abs(diff))}`
}
