// 规划记录的行位置规则：首屏固定 3 行，新增行从第 4 行开始往下接。
export const MIN_ENTRY_ROWS = 3

export function sortRows<T extends { sort_order: number }>(rows: T[]) {
  return [...rows].sort((left, right) => left.sort_order - right.sort_order)
}

/**
 * 把记录按 sort_order 放进固定槽位，槽位下标就是界面上的行号。
 * 空槽位留 undefined，由界面渲染成空白行——这样即使只有第 4 行有内容，
 * 前三行也仍然保留为空白，而不会被后续记录顶上来到第 1 行。
 */
export function slotRows<T extends { sort_order: number }>(rows: T[]): Array<T | undefined> {
  const slots: Array<T | undefined> = []
  let next = 0
  for (const row of sortRows(rows)) {
    let slot = Math.max(row.sort_order, next)
    while (slots[slot]) slot += 1
    slots[slot] = row
    next = slot + 1
  }
  return slots
}

/** 可见行数：至少 3 行，且要能放下最靠下的那条记录。 */
export function slotCount(...lanes: Array<Array<unknown>>) {
  return Math.max(MIN_ENTRY_ROWS, ...lanes.map((lane) => lane.length))
}

/** 新增行落位的行序号：前三行固定预留，之后接在最后一行下面。 */
export function nextSlot(...lanes: Array<Array<unknown>>) {
  return slotCount(...lanes)
}
