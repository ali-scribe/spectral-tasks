import { useState } from 'react';
import { useAppState } from '../../state/AppContext.tsx';
import { getCounts } from '../../domain/selectors.ts';
import { getManorStage } from '../../domain/manor.ts';
import { MANOR_STAGES } from '../../domain/constants.ts';
import type { ManorStageId } from '../../domain/types.ts';

interface ManorPreviewProps {
  /** The stage being previewed, or null to show the real manor. */
  previewStage: ManorStageId | null;
  onPreview: (stage: ManorStageId | null) => void;
}

/**
 * A quiet, read-only way to look at any manor stage (for first-time visitors
 * and demos). It is local UI state only: it never touches the reducer, storage,
 * counts or the daily goal, and the real stage is always shown in the label.
 * Choosing a stage announces "Previewing stage N" in its own polite live
 * region; the stage-increase announcement is not involved.
 */
export function ManorPreview({ previewStage, onPreview }: ManorPreviewProps): JSX.Element {
  const { tasks } = useAppState();
  const realStage = getManorStage(getCounts(tasks).completed);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');

  const choose = (stage: ManorStageId) => {
    if (previewStage === stage) {
      back();
      return;
    }
    onPreview(stage);
    setMessage(`Previewing stage ${stage}`);
  };

  const back = () => {
    onPreview(null);
    setMessage(`Showing your real manor, stage ${realStage}`);
  };

  return (
    <div className="manor-preview">
      <button
        type="button"
        className="manor-preview__toggle"
        aria-expanded={open}
        aria-controls="manor-preview-stages"
        onClick={() => setOpen((o) => !o)}
      >
        Preview manor stages
      </button>

      {open && (
        <div
          id="manor-preview-stages"
          className="manor-preview__stages"
          role="group"
          aria-label="Preview a manor stage"
        >
          {MANOR_STAGES.map((s) => (
            <button
              key={s.id}
              type="button"
              className="manor-preview__stage"
              aria-pressed={previewStage === s.id}
              aria-label={`Stage ${s.id}: ${s.name}`}
              onClick={() => choose(s.id)}
            >
              {s.id}
            </button>
          ))}
        </div>
      )}

      {previewStage !== null && (
        <p className="manor-preview__note">
          Preview: your real progress is stage {realStage}.{' '}
          <button type="button" className="manor-preview__back" onClick={back}>
            Back to my manor
          </button>
        </p>
      )}

      <div className="visually-hidden" role="status" aria-live="polite">
        {message}
      </div>
    </div>
  );
}
