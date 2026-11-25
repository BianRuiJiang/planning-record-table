export type Lane = 'main' | 'flex'
export type EntryKind = 'plan' | 'actual'

export interface Session {
  user: {
    id: string
    email?: string | null
  }
}

export interface PlanningDay {
  id: string
  user_id: string
  day: string
  weather: string | null
  mood: string | null
  reflection: string | null
}

export interface PlanningTask {
  id: string
  user_id: string
  day_id: string
  lane: Lane
  title: string
  done: boolean
  sort_order: number
}

export interface PlanningEntry {
  id: string
  user_id: string
  day_id: string
  kind: EntryKind
  title: string
  start_time: string | null
  end_time: string | null
  duration_min: number | null
  sort_order: number
  source: 'manual' | 'imported'
  source_activity_id: string | null
}

export interface TimeActivity {
  id: string
  name: string
  started_at: string
  ended_at: string | null
}

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'
