import { memo } from 'react';
import { Pencil, Trash2, AlertTriangle } from 'lucide-react';
import type { Task } from '../../domain/types.ts';
import { isOverdue } from '../../domain/selectors.ts';
import { formatDueDate } from '../../domain/dates.ts';

interface TaskItemProps {
  task: Task;
  today: string;
  onToggle: (task: Task) => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
}

/**
 * A single task row (REQ-TASK-03/04, REQ-ORG-03). Shows title, category and
 * priority as text, the formatted due date, an "Overdue" label with an icon,
 * and a single complete/reopen toggle plus edit and delete icon buttons whose
 * accessible names include the task title. Not color alone: every status is
 * conveyed with text (AC-A11Y-01.9). Wrapped in memo for list performance.
 */
function TaskItemBase({ task, today, onToggle, onEdit, onDelete }: TaskItemProps): JSX.Element {
  const completed = task.status === 'completed';
  const overdue = isOverdue(task, today);

  return (
    <li className={`task-item${completed ? ' task-item--completed' : ''}${overdue ? ' task-item--overdue' : ''}`}>
      <label className="task-item__toggle">
        <input
          type="checkbox"
          checked={completed}
          onChange={() => onToggle(task)}
          aria-label={completed ? `Reopen spirit: ${task.title}` : `Release spirit: ${task.title}`}
        />
        <span className="task-item__toggle-text">{completed ? 'Released' : 'Active'}</span>
      </label>

      <div className="task-item__body">
        <p className="task-item__title wrap-anywhere">{task.title}</p>
        {task.description && <p className="task-item__desc wrap-anywhere">{task.description}</p>}
        <ul className="task-item__meta">
          <li>
            <span className="meta-label">Category:</span> {task.category}
          </li>
          <li>
            <span className="meta-label">Priority:</span> {task.priority}
          </li>
          {task.dueDate && (
            <li>
              <span className="meta-label">Due:</span> {formatDueDate(task.dueDate)}
            </li>
          )}
          {task.estimatedMinutes != null && (
            <li>
              <span className="meta-label">Est:</span> {task.estimatedMinutes} min
            </li>
          )}
          {overdue && (
            <li className="task-item__overdue">
              <AlertTriangle size={16} aria-hidden="true" />
              <span>Overdue</span>
            </li>
          )}
        </ul>
      </div>

      <div className="task-item__actions">
        <button
          type="button"
          className="icon-btn"
          onClick={() => onEdit(task)}
          aria-label={`Edit spirit: ${task.title}`}
        >
          <Pencil size={18} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="icon-btn icon-btn--danger"
          onClick={() => onDelete(task)}
          aria-label={`Delete spirit: ${task.title}`}
        >
          <Trash2 size={18} aria-hidden="true" />
        </button>
      </div>
    </li>
  );
}

export const TaskItem = memo(TaskItemBase);
