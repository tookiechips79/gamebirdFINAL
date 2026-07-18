import React, { useState } from 'react';
import { useGame } from '@/contexts/GameContext';

function formatDuration(secs: number) {
  const m = Math.floor(secs / 60).toString().padStart(2, '0');
  const s = (secs % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default function GameHistory({ hideBallCount }: { hideBallCount?: boolean } = {}) {
  const { gameHistory, clearHistory, isAdmin, game } = useGame();
  const [open, setOpen] = useState(true);

  // Fallback to live names if record names are missing (old localStorage data)
  const fallbackA = game.teamAName;
  const fallbackB = game.teamBName;

  return (
    <div className="hud-panel bracket overflow-hidden">
      {/* Header */}
      <button
        className="w-full flex items-center justify-between px-4 py-2.5 border-b border-[var(--border)] hover:bg-black transition-colors"
        onClick={() => setOpen(v => !v)}
      >
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: 'var(--gold)', boxShadow: '0 0 3px rgba(255,215,0,0.4)' }} />
          <span className="text-xs mono font-black tracking-widest" style={{ color: 'var(--gold)' }}>GAME HISTORY</span>
          <span className="text-xs mono text-[var(--text)]">({gameHistory.length})</span>
        </div>
        <div className="flex items-center gap-3">
          {isAdmin && gameHistory.length > 0 && (
            <button
              className="btn btn-ghost px-2 py-0.5 text-xs"
              style={{ color: 'var(--red)' }}
              onClick={e => {
                e.stopPropagation();
                if (confirm('Clear all game history?')) clearHistory();
              }}
            >
              CLEAR
            </button>
          )}
          <span className="text-xs text-[var(--text)]">{open ? '▲' : '▼'}</span>
        </div>
      </button>

      {open && (
        <div className="flex flex-col divide-y divide-[var(--border)] max-h-72 overflow-y-auto">
          {gameHistory.length === 0 ? (
            <div className="flex items-center justify-center h-16 text-xs mono text-[var(--text)] tracking-widest">
              NO GAMES YET
            </div>
          ) : (
            gameHistory.map(record => {
              const nameA = (!record.teamAName || record.teamAName === 'Player A') ? fallbackA : record.teamAName;
              const nameB = (!record.teamBName || record.teamBName === 'Player B') ? fallbackB : record.teamBName;
              const winnerColor = record.winningTeam === 'A' ? 'var(--cyan)' : 'var(--red)';
              const winnerName = record.winningTeam === 'A' ? nameA : nameB;
              const loserName = record.winningTeam === 'A' ? nameB : nameA;
              return (
                <div
                  key={record.id}
                  className="flex items-center justify-between px-4 py-2.5 transition-colors"
                  onMouseEnter={e => (e.currentTarget.style.background = '#000')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  style={{ borderLeft: `3px solid ${winnerColor}` }}
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs mono font-black" style={{ color: winnerColor }}>
                      GAME #{record.gameNumber} — {winnerName.toUpperCase()} WINS
                    </span>
                    <span className="text-xs text-[var(--text)] mono tracking-wider">
                      {new Date(record.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      {'  ·  '}{formatDuration(record.duration ?? 0)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs mono flex-shrink-0">
                    {!hideBallCount && (
                      <div className="flex gap-1.5 items-center">
                        <span style={{ color: 'var(--cyan)' }}>{nameA} {record.teamABalls ?? record.teamAScore}</span>
                        <span className="text-[var(--text)]">–</span>
                        <span style={{ color: 'var(--red)' }}>{record.teamBBalls ?? record.teamBScore} {nameB}</span>
                      </div>
                    )}
                    <span style={{ color: 'var(--gold)', fontWeight: 700 }}>{record.totalAmount * 2} ITM</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
