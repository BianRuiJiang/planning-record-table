// 导出记录只存本机：规划表结构保持不变（不新增列），换设备会重新显示为未导出。
const PREFIX = 'planning-exported:'

export interface ExportMark {
  fileName: string
  at: string
}

export type ExportMarks = Record<string, ExportMark>

function storageKey(userId: string) {
  return `${PREFIX}${userId}`
}

export function readExportMarks(userId: string): ExportMarks {
  if (typeof localStorage === 'undefined') return {}
  try {
    const raw = localStorage.getItem(storageKey(userId))
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return {}
    const marks: ExportMarks = {}
    for (const [day, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (!value || typeof value !== 'object') continue
      const item = value as Partial<ExportMark>
      if (typeof item.fileName === 'string') {
        marks[day] = { fileName: item.fileName, at: typeof item.at === 'string' ? item.at : '' }
      }
    }
    return marks
  } catch {
    return {}
  }
}

export function markExported(userId: string, days: string[], files: string[], at = new Date()): ExportMarks {
  const marks = readExportMarks(userId)
  const stamp = at.toISOString()
  days.forEach((day, index) => {
    marks[day] = { fileName: files[index] ?? '', at: stamp }
  })
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(marks))
  } catch {
    // 隐私模式下写入可能失败，不影响本次导出。
  }
  return marks
}
