import React, { useEffect } from 'react';
import Conversation from '../../pages/Conversation';

export default function ConversationDrawer({ open, otherUserId, title = 'Chat', subtitle, onClose }) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  return (
    <div
      className={[
        'fixed inset-0 z-50',
        open ? 'pointer-events-auto' : 'pointer-events-none'
      ].join(' ')}
      aria-hidden={!open}
    >
      <div
        className={[
          'absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-200',
          open ? 'opacity-100' : 'opacity-0'
        ].join(' ')}
        onClick={() => onClose?.()}
      />

      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={[
          'absolute right-0 top-0 h-full w-full max-w-[520px]',
          'bg-white shadow-2xl transition-transform duration-200',
          open ? 'translate-x-0' : 'translate-x-full'
        ].join(' ')}
      >
        <header className="flex items-center gap-3 border-b border-gray-100 px-4 py-3">
          <button
            type="button"
            onClick={() => onClose?.()}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-gray-100 text-gray-700 hover:bg-gray-200"
            aria-label="Close chat"
          >
            <span className="text-lg leading-none">×</span>
          </button>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-gray-900">{title}</div>
            {subtitle ? (
              <div className="truncate text-xs text-gray-500">{subtitle}</div>
            ) : null}
          </div>
        </header>

        <div className="h-[calc(100%-57px)]">
          {open ? <Conversation otherUserId={otherUserId} embedded onClose={onClose} /> : null}
        </div>
      </section>
    </div>
  );
}
