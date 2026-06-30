import React, { useState, useEffect, useRef } from 'react';
import { useGame } from '@/contexts/GameContext';

interface Metadata {
  playerA: string;
  playerB: string;
  spot: string;
  raceTo: string;
  amountBet: string;
  location: string;
}

const empty: Metadata = { playerA: '', playerB: '', spot: '', raceTo: '', amountBet: '', location: '' };

function formatDescription(m: Metadata): string {
  const parts = [
    m.playerA && m.playerB ? `${m.playerA} VS ${m.playerB}` : '',
    m.spot,
    m.raceTo ? `RACE TO ${m.raceTo}` : '',
    m.amountBet ? `$${m.amountBet}` : '',
    m.location,
  ].filter(Boolean);
  return parts.join('  ★  ');
}

export default function GameDescription({ hideAdminControls }: { hideAdminControls?: boolean }) {
  const { game, isAdmin: isAdminCtx, updateGame } = useGame();
  const gameType = game.gameType || '';
  const isAdmin = isAdminCtx && !hideAdminControls;
  const description = game.gameDescription || '';
  const [editing, setEditing] = useState(false);
  const [meta, setMeta] = useState<Metadata>(empty);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<number>(0);

  const handleEdit = () => {
    setMeta(empty);
    setGameTypeInput(gameType);
    setEditing(true);
  };

  const [gameTypeInput, setGameTypeInput] = useState('');

  const handleSave = () => {
    updateGame({ gameDescription: formatDescription(meta), gameType: gameTypeInput });
    setEditing(false);
  };

  const handleClear = () => {
    updateGame({ gameDescription: '' });
    setEditing(false);
  };

  // Auto-scroll ticker
  useEffect(() => {
    if (!description || editing) return;
    const el = scrollerRef.current;
    if (!el) return;

    let pos = 0;
    const tick = () => {
      pos += 1.2;
      const half = el.scrollWidth / 3;
      if (pos >= half) pos = 0;
      el.scrollLeft = pos;
      animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animRef.current);
  }, [description, editing]);

  if (editing) {
    return (
      <>
        {/* Backdrop */}
        <div className="fixed inset-0 z-[200]" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={() => setEditing(false)} />

        {/* Modal */}
        <div className="fixed z-[201] top-1/2 left-1/2" style={{ transform: 'translate(-50%, -50%)', width: '90%', maxWidth: 520, background: '#0a0a18', border: '1px solid var(--gold)', padding: 28 }}>
          <div className="flex items-center justify-between mb-5">
            <span className="mono text-sm font-black tracking-[0.25em] uppercase" style={{ color: 'var(--gold)' }}>Game Info</span>
            <button className="btn btn-ghost px-2 py-1 text-xs" onClick={() => setEditing(false)}>✕</button>
          </div>

          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: 'playerA', label: 'Player A' },
                { key: 'playerB', label: 'Player B' },
              ].map(({ key, label }) => (
                <div key={key} className="flex flex-col gap-1.5">
                  <span className="text-xs mono tracking-widest uppercase" style={{ color: 'var(--text-dim)' }}>{label}</span>
                  <input
                    autoFocus={key === 'playerA'}
                    className="bg-transparent border border-[var(--border)] px-3 py-2 text-sm mono outline-none focus:border-[var(--cyan)]"
                    style={{ color: 'var(--text)' }}
                    placeholder={label}
                    value={(meta as any)[key]}
                    onChange={e => setMeta(p => ({ ...p, [key]: e.target.value }))}
                  />
                </div>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-3">
              {[
                { key: 'spot', label: 'Spot / Game Type' },
                { key: 'raceTo', label: 'Race To' },
                { key: 'amountBet', label: 'Stake ($)' },
              ].map(({ key, label }) => (
                <div key={key} className="flex flex-col gap-1.5">
                  <span className="text-xs mono tracking-widest uppercase" style={{ color: 'var(--text-dim)' }}>{label}</span>
                  <input
                    className="bg-transparent border border-[var(--border)] px-3 py-2 text-sm mono outline-none focus:border-[var(--cyan)]"
                    style={{ color: 'var(--text)' }}
                    placeholder={label}
                    value={(meta as any)[key]}
                    onChange={e => setMeta(p => ({ ...p, [key]: e.target.value }))}
                  />
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <span className="text-xs mono tracking-widest uppercase" style={{ color: 'var(--text-dim)' }}>Location</span>
                <input
                  className="bg-transparent border border-[var(--border)] px-3 py-2 text-sm mono outline-none focus:border-[var(--cyan)]"
                  style={{ color: 'var(--text)' }}
                  placeholder="Location"
                  value={meta.location}
                  onChange={e => setMeta(p => ({ ...p, location: e.target.value }))}
                  onKeyDown={e => e.key === 'Enter' && handleSave()}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-xs mono tracking-widest uppercase" style={{ color: 'var(--text-dim)' }}>Game Type</span>
                <input
                  className="bg-transparent border border-[var(--border)] px-3 py-2 text-sm mono outline-none focus:border-[var(--gold)]"
                  style={{ color: 'var(--gold)' }}
                  placeholder="e.g. 1 Pocket"
                  value={gameTypeInput}
                  onChange={e => setGameTypeInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSave()}
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-2 border-t border-[var(--border)]">
              <button className="btn btn-ghost px-4 py-2 text-xs" onClick={handleClear}>CLEAR</button>
              <button className="btn btn-ghost px-4 py-2 text-xs" onClick={() => setEditing(false)}>CANCEL</button>
              <button className="btn btn-cyan px-6 py-2 text-xs font-black tracking-widest" onClick={handleSave}>SAVE</button>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <div
      className="hud-panel w-full flex items-center overflow-hidden relative"
      style={{ minHeight: 42 }}
    >
      {/* Scrolling ticker */}
      <div
        ref={scrollerRef}
        className="flex-1 overflow-hidden whitespace-nowrap px-4 py-2.5"
        style={{ msOverflowStyle: 'none', scrollbarWidth: 'none' } as React.CSSProperties}
      >
        {description ? (
          <span>
            {[description, description, description].map((d, i) => (
              <span
                key={i}
                className="mono font-black text-sm uppercase tracking-widest"
                style={{ color: 'var(--gold)', textShadow: '0 0 3px rgba(255,215,0,0.5)', marginRight: '4rem' }}
              >
                {d}
              </span>
            ))}
          </span>
        ) : (
          <span className="text-xs mono text-[var(--text)] tracking-widest">
            {isAdmin ? 'NO GAME INFO — CLICK EDIT TO ADD' : 'NO GAME INFO'}
          </span>
        )}
      </div>

      {/* Edit button (admin only) */}
      {isAdmin && (
        <button
          className="flex-shrink-0 btn btn-ghost px-3 py-1.5 text-xs mr-2"
          onClick={handleEdit}
        >
          EDIT
        </button>
      )}
    </div>
  );
}
