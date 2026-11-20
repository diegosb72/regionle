/**
 * A panel over the page, for what is looked at for a moment and put away: a QR code, a diploma. It is
 * drawn next to the game and not inside it, so that on paper the game can be put away whole and what the
 * panel shows is what is printed (`printing` names the class the page takes while the panel is open, for
 * the print rules of whoever uses it).
 */
import { X } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { L } from '../lib/i18n';
import { cx } from '../lib/text';
import './dialog.css';

export function Dialog({ title, className, printing, onClose, children }: { title: string; className?: string; printing?: string; onClose(): void; children: ReactNode }) {
  const box = useRef<HTMLDialogElement>(null);
  const id = useId();

  useEffect(() => {
    const d = box.current;
    if (!d || d.open) return;
    // An old browser without dialogs shows it in the page, which is still what was asked for.
    if (typeof d.showModal === 'function') d.showModal();
    else d.setAttribute('open', '');
  }, []);

  useEffect(() => {
    if (!printing) return;
    document.documentElement.classList.add(printing);
    return () => document.documentElement.classList.remove(printing);
  }, [printing]);

  // Every way out goes through the dialog's own closing, which gives the focus back to where it was; the
  // panel is taken away when the dialog says it has closed.
  const shut = () => {
    const d = box.current;
    if (d?.open && typeof d.close === 'function') d.close();
    else onClose();
  };

  return createPortal(
    <dialog
      ref={box}
      className={cx('dlg', className)}
      aria-labelledby={id}
      onClose={onClose}
      // A key pressed in the panel is not one for the game behind it, which listens on the window. Once the
      // panel has closed it is: for a moment it is still in the page, with the keyboard on the button that
      // closed it, and a key pressed just then is already meant for the game.
      onKeyDown={(e) => box.current?.open !== false && e.stopPropagation()}
      onKeyUp={(e) => box.current?.open !== false && e.stopPropagation()}
      onClick={(e) => {
        // A click on the darkened page around the panel closes it.
        if (e.target === box.current) shut();
      }}
    >
      <div className="dlg-box">
        <header className="dlg-head">
          <h2 id={id}>{title}</h2>
          <button type="button" className="icon-btn" onClick={shut} aria-label={L('Cerrar', 'Close')}>
            <X size={18} aria-hidden="true" />
          </button>
        </header>
        {children}
      </div>
    </dialog>,
    document.body,
  );
}
