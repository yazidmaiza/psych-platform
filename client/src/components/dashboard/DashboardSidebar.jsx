import React from 'react';
import PlatformLogo from '../branding/PlatformLogo';

const Item = ({ active, disabled, onClick, label, meta }) => (
  <button
    type="button"
    disabled={disabled}
    onClick={onClick}
    className={[
      'group w-full rounded-2xl border px-4 py-3 text-left shadow-sm backdrop-blur transition',
      active
        ? 'border-[color:var(--accent-25)] bg-[color:var(--accent-10)] text-[color:var(--app-fg)] shadow-[0_10px_22px_rgba(15,23,42,0.10)]'
        : 'border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] text-[color:var(--app-fg)] hover:brightness-110',
      disabled ? 'opacity-50 cursor-not-allowed' : ''
    ].join(' ')}
  >
    <div className="flex items-center justify-between gap-3">
      <div className="text-sm font-semibold tracking-tight">{label}</div>
      {meta != null && (
        <div className="rounded-full border border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] px-2 py-0.5 text-[11px] font-semibold text-[color:var(--app-fg)] shadow-sm">
          {meta}
        </div>
      )}
    </div>
  </button>
);

export default function DashboardSidebar({
  section,
  onSectionChange,
  unreadNotifications = 0,
  onGoCalendar,
  onLogout
}) {
  return (
    <aside className="w-full lg:w-[320px]">
      <div className="ui-glass p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <PlatformLogo size={36} className="mt-0.5" />
            <div className="min-w-0">
              <div className="text-sm font-semibold text-[color:var(--app-fg)]">Psychologist</div>
              <div className="mt-1 text-xs text-[color:var(--muted)]">Dashboard</div>
            </div>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-700 shadow-sm transition hover:bg-rose-500/15"
          >
            Logout
          </button>
        </div>

        <div className="mt-4 grid gap-2">
          <Item
            active={section === 'patients'}
            onClick={() => onSectionChange('patients')}
            label="Patients"
          />
          <Item
            active={section === 'documents'}
            onClick={() => onSectionChange('documents')}
            label="Credential documents"
          />
          <Item
            active={section === 'messages'}
            onClick={() => onSectionChange('messages')}
            label="Messages"
          />
          <Item
            active={section === 'statistics'}
            onClick={() => onSectionChange('statistics')}
            label="Statistics"
          />
        </div>

        <div className="mt-4 grid gap-2">
          <Item
            active={false}
            onClick={onGoCalendar}
            label="Calendar"
          />
        </div>

        <div className="mt-4 rounded-2xl border border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] p-4 shadow-sm backdrop-blur">
          <div className="text-xs font-semibold text-[color:var(--app-fg)]">Tip</div>
          <div className="mt-1 text-xs text-[color:var(--muted)]">
            Keep your availability updated so patients can book from your confirmed slots.
          </div>
        </div>
      </div>
    </aside>
  );
}

