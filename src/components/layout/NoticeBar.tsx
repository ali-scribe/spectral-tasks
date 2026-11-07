import { AlertTriangle, Info, OctagonAlert, X } from 'lucide-react';
import type { Notice } from '../../domain/types.ts';
import { useAppState, useAppDispatch } from '../../state/AppContext.tsx';

const TONE_ICON = {
  info: Info,
  warning: AlertTriangle,
  error: OctagonAlert,
} as const;

/**
 * Renders storage notices (AC-PERS-02.3, .5, .6, .8, .9, .15). Dismissible
 * notices get a close button; persistent ones do not. Errors use role="alert"
 * so assistive technology is interrupted; others use role="status".
 */
export function NoticeBar(): JSX.Element | null {
  const { notices } = useAppState();
  const dispatch = useAppDispatch();

  if (notices.length === 0) {
    return null;
  }

  return (
    <div className="notice-bar">
      {notices.map((notice: Notice) => {
        const Icon = TONE_ICON[notice.tone];
        const dismissible = !notice.persistent;
        return (
          <div
            key={notice.id}
            className={`notice notice--${notice.tone}`}
            role={notice.tone === 'error' ? 'alert' : 'status'}
          >
            <Icon className="notice__icon" size={20} aria-hidden="true" />
            <p className="notice__text">{notice.text}</p>
            {dismissible && (
              <button
                type="button"
                className="notice__dismiss"
                onClick={() => dispatch({ type: 'DISMISS_NOTICE', id: notice.id })}
              >
                <X size={18} aria-hidden="true" />
                <span className="visually-hidden">Dismiss notice</span>
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
