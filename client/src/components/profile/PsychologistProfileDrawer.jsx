import React, { useEffect } from 'react';
import PsychologistProfileForm from './PsychologistProfileForm';

export default function PsychologistProfileDrawer({ open, onClose, onSaved }) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, open]);

  return (
    <div className={`fixed inset-0 z-[75] ${open ? '' : 'pointer-events-none'}`}>
      <button
        type="button"
        aria-label="Close profile editor"
        className={[
          'absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity',
          open ? 'opacity-100' : 'opacity-0'
        ].join(' ')}
        onClick={onClose}
      />

      <aside
        className={[
          'absolute right-0 top-0 h-full w-full max-w-2xl border-l border-white/10 bg-slate-950/70 shadow-2xl backdrop-blur-xl',
          'transition-transform duration-200',
          open ? 'translate-x-0' : 'translate-x-full'
        ].join(' ')}
        aria-hidden={!open}
      >
        <div className="flex h-full flex-col">
          <div className="border-b border-white/10 p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-base font-semibold text-white">Edit profile</div>
                <div className="mt-1 text-xs text-white/60">Changes update your public profile immediately.</div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-white/80 hover:bg-white/10 transition"
              >
                Close
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 sm:p-6">
            <PsychologistProfileForm
              onSaved={() => {
                onSaved?.();
              }}
            />
          </div>
        </div>
      </aside>
    </div>
  );
}

