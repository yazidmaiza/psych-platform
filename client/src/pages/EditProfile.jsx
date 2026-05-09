import React from 'react';
import { useNavigate } from 'react-router-dom';
import PsychologistProfileForm from '../components/profile/PsychologistProfileForm';
import GlassPanel from '../components/dashboard/GlassPanel';

export default function EditProfile() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-[var(--app-bg)] text-[var(--app-fg)]">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -top-24 left-1/2 h-72 w-[540px] -translate-x-1/2 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="absolute -bottom-24 right-[-120px] h-80 w-80 rounded-full bg-fuchsia-500/15 blur-3xl" />
        <div className="absolute inset-0 bg-[var(--app-bg)]" />
      </div>

      <div className="relative">
        <header className="sticky top-0 z-40 border-b border-[color:var(--panel-border)] bg-[color:var(--app-bg-70)] backdrop-blur-xl">
          <div className="mx-auto w-full max-w-5xl px-4 py-4 sm:px-6">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <h1 className="truncate text-lg sm:text-xl font-semibold tracking-tight">Edit profile</h1>
                <div className="mt-1 text-xs text-[color:var(--muted)]">Update your public information and availability.</div>
              </div>
              <button
                type="button"
                onClick={() => navigate('/psychologist/dashboard')}
                className="rounded-2xl border border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] px-3 py-2 text-sm font-semibold text-[color:var(--app-fg)] hover:brightness-110 transition"
              >
                Back to dashboard
              </button>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
          <GlassPanel className="p-4 sm:p-6">
            <PsychologistProfileForm />
          </GlassPanel>
        </main>
      </div>
    </div>
  );
}
