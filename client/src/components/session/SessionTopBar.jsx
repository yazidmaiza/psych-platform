import React from 'react';

const Icon = ({ name, className }) => {
  // Minimal inline icons to avoid adding new deps
  if (name === 'x') {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M18 6 6 18" />
        <path d="M6 6l12 12" />
      </svg>
    );
  }
  if (name === 'logout') {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <path d="M16 17l5-5-5-5" />
        <path d="M21 12H9" />
      </svg>
    );
  }
  if (name === 'stop') {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M6 6h12v12H6z" />
      </svg>
    );
  }
  return null;
};

export default function SessionTopBar({
  title,
  statusLabel,
  onLogout,
  onEndSession,
  onCloseView
}) {
  return (
    <div className="sticky top-0 z-50 border-b border-[color:var(--panel-border)] bg-[color:var(--app-bg-70)] backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-sm sm:text-base font-semibold text-[color:var(--app-fg)]">{title}</h1>
            {statusLabel && (
              <span className="rounded-full border border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] px-2.5 py-1 text-[11px] font-semibold text-[color:var(--muted)]">
                {statusLabel}
              </span>
            )}
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={onLogout}
            className="group hidden sm:inline-flex items-center gap-2 rounded-xl border border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] px-3 py-2 text-sm font-semibold text-[color:var(--app-fg)] hover:brightness-110 transition"
          >
            <Icon name="logout" className="h-4 w-4 text-[color:var(--muted)] group-hover:text-[color:var(--app-fg)]" />
            Logout
          </button>

          <button
            type="button"
            onClick={onEndSession}
            className="inline-flex items-center gap-2 rounded-xl bg-rose-500/90 px-3.5 py-2 text-sm font-semibold text-white shadow hover:bg-rose-500 transition"
          >
            <Icon name="stop" className="h-4 w-4" />
            End Session
          </button>

          <button
            type="button"
            onClick={onCloseView}
            className="inline-flex items-center justify-center rounded-xl border border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] p-2 text-[color:var(--app-fg)] hover:brightness-110 transition"
            aria-label="Close view"
            title="Close"
          >
            <Icon name="x" className="h-4 w-4" />
          </button>
        </div>
      </div>
      {statusLabel && (
        <div className="mx-auto w-full max-w-6xl px-4 pb-3 sm:px-6">
          <div className="rounded-2xl border border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] px-4 py-2 text-xs text-[color:var(--muted)]">
            {statusLabel === 'Psychologist offline'
              ? 'Psychologist is currently offline. You can continue with the AI assistant.'
              : statusLabel}
          </div>
        </div>
      )}
    </div>
  );
}

