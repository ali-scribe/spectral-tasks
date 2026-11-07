import type { ValidTaskInput } from '../../domain/validation.ts';
import { useAppDispatch, useClock } from '../../state/AppContext.tsx';
import { createId } from '../../domain/ids.ts';
import { TaskForm } from './TaskForm.tsx';

/**
 * The "summon a spirit" create panel, placed in the left column per the
 * approved layout. Dispatches CREATE_TASK with a fresh id and the Clock time.
 */
export function CreateTaskPanel(): JSX.Element {
  const dispatch = useAppDispatch();
  const clock = useClock();

  const create = (value: ValidTaskInput) => {
    dispatch({ type: 'CREATE_TASK', input: value, id: createId(), nowIso: clock().toISOString() });
  };

  return (
    <section className="panel" aria-label="Summon a spirit">
      <h2>Summon a spirit</h2>
      <TaskForm onSubmit={create} submitLabel="Summon spirit" resetAfterSubmit idPrefix="create" />
    </section>
  );
}
