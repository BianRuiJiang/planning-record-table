import type { Lane, PlanningTask } from '../lib/types'

interface Props {
  title: string
  lane: Lane
  tasks: PlanningTask[]
  onUpdate: (id: string, patch: Partial<Pick<PlanningTask, 'title' | 'done'>>) => void
  onDelete: (id: string) => void
  onAdd: () => void
}

export default function TaskSection({ title, lane, tasks, onUpdate, onDelete, onAdd }: Props) {
  return (
    <section className="lane-panel" aria-label={title}>
      <div className="column-head">
        <h3>{title}</h3>
        <button className="ghost-button" type="button" onClick={onAdd}>新增</button>
      </div>
      <div className="task-list">
        {tasks.map((task) => (
          <div key={task.id} className={`task-row${task.done ? ' done' : ''}`}>
            <input
              type="checkbox"
              checked={task.done}
              aria-label={`完成 ${task.title || '新任务'}`}
              onChange={(event) => onUpdate(task.id, { done: event.target.checked })}
            />
            <input
              value={task.title}
              placeholder="任务名称"
              onChange={(event) => onUpdate(task.id, { title: event.target.value })}
            />
            <button
              className="danger-icon"
              type="button"
              aria-label={`删除 ${task.title || '新任务'}`}
              onClick={() => onDelete(task.id)}
            >
              删除
            </button>
          </div>
        ))}
        {tasks.length === 0 && (
          <p className="empty-text">{lane === 'main' ? '还没有主线任务' : '还没有弹性任务'}</p>
        )}
      </div>
    </section>
  )
}
