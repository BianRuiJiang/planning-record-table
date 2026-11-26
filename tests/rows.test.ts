import { describe, expect, it } from 'vitest'
import { MIN_ENTRY_ROWS, nextSlot, slotCount, slotRows } from '../src/lib/rows'

interface Row {
  id: string
  sort_order: number
}

function rows(...orders: number[]): Row[] {
  return orders.map((sort_order) => ({ id: `row-${sort_order}`, sort_order }))
}

describe('行槽位', () => {
  it('空列表不留槽位，可见行数取下限 3', () => {
    expect(slotRows([])).toHaveLength(0)
    expect(slotCount(slotRows([]), slotRows([]))).toBe(MIN_ENTRY_ROWS)
  })

  it('只有第 4 行的记录时，前三行仍保留为空槽位', () => {
    const slots = slotRows(rows(3))
    expect(slots).toHaveLength(4)
    expect(slots[0]).toBeUndefined()
    expect(slots[1]).toBeUndefined()
    expect(slots[2]).toBeUndefined()
    expect(slots[3]?.id).toBe('row-3')
  })

  it('sort_order 重复时不会挤掉任何一条，后一条顺延到下一个空槽位', () => {
    const slots = slotRows([
      { id: 'a', sort_order: 0 },
      { id: 'b', sort_order: 0 },
    ])
    expect(slots[0]?.id).toBe('a')
    expect(slots[1]?.id).toBe('b')
  })

  it('新增行从第 4 行开始：没有记录时是 3', () => {
    expect(nextSlot(slotRows([]), slotRows([]))).toBe(3)
  })

  it('已有 3 行时继续接在第 4 行', () => {
    expect(nextSlot(slotRows(rows(0, 1, 2)), slotRows(rows(0, 1, 2)))).toBe(3)
  })

  it('两栏不对称时按更靠下的一栏接续', () => {
    expect(nextSlot(slotRows(rows(0)), slotRows(rows(0, 1, 2, 3, 4)))).toBe(5)
  })

  it('中间被删空的行不会被后面的记录顶上来', () => {
    const slots = slotRows(rows(0, 2))
    expect(slots[1]).toBeUndefined()
    expect(slots[2]?.id).toBe('row-2')
    expect(slotCount(slots)).toBe(3)
  })
})
