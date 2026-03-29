import React from 'react';

const TabButton = ({
  active,
  disabled,
  label,
  subtitle,
  onClick,
  onClose
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        'group relative flex-1 rounded-2xl border px-4 py-3 text-left transition',
        active ? 'border-white/20 bg-white/10' : 'border-white/10 bg-white/5 hover:bg-white/10',
        disabled ? 'opacity-50 cursor-not-allowed hover:bg-white/5' : ''
      ].join(' ')}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className="truncate text-sm font-semibold text-white">{label}</div>
            {active && (
              <span className="rounded-full bg-indigo-500/20 px-2 py-0.5 text-[10px] font-bold text-indigo-200">
                Active
              </span>
            )}
          </div>
          {subtitle && <div className="mt-1 truncate text-xs text-white/60">{subtitle}</div>}
        </div>

        {onClose && (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                onClose();
              }
            }}
            className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white transition"
            aria-label="Close tab"
            title="Close tab"
          >
            <span className="text-sm leading-none">x</span>
          </span>
        )}
      </div>
    </button>
  );
};

export default function SessionTabs({
  active,
  botOpen,
  psychologistOpen,
  psychologistDisabled,
  onSelect,
  onCloseTab,
  onReopenTab
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      {botOpen ? (
        <TabButton
          label="Chatbot"
          subtitle="Private AI assistant"
          active={active === 'bot'}
          onClick={() => onSelect('bot')}
          onClose={() => onCloseTab('bot')}
        />
      ) : (
        <button
          type="button"
          onClick={() => onReopenTab('bot')}
          className="flex-1 rounded-2xl border border-dashed border-white/15 bg-white/5 px-4 py-3 text-left text-sm font-semibold text-white/70 hover:bg-white/10 transition"
        >
          Reopen Chatbot
        </button>
      )}

      {psychologistOpen ? (
        <TabButton
          label="Psychologist"
          subtitle={psychologistDisabled ? 'Offline' : 'Live chat'}
          active={active === 'psychologist'}
          disabled={psychologistDisabled}
          onClick={() => onSelect('psychologist')}
          onClose={() => onCloseTab('psychologist')}
        />
      ) : (
        <button
          type="button"
          onClick={() => onReopenTab('psychologist')}
          className="flex-1 rounded-2xl border border-dashed border-white/15 bg-white/5 px-4 py-3 text-left text-sm font-semibold text-white/70 hover:bg-white/10 transition"
        >
          Reopen Psychologist
        </button>
      )}
    </div>
  );
}

