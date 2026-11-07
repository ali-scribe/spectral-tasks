import { Modal } from '../common/Modal.tsx';
import { TaskForm } from './TaskForm.tsx';
import { useAppState, useAppDispatch } from '../../state/AppContext.tsx';
import type { ValidTaskInput } from '../../domain/validation.ts';

/**
 * Edit dialog (REQ-TASK-02, AC-A11Y-01.4 to .6). Opens when ui.editingId is set,
 * prefilled from the task. Cancel and Escape discard changes (the reducer is
 * not called). A failed validation leaves the saved task untouched because the
 * form only calls onSubmit on success. Saving dispatches UPDATE_TASK.
 */
export function TaskFormDialog(): JSX.Element | null {
  const { tasks, ui } = useAppState();
  const dispatch = useAppDispatch();

  if (ui.editingId === null) {
    return null;
  }
  const task = tasks.find((t) => t.id === ui.editingId);
  if (!task) {
    return null;
  }

  const close = () => dispatch({ type: 'CLOSE_EDIT' });
  const save = (value: ValidTaskInput) => {
    dispatch({ type: 'UPDATE_TASK', id: task.id, input: value });
    close();
  };

  return (
    <Modal title="Edit spirit" onClose={close}>
      <TaskForm
        task={task}
        onSubmit={save}
        submitLabel="Save spirit"
        onCancel={close}
        idPrefix="edit"
      />
    </Modal>
  );
}
