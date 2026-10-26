import { useEffect, useRef, type ReactNode } from 'react';
import { closeTechnical, resume } from './game/actions';
import { useGame } from './game/store';

export default function Modal({ children, label, className = '', onEscape }: { children: ReactNode; label: string; className?: string; onEscape?: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog = ref.current!; dialog.showModal(); return () => dialog.close(); }, []);
  return <dialog ref={ref} aria-label={label} className={className} onKeyDown={event => {
    if (event.key !== 'Tab') return;
    const items = [...event.currentTarget.querySelectorAll<HTMLElement>('button,input,select,textarea,a[href],summary,[tabindex]')].filter(el => el.tabIndex >= 0 && !el.matches(':disabled') && el.getClientRects().length > 0);
    if (!items.length) { event.preventDefault(); return; }
    const first = items[0], last = items[items.length - 1];
    if (event.shiftKey && (document.activeElement === first || !event.currentTarget.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }} onCancel={event => {
    event.preventDefault();
    if (onEscape) onEscape();
    else if (useGame.getState().phase === 'technical') closeTechnical();
    else resume();
  }}>{children}</dialog>;
}
