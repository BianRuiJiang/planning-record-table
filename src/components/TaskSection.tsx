import type { Lane, PlanningTask } from '../lib/types'

interface Props {
  title: string
  lane: Lane
  tasks: PlanningTask[]
  onEnsure: (index: number) => string
  onUpdate: (id: string, patch: Partial<Pick<PlanningTask, 'title' | 'done'>>) => void
}

export default function TaskSection({ title, lane, tasks, onEnsure, onUpdate }: Props) {
  // 每侧固定 3 格；空格聚焦后自动生成本地草稿，输入标题后入库。
  const slots = Array.from({ length: 3 }, (_, index) => tasks[index])

  return (
    <section className="lane-panel" aria-label={title}>
      <div className="column-head">
        <h3>{title}</h3>
      </div>
      <div className="task-list">
        {slots.map((task, index) => (
          <div key={task?.id ?? `blank-${lane}-${index}`} className={`task-row${task?.done ? ' done' : ''}`}>
            <label className="task-state">
              <input
                className="task-check"
                type="checkbox"
                checked={task?.done ?? false}
                disabled={!task}
                aria-label={`完成 ${task?.title || '任务'}`}
                onChange={(event) => task && onUpdate(task.id, { done: event.target.checked })}
              />
              <span className="task-number">{(lane === 'main' ? 0 : 3) + index + 1}</span>
            </label>
            <input
              value={task?.title ?? ''}
              aria-label={`${title} ${index + 1}`}
              onFocus={() => onEnsure(index)}
              onChange={(event) => {
                const id = task?.id ?? onEnsure(index)
                onUpdate(id, { title: event.target.value })
              }}
            />
          </div>
        ))}
      </div>
    </section>
  )
}
