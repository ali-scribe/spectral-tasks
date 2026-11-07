import type { Task } from '../../domain/types.ts';
import { TaskItem } from './TaskItem.tsx';

interface TaskListProps {
  tasks: Task[];
  today: string;
  onToggle: (task: Task) => void;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
}

/**
 * Renders an ordered list of task rows. View selection, filtering and sorting
 * are computed by the caller (wired in Task 10); this component renders what it
 * is given. Empty-state messaging is added in Task 10.
 */
export function TaskList({ tasks, today, onToggle, onEdit, onDelete }: TaskListProps): JSX.Element {
  return (
    <ul className="task-list">
      {tasks.map((task) => (
        <TaskItem
          key={task.id}
          task={task}
          today={today}
          onToggle={onToggle}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </ul>
  );
}
