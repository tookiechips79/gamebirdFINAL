import React, { useState, useEffect } from 'react';
import { useGame } from '@/contexts/GameContext';
import { useNavigate } from 'react-router-dom';
import { GameRecord } from '@/types';
import Header from '@/components/layout/Header';

function fmt(s: number) {
  const m = Math.floor(s / 60).toString().padStart(2, '0');
  return `${m}:${(s % 60).toString().padStart(2, '0')}`;
}

function LiveQueue() {
  const { game } = useGame();
  const { teamAName, teamBName, teamAQueue, teamBQueue, bookedBets, totalBookedAmount } = game;
  const bookedIds = new Set(bookedBets.flatMap(bb => [bb.betIdA, bb.betIdB]));
  const hasAny = teamAQueue.length > 0 || teamBQueue.length > 0;
  const matchedCount = bookedBets.length;

  return (
    <div className="hud-panel bracket overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--border)]">
        <div className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full"
            style={{ background: 'var(--green)', boxShadow: '0 0 6px var(--green)', animation: 'liveDot 1s ease-in-out infinite' }}
          />
          <span className="mono text-xs tracking-widest" style={{ color: 'var(--green)' }}>LIVE — GAME #{game.currentGameNumber}</span>
        </div>
        <div className="flex items-center gap-3 mono text-xs">
          <span style={{ color: 'var(--green)' }}>{matchedCount} MATCHED</span>
          <span style={{ color: 'var(--gold)', fontWeight: 700 }}>{totalBookedAmount * 2} ITM</span>
        </div>
      </div>

      {!hasAny ? (
        <div className="px-4 py-6 text-center text-xs text-[var(--text)] mono tracking-widest">
          NO BETS PLACED YET
        </div>
      ) : (
        <div className="grid grid-cols-2 divide-x divide-[var(--border)]">
          <div>
            <div className="px-3 py-2 text-xs font-black uppercase tracking-widest border-b border-[var(--border)]"
              style={{ color: 'var(--cyan)', background: 'rgba(0,229,255,0.04)' }}>
              {teamAName}
            </div>
            {teamAQueue.length === 0
              ? <div className="px-3 py-3 text-xs text-[var(--text)]">No bets</div>
              : teamAQueue.map(bet => {
                const matched = bookedIds.has(bet.id);
                return (
                  <div key={bet.id} className="flex items-center justify-between px-3 py-2 border-b border-[var(--border)] last:border-0"
                    style={{ borderLeft: `3px solid ${bet.color || 'transparent'}` }}>
                    <span className="text-sm font-semibold truncate" style={{ color: bet.color || 'var(--text)' }}>{bet.userName}</span>
                    <div className="flex items-center gap-1.5">
                      <span className="mono text-sm font-bold" style={{ color: matched ? 'var(--green)' : 'var(--cyan)' }}>{bet.amount}</span>
                      {matched && <span className="text-xs" style={{ color: 'var(--green)' }}>✓</span>}
                    </div>
                  </div>
                );
              })
            }
          </div>
          <div>
            <div className="px-3 py-2 text-xs font-black uppercase tracking-widest border-b border-[var(--border)]"
              style={{ color: 'var(--red)', background: 'rgba(255,0,64,0.04)' }}>
              {teamBName}
            </div>
            {teamBQueue.length === 0
              ? <div className="px-3 py-3 text-xs text-[var(--text)]">No bets</div>
              : teamBQueue.map(bet => {
                const matched = bookedIds.has(bet.id);
                return (
                  <div key={bet.id} className="flex items-center justify-between px-3 py-2 border-b border-[var(--border)] last:border-0"
                    style={{ borderLeft: `3px solid ${bet.color || 'transparent'}` }}>
                    <span className="text-sm font-semibold truncate" style={{ color: bet.color || 'var(--text)' }}>{bet.userName}</span>
                    <div className="flex items-center gap-1.5">
                      <span className="mono text-sm font-bold" style={{ color: matched ? 'var(--green)' : 'var(--red)' }}>{bet.amount}</span>
                      {matched && <span className="text-xs" style={{ color: 'var(--green)' }}>✓</span>}
                    </div>
                  </div>
                );
              })
            }
          </div>
        </div>
      )}
    </div>
  );
}

