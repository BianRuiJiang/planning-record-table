import { supabase } from './supabase'
import type { Lane, PlanningDay, PlanningEntry, PlanningTask, TimeActivity } from './types'

function throwIfError(error: { message: string | null } | null, fallback: string) {
  if (error) throw new Error(error.message || fallback)
}

async function requireAffected(rows: Array<unknown> | null, fallback: string) {
  if (!rows?.length) throw new Error(fallback)
}

export async function ensurePlanningDay(userId: string, day: string): Promise<PlanningDay> {
  const { data, error } = await supabase
    .from('planning_days')
    .select('*')
    .eq('user_id', userId)
    .eq('day', day)
    .maybeSingle<PlanningDay>()
  throwIfError(error, '读取规划日失败')
  if (data) return data

  const insert = await supabase
    .from('planning_days')
    .insert({ user_id: userId, day })
    .select()
    .single<PlanningDay>()
  if (insert.error?.code === '23505') {
    const retry = await supabase
      .from('planning_days')
      .select('*')
      .eq('user_id', userId)
      .eq('day', day)
      .single<PlanningDay>()
    throwIfError(retry.error, '读取规划日失败')
    return retry.data as PlanningDay
  }
  throwIfError(insert.error, '创建规划日失败')
  return insert.data as PlanningDay
}

export async function updatePlanningDay(
  dayId: string,
  patch: Partial<Pick<PlanningDay, 'weather' | 'mood' | 'reflection'>>,
) {
  const { data, error } = await supabase
    .from('planning_days')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', dayId)
    .select('id')
    .returns<Array<{ id: string }>>()
  throwIfError(error, '保存日信息失败')
  await requireAffected(data, '日信息未保存，请刷新后重试')
}

export async function fetchTasks(dayId: string) {
  const { data, error } = await supabase
    .from('planning_tasks')
    .select('*')
    .eq('day_id', dayId)
    .order('sort_order')
    .order('created_at')
    .returns<PlanningTask[]>()
  throwIfError(error, '读取任务失败')
  return data ?? []
}

export async function insertTask(
  userId: string,
  dayId: string,
  lane: Lane,
  title: string,
  sortOrder: number,
) {
  const { data, error } = await supabase
    .from('planning_tasks')
    .insert({ user_id: userId, day_id: dayId, lane, title, sort_order: sortOrder })
    .select()
    .single<PlanningTask>()
  throwIfError(error, '新增任务失败')
  return data as PlanningTask
}

export async function updateTask(id: string, patch: Partial<Pick<PlanningTask, 'title' | 'done' | 'sort_order'>>) {
  const { data, error } = await supabase
    .from('planning_tasks')
    .update(patch)
    .eq('id', id)
    .select('id')
    .returns<Array<{ id: string }>>()
  throwIfError(error, '保存任务失败')
  await requireAffected(data, '任务未保存，请刷新后重试')
}

export async function deleteTask(id: string) {
  const { data, error } = await supabase
    .from('planning_tasks')
    .delete()
    .eq('id', id)
    .select('id')
    .returns<Array<{ id: string }>>()
  throwIfError(error, '删除任务失败')
  await requireAffected(data, '任务未删除，请刷新后重试')
}

export async function fetchEntries(dayId: string) {
  const { data, error } = await supabase
    .from('planning_entries')
    .select('*')
    .eq('day_id', dayId)
    .order('sort_order')
    .order('created_at')
    .returns<PlanningEntry[]>()
  throwIfError(error, '读取规划记录失败')
  return data ?? []
}

export async function insertEntry(userId: string, row: Omit<PlanningEntry, 'id' | 'user_id'>) {
  const { data, error } = await supabase
    .from('planning_entries')
    .insert({ ...row, user_id: userId })
    .select()
    .single<PlanningEntry>()
  throwIfError(error, '新增规划记录失败')
  return data as PlanningEntry
}

export async function updateEntry(
  id: string,
  patch: Partial<Pick<PlanningEntry, 'title' | 'start_time' | 'end_time' | 'duration_min' | 'sort_order'>>,
) {
  const { data, error } = await supabase
    .from('planning_entries')
    .update(patch)
    .eq('id', id)
    .select('id')
    .returns<Array<{ id: string }>>()
  throwIfError(error, '保存规划记录失败')
  await requireAffected(data, '记录未保存，请刷新后重试')
}

export async function deleteEntry(id: string) {
  const { data, error } = await supabase
    .from('planning_entries')
    .delete()
    .eq('id', id)
    .select('id')
    .returns<Array<{ id: string }>>()
  throwIfError(error, '删除规划记录失败')
  await requireAffected(data, '记录未删除，请刷新后重试')
}

export async function fetchPeriodActivities(startIso: Date, endIso: Date) {
  const { data, error } = await supabase
    .from('activities')
    .select('id,name,started_at,ended_at')
    .gte('started_at', startIso.toISOString())
    .lt('started_at', endIso.toISOString())
    .order('started_at')
    .returns<TimeActivity[]>()
  throwIfError(error, '读取时间追踪记录失败')
  return data ?? []
}
