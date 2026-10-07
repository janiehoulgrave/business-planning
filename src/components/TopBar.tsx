import React from 'react';
import { Check, CloudOff, Loader2, LogOut } from 'lucide-react';
import { APP_NAME } from '../config';
import { Agent, SaveStatus } from '../lib/store';

// Compass mark: 60 even ticks around a diagonal needle (traced from the supplied logo).
export const Mark: React.FC<{ size?: number }> = ({ size = 36 }) => (
  <svg width={size} height={size} viewBox="-600 -600 1200 1200" aria-hidden="true">
    <g stroke="currentColor" strokeWidth="11" strokeLinecap="butt" fill="none">
      {Array.from({ length: 60 }).map((_, i) => (
        <line key={i} x1="0" y1="-472" x2="0" y2="-581" transform={`rotate(${i * 6})`} />
      ))}
      <line x1="-262" y1="263" x2="263" y2="-262" />
    </g>
  </svg>
);

const SaveIndicator: React.FC<{ status: SaveStatus }> = ({ status }) => {
  if (status === 'idle') return null;
  const map = {
    saving: { icon: <Loader2 size={14} className="animate-spin" />, text: 'Saving' },
    saved: { icon: <Check size={14} />, text: 'Saved' },
    offline: { icon: <CloudOff size={14} />, text: 'Saved on this device only' },
  } as const;
  const s = map[status];
  return (
    <span className={`hidden sm:inline-flex items-center gap-1.5 text-[13px] ${status === 'offline' ? 'text-amber' : 'text-slate'}`}>
      {s.icon}
      {s.text}
    </span>
  );
};

export const TopBar: React.FC<{ agent: Agent | null; status: SaveStatus; onSignOut: () => void; onHome?: () => void }> = ({
  agent,
  status,
  onSignOut,
  onHome,
}) => (
  <header className="sticky top-0 z-40 bg-paper/90 backdrop-blur border-b border-line">
    <div className="max-w-5xl mx-auto h-16 px-5 flex items-center justify-between gap-4">
      <button
        type="button"
        onClick={onHome}
        disabled={!onHome}
        title={onHome ? 'Back to the start' : undefined}
        className="flex items-center gap-3 min-w-0 text-left rounded-lg -mx-1.5 px-1.5 py-1 enabled:hover:bg-mist disabled:cursor-default"
      >
        <Mark size={30} />
        <span className="leading-tight min-w-0">
          <span className="block font-bold text-[15px] tracking-[0.02em]">Compass</span>
          <span className="block text-[13px] text-slate truncate">{APP_NAME}</span>
        </span>
      </button>
      {agent && (
        <div className="flex items-center gap-4">
          <SaveIndicator status={status} />
          <div className="flex items-center gap-2.5">
            {agent.photo ? (
              <img src={agent.photo} alt="" className="w-8 h-8 rounded-full" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-ink text-paper grid place-items-center text-[13px] font-medium">
                {agent.name.slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="hidden md:block leading-tight">
              <div className="text-[14px] font-medium">{agent.name}</div>
              <div className="text-[12px] text-slate">{agent.email}</div>
            </div>
            <button onClick={onSignOut} className="ml-1 p-2 rounded-full text-slate hover:text-ink hover:bg-mist" title="Sign out" aria-label="Sign out">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  </header>
);