function HistoryCard({ record }: { record: GameRecord }) {
  const [open, setOpen] = useState(false);
  const isAWin = record.winningTeam === 'A';
  const winnerName = isAWin ? record.teamAName : record.teamBName;
  const winnerColor = isAWin ? 'var(--cyan)' : 'var(--red)';
  const totalBets = record.bets.teamA.length + record.bets.teamB.length;

  return (
    <div className="hud-panel overflow-hidden">
      <button
        className="w-full flex items-center gap-3 px-4 py-3 transition-colors hover:bg-white/[0.02]"
        onClick={() => setOpen(v => !v)}
      >
        <span className="mono text-xs flex-shrink-0" style={{ color: 'var(--text)', minWidth: 32 }}>
          #{record.gameNumber}
        </span>

        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="font-bold text-sm truncate"
            style={{ color: isAWin ? 'var(--cyan)' : 'var(--text)', textShadow: isAWin ? '0 0 2px rgba(0,229,255,0.4)' : 'none' }}>
            {record.teamAName}
          </span>
          <span className="text-xs text-[var(--text)] flex-shrink-0">vs</span>
          <span className="font-bold text-sm truncate"
            style={{ color: !isAWin ? 'var(--red)' : 'var(--text)', textShadow: !isAWin ? '0 0 2px rgba(255,0,64,0.4)' : 'none' }}>
            {record.teamBName}
          </span>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0 mono text-xs">
          {totalBets > 0 && (
            <span style={{ color: 'var(--gold)', fontWeight: 700 }}>{record.totalAmount * 2} ITM</span>
          )}
          <span style={{ color: 'var(--text)' }}>{fmt(record.duration)}</span>
          <span style={{ color: 'rgba(255,255,255,0.3)' }}>
            {new Date(record.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
          <span style={{ color: winnerColor, textShadow: `0 0 3px ${winnerColor}`, fontWeight: 900 }}>
            {winnerName.toUpperCase()} ★
          </span>
          <span style={{ color: 'var(--text)' }}>{open ? '▲' : '▼'}</span>
        </div>
      </button>

      {open && (
        <div className="border-t border-[var(--border)]">
          {/* Winner banner */}
          <div className="px-4 py-2 flex items-center gap-2"
            style={{ background: isAWin ? 'rgba(0,229,255,0.06)' : 'rgba(255,0,64,0.06)' }}>
            <span style={{ color: winnerColor, textShadow: `0 0 3px ${winnerColor}` }}>★</span>
            <span className="mono text-xs font-black uppercase tracking-widest" style={{ color: winnerColor }}>
              {winnerName} WINS
            </span>
            <span className="mono text-xs ml-auto" style={{ color: 'var(--text)' }}>
              {record.teamABalls ?? record.teamAScore} – {record.teamBBalls ?? record.teamBScore} balls
            </span>
          </div>

          {totalBets === 0 ? (
            <div className="px-4 py-4 text-center text-xs text-[var(--text)] mono tracking-wider">
              NO MATCHED BETS THIS GAME
            </div>
          ) : (
            <div className="grid grid-cols-2 divide-x divide-[var(--border)]">
              {/* Team A */}
              <div>
                <div className="px-3 py-2 text-xs font-black uppercase tracking-widest border-b border-[var(--border)]"
                  style={{ color: 'var(--cyan)', background: 'rgba(0,229,255,0.04)' }}>
                  {record.teamAName}
                </div>
                {record.bets.teamA.length === 0
                  ? <div className="px-3 py-3 text-xs text-[var(--text)]">No bets</div>
                  : record.bets.teamA.map((bet, i) => (
                    <div key={i} className="px-3 py-2 border-b border-[var(--border)] last:border-0">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold">{bet.userName}</span>
                        <div className="flex items-center gap-1.5 mono text-sm font-bold">
                          <span style={{ color: bet.won ? 'var(--green)' : 'var(--red)' }}>
                            {bet.won ? '+' : '-'}{bet.amount}
                          </span>
                          <span style={{ color: bet.won ? 'var(--green)' : 'var(--red)' }}>{bet.won ? '✓' : '✗'}</span>
                        </div>
                      </div>
                      {bet.startingBalance != null && (
                        <div className="mono text-xs mt-0.5" style={{ color: 'rgba(0,229,255,0.35)' }}>
                          bal before: {bet.startingBalance}
                        </div>
                      )}
                    </div>
                  ))
                }
              </div>

              {/* Team B */}
              <div>
                <div className="px-3 py-2 text-xs font-black uppercase tracking-widest border-b border-[var(--border)]"
                  style={{ color: 'var(--red)', background: 'rgba(255,0,64,0.04)' }}>
                  {record.teamBName}
                </div>
                {record.bets.teamB.length === 0
                  ? <div className="px-3 py-3 text-xs text-[var(--text)]">No bets</div>
                  : record.bets.teamB.map((bet, i) => (
                    <div key={i} className="px-3 py-2 border-b border-[var(--border)] last:border-0">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold">{bet.userName}</span>
                        <div className="flex items-center gap-1.5 mono text-sm font-bold">
                          <span style={{ color: bet.won ? 'var(--green)' : 'var(--red)' }}>
                            {bet.won ? '+' : '-'}{bet.amount}
                          </span>
                          <span style={{ color: bet.won ? 'var(--green)' : 'var(--red)' }}>{bet.won ? '✓' : '✗'}</span>
                        </div>
                      </div>
                      {bet.startingBalance != null && (
                        <div className="mono text-xs mt-0.5" style={{ color: 'rgba(255,0,64,0.35)' }}>
                          bal before: {bet.startingBalance}
                        </div>
                      )}
                    </div>
                  ))
                }
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function Whitebook() {
  const { game, gameHistory, clearHistory, isAdmin } = useGame();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isAdmin) navigate('/arena');
  }, [isAdmin]);

  if (!isAdmin) return null;

  const totalITM = gameHistory.reduce((s, r) => s + r.totalAmount * 2, 0);
  const totalGames = gameHistory.length;

  return (
    <div className="flex flex-col" style={{ minHeight: "100dvh", background: 'var(--bg)' }}>
      <Header />

      <main className="flex-1 w-full max-w-2xl mx-auto px-3 py-4 flex flex-col gap-3">

        {/* Title row */}
        <div className="hud-panel bracket px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black uppercase tracking-widest" style={{ color: 'var(--cyan)', textShadow: '0 0 8px rgba(0,229,255,0.2)' }}>
              Whitebook
            </h1>
            <p className="mono text-xs text-[var(--text)] tracking-wider mt-0.5">LEDGER — ALL BETS ON RECORD</p>
          </div>
          <div className="flex items-center gap-4">
            {totalGames > 0 && (
              <div className="flex flex-col items-end gap-0.5">
                <span className="mono text-sm font-black" style={{ color: 'var(--gold)', textShadow: '0 0 3px rgba(255,215,0,0.5)' }}>
                  {totalITM.toLocaleString()}
                </span>
                <span className="mono text-xs text-[var(--text)]">ALL-TIME ITM</span>
              </div>
            )}
            {isAdmin && gameHistory.length > 0 && (
              <button
                className="btn btn-ghost px-3 py-1.5 text-xs"
                onClick={() => confirm('Clear all history?') && clearHistory()}
              >
                CLEAR
              </button>
            )}
          </div>
        </div>

        {/* Live queue */}
        <LiveQueue />

        {/* History */}
        {gameHistory.length > 0 ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3 px-1">
              <span className="mono text-xs text-[var(--text)] tracking-widest">GAME HISTORY</span>
              <div className="flex-1 border-t border-[var(--border)]" />
              <span className="mono text-xs text-[var(--text)]">{totalGames} GAMES</span>
            </div>
            {gameHistory.map(r => <HistoryCard key={r.id} record={r} />)}
          </div>
        ) : (
          <div className="hud-panel px-4 py-10 text-center flex flex-col items-center gap-2">
            <span className="text-2xl" style={{ color: 'var(--text)', opacity: 0.3 }}>◈</span>
            <span className="mono text-xs text-[var(--text)] tracking-widest">
              NO COMPLETED GAMES YET — HISTORY APPEARS HERE AFTER EACH WIN
            </span>
          </div>
        )}

      </main>
    </div>
  );
}
