import { useEffect, useRef, useState } from 'react';
import { CATEGORIES, PRIORITIES, type Task } from '../../domain/types.ts';
import {
  validateTaskInput,
  type RawTaskInput,
  type ValidTaskInput,
  type ValidationErrors,
  type FieldName,
} from '../../domain/validation.ts';

interface TaskFormProps {
  /** Existing task when editing; undefined when creating. */
  task?: Task;
  /** Called with validated input when the form is submitted successfully. */
  onSubmit: (value: ValidTaskInput) => void;
  /** Submit button label. */
  submitLabel: string;
  /** Edit mode shows a cancel button. */
  onCancel?: () => void;
  /** When true (create mode), reset and refocus the title after a submit. */
  resetAfterSubmit?: boolean;
  /** Id prefix so multiple forms on a page keep unique field ids. */
  idPrefix?: string;
}

/** Field order used for focusing the first invalid field (AC-VAL-01.10). */
const FIELD_ORDER: FieldName[] = ['title', 'description', 'dueDate', 'estimatedMinutes'];

function toRaw(task?: Task): RawTaskInput {
  return {
    title: task?.title ?? '',
    description: task?.description ?? '',
    category: task?.category ?? '',
    priority: task?.priority ?? '',
    dueDate: task?.dueDate ?? '',
    estimatedMinutes: task?.estimatedMinutes != null ? String(task.estimatedMinutes) : '',
  };
}

/**
 * Controlled create/edit form (REQ-TASK-01, REQ-VAL-01). Validates on submit,
 * associates each error with its field via aria-describedby and aria-invalid,
 * moves focus to the first invalid field, and clears a field's error as the
 * user edits it. In create mode it resets and refocuses the title on success.
 */
export function TaskForm({
  task,
  onSubmit,
  submitLabel,
  onCancel,
  resetAfterSubmit = false,
  idPrefix = 'task',
}: TaskFormProps): JSX.Element {
  const [raw, setRaw] = useState<RawTaskInput>(() => toRaw(task));
  const [errors, setErrors] = useState<ValidationErrors>({});
  const titleRef = useRef<HTMLInputElement>(null);
  const fieldRefs = {
    title: titleRef,
    description: useRef<HTMLTextAreaElement>(null),
    dueDate: useRef<HTMLInputElement>(null),
    estimatedMinutes: useRef<HTMLInputElement>(null),
  };

  // Re-sync when the edited task changes (e.g. opening a different task).
  useEffect(() => {
    setRaw(toRaw(task));
    setErrors({});
  }, [task]);

  const fieldId = (name: string) => `${idPrefix}-${name}`;
  const errorId = (name: FieldName) => `${idPrefix}-${name}-error`;

  function update<K extends keyof RawTaskInput>(key: K, value: RawTaskInput[K]): void {
    setRaw((prev) => ({ ...prev, [key]: value }));
    // Clear this field's error as the user corrects it (AC-VAL-01.11).
    if (key in errors) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key as FieldName];
        return next;
      });
    }
  }

  function handleSubmit(event: React.FormEvent): void {
    event.preventDefault();
    const result = validateTaskInput(raw);
    if (!result.ok) {
      setErrors(result.errors);
      // Focus the first invalid field in DOM order (AC-VAL-01.10).
      const firstInvalid = FIELD_ORDER.find((name) => result.errors[name]);
      if (firstInvalid) {
        fieldRefs[firstInvalid].current?.focus();
      }
      return;
    }
    setErrors({});
    onSubmit(result.value);
    if (resetAfterSubmit) {
      setRaw(toRaw(undefined));
      titleRef.current?.focus();
    }
  }

  const describedBy = (name: FieldName) => (errors[name] ? errorId(name) : undefined);
  const invalid = (name: FieldName) => (errors[name] ? true : undefined);

  return (
    <form className="task-form" onSubmit={handleSubmit} noValidate aria-label={task ? 'Edit spirit' : 'Summon a spirit'}>
      <div className="field">
        <label htmlFor={fieldId('title')}>Title</label>
        <input
          id={fieldId('title')}
          ref={titleRef}
          type="text"
          value={raw.title}
          onChange={(e) => update('title', e.target.value)}
          aria-invalid={invalid('title')}
          aria-describedby={describedBy('title')}
          maxLength={200}
          autoComplete="off"
        />
        {errors.title && (
          <p className="field__error" id={errorId('title')}>
            {errors.title}
          </p>
        )}
      </div>

      <div className="field">
        <label htmlFor={fieldId('description')}>Description</label>
        <textarea
          id={fieldId('description')}
          ref={fieldRefs.description}
          value={raw.description}
          onChange={(e) => update('description', e.target.value)}
          aria-invalid={invalid('description')}
          aria-describedby={describedBy('description')}
          rows={3}
        />
        {errors.description && (
          <p className="field__error" id={errorId('description')}>
            {errors.description}
          </p>
        )}
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor={fieldId('category')}>Category</label>
          <select
            id={fieldId('category')}
            value={raw.category}
            onChange={(e) => update('category', e.target.value as RawTaskInput['category'])}
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor={fieldId('priority')}>Priority</label>
          <select
            id={fieldId('priority')}
            value={raw.priority}
            onChange={(e) => update('priority', e.target.value as RawTaskInput['priority'])}
          >
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor={fieldId('dueDate')}>Due date</label>
          <input
            id={fieldId('dueDate')}
            ref={fieldRefs.dueDate}
            type="date"
            value={raw.dueDate}
            onChange={(e) => update('dueDate', e.target.value)}
            aria-invalid={invalid('dueDate')}
            aria-describedby={describedBy('dueDate')}
          />
          {errors.dueDate && (
            <p className="field__error" id={errorId('dueDate')}>
              {errors.dueDate}
            </p>
          )}
        </div>

        <div className="field">
          <label htmlFor={fieldId('estimatedMinutes')}>Estimated minutes</label>
          <input
            id={fieldId('estimatedMinutes')}
            ref={fieldRefs.estimatedMinutes}
            type="number"
            inputMode="numeric"
            min={1}
            max={1440}
            value={raw.estimatedMinutes}
            onChange={(e) => update('estimatedMinutes', e.target.value)}
            aria-invalid={invalid('estimatedMinutes')}
            aria-describedby={describedBy('estimatedMinutes')}
          />
          {errors.estimatedMinutes && (
            <p className="field__error" id={errorId('estimatedMinutes')}>
              {errors.estimatedMinutes}
            </p>
          )}
        </div>
      </div>

      <div className="task-form__actions">
        <button type="submit" className="btn btn--primary">
          {submitLabel}
        </button>
        {onCancel && (
          <button type="button" className="btn" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
