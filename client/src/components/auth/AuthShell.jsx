import React from 'react';

export default function AuthShell({ title, subtitle, children, footer, onBack, backLabel = 'Back' }) {
  return (
    <div className="min-h-screen bg-[var(--app-bg)] text-[var(--app-fg)]">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -top-24 left-1/2 h-72 w-[540px] -translate-x-1/2 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="absolute -bottom-24 right-[-120px] h-80 w-80 rounded-full bg-fuchsia-500/15 blur-3xl" />
        <div className="absolute inset-0 bg-[var(--app-bg)]" />
      </div>

      <div className="relative flex min-h-screen items-center justify-center px-4 py-10">
        <div className="w-full max-w-5xl">
          <div className="grid gap-6 lg:grid-cols-2 lg:items-stretch">
            <div className="hidden lg:flex flex-col justify-between rounded-3xl border border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] backdrop-blur-xl p-8">
              <div>
                <div className="text-xs font-semibold text-[color:var(--muted)]">Psych Platform</div>
                <h1 className="mt-3 text-3xl font-semibold tracking-tight">{title}</h1>
                {subtitle && <p className="mt-3 text-sm text-[color:var(--muted)] leading-relaxed">{subtitle}</p>}
              </div>

              <div className="mt-10 grid gap-3">
                <div className="rounded-2xl border border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] p-4">
                  <div className="text-sm font-semibold">Secure sessions</div>
                  <div className="mt-1 text-sm text-[color:var(--muted)]">Private messaging, booking, and session history.</div>
                </div>
                <div className="rounded-2xl border border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] p-4">
                  <div className="text-sm font-semibold">AI-assisted care</div>
                  <div className="mt-1 text-sm text-[color:var(--muted)]">Chatbot support alongside psychologist consultations.</div>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] backdrop-blur-xl shadow-sm p-6 sm:p-8">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-xl font-semibold tracking-tight lg:hidden">{title}</h2>
                  {subtitle && <p className="mt-2 text-sm text-[color:var(--muted)] lg:hidden">{subtitle}</p>}
                </div>
                {onBack && (
                  <button
                    type="button"
                    onClick={onBack}
                    className="rounded-2xl border border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] px-3 py-2 text-sm font-semibold text-[color:var(--app-fg)] hover:brightness-110 transition"
                  >
                    {backLabel}
                  </button>
                )}
              </div>

              <div className="mt-6">{children}</div>

              {footer && <div className="mt-6 border-t border-[color:var(--panel-border)] pt-5">{footer}</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
