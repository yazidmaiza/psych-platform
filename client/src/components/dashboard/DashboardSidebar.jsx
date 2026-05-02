import React from 'react';
import PlatformLogo from '../branding/PlatformLogo';

const Item = ({ active, disabled, onClick, label, meta }) => (
  <button
    type="button"
    disabled={disabled}
    onClick={onClick}
    className={[
      'group w-full rounded-2xl border px-4 py-3 text-left transition',
      active
        ? 'border-indigo-400/30 bg-indigo-500/15 text-white'
        : 'border-white/10 bg-white/5 text-white/80 hover:bg-white/10',
      disabled ? 'opacity-50 cursor-not-allowed' : ''
    ].join(' ')}
  >
    <div className="flex items-center justify-between gap-3">
      <div className="text-sm font-semibold">{label}</div>
      {meta != null && (
        <div className="rounded-full border border-white/10 bg-white/10 px-2 py-0.5 text-[11px] font-semibold text-white/80">
          {meta}
        </div>
      )}
    </div>
  </button>
);

export default function DashboardSidebar({
  section,
  onSectionChange,
  onOpenProfile,
  onOpenNotifications,
  unreadNotifications = 0,
  onGoCalendar,
  onLogout
}) {
  return (
    <aside className="w-full lg:w-[320px]">
      <div className="rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <PlatformLogo size={36} className="mt-0.5" />
            <div className="min-w-0">
              <div className="text-sm font-semibold text-white">Psychologist</div>
              <div className="mt-1 text-xs text-white/60">Dashboard</div>
            </div>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-50 hover:bg-rose-500/15 transition"
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
            active={section === 'statistics'}
            onClick={() => onSectionChange('statistics')}
            label="Statistics"
          />
        </div>

        <div className="mt-4 grid gap-2">
          <Item
            active={false}
            onClick={onOpenProfile}
            label="Edit profile"
          />
          <Item
            active={false}
            onClick={onOpenNotifications}
            label="Notifications"
            meta={unreadNotifications > 0 ? unreadNotifications : null}
          />
          <Item
            active={false}
            onClick={onGoCalendar}
            label="Calendar"
          />
        </div>

        <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-xs font-semibold text-white/80">Tip</div>
          <div className="mt-1 text-xs text-white/60">
            Keep your availability updated so patients can book from your confirmed slots.
          </div>
        </div>
      </div>
    </aside>
  );
}

