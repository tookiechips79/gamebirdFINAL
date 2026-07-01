import React, { useState } from 'react';
import { useUser } from '@/contexts/UserContext';
import { useGame } from '@/contexts/GameContext';
import { AdminAuditEventType } from '@/types';

type Tab = 'snapshots' | 'balances' | 'activity' | 'drift';

const EVENT_LABELS: Record<AdminAuditEventType, { label: string; color: string }> = {
  admin_add:    { label: 'ADMIN ADD',    color: 'var(--cyan)' },
  admin_deduct: { label: 'ADMIN DEDUCT', color: 'var(--red)' },
  user_created: { label: 'USER CREATED', color: 'var(--green)' },
  user_deleted: { label: 'USER DELETED', color: 'var(--red)' },
  reload:       { label: 'RELOAD',       color: 'var(--gold)' },
  tip:          { label: 'TIP',          color: 'var(--gold)' },
  transfer:     { label: 'P2P TRANSFER', color: 'var(--cyan)' },
};

export default function CoinAuditLog({ onClose }: { onClose: () => void }) {
  const { coinAuditLog, acknowledgeAudit, clearAuditLog, adminAuditLog, clearAdminAudit, playerSnaps, clearPlayerSnaps } = useUser();
  const { game, gameHistory, clearHistory } = useGame();
  const [tab, setTab] = useState<Tab>('snapshots');
  const [expandedSnap, setExpandedSnap] = useState<string | null>(null);

  const unacked = coinAuditLog.filter(e => !e.acknowledged).length;

  // Per-game drift summary derived from playerSnaps (all-user before/after, reliable source)
  const gameDriftRows = playerSnaps.map(snap => {
    const totalBefore = snap.players.reduce((s, p) => s + p.before, 0);
    const totalAfter  = snap.players.reduce((s, p) => s + p.after,  0);
    const record = gameHistory.find(r => r.gameNumber === snap.gameNumber);
    return { snap, record, totalBefore, totalAfter, drift: totalAfter - totalBefore };
  });
  const driftAlerts = gameDriftRows.filter(r => r.drift !== 0).length;

  const tabStyle = (t: Tab) => ({
    flex: 1,
    padding: '8px 0',
    fontSize: 11,
    fontFamily: 'monospace',
    fontWeight: 900,
    letterSpacing: '0.2em',
    background: 'transparent',
    border: 'none',
    borderBottom: tab === t ? '2px solid var(--gold)' : '2px solid transparent',
    color: tab === t ? 'var(--gold)' : 'rgba(255,255,255,0.3)',
    cursor: 'pointer',
  } as React.CSSProperties);

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.75)' }} onClick={onClose}>
      <div
        className="flex flex-col"
        style={{ background: '#0a0a18', border: '1px solid rgba(255,215,0,0.3)', width: '90%', maxWidth: 660, maxHeight: '82vh', borderRadius: 4 }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: 'rgba(255,215,0,0.15)', flexShrink: 0 }}>
          <div className="flex items-center gap-3">
            <span className="mono text-sm font-black tracking-[0.25em]" style={{ color: 'var(--gold)' }}>COIN AUDIT</span>
            {driftAlerts > 0 && (
              <button
                className="mono text-xs font-black px-2 py-0.5"
                style={{ background: 'rgba(255,0,64,0.15)', color: 'var(--red)', border: '1px solid rgba(255,0,64,0.4)', cursor: 'pointer' }}
                onClick={() => setTab('drift')}
              >
                ⚠ {driftAlerts} ALERT{driftAlerts > 1 ? 'S' : ''}
              </button>
            )}
          </div>
          <button className="btn btn-ghost px-2 py-1 text-xs" onClick={onClose}>✕</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b" style={{ borderColor: 'rgba(255,215,0,0.1)', flexShrink: 0 }}>
          <button style={tabStyle('snapshots')} onClick={() => setTab('snapshots')}>
            GAME BAL ({gameHistory.length})
          </button>
          <button style={tabStyle('balances')} onClick={() => setTab('balances')}>
            PLAYERS ({playerSnaps.length})
          </button>
          <button style={tabStyle('activity')} onClick={() => setTab('activity')}>
            ACTIVITY ({adminAuditLog.length})
          </button>
          <button style={tabStyle('drift')} onClick={() => setTab('drift')}>
            DRIFT {driftAlerts > 0 ? `⚠ (${driftAlerts})` : `(${gameHistory.length})`}
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">

          {/* ── Game Balances (from Whitebook history) ── */}
          {tab === 'snapshots' && (
            <>
              {gameHistory.length === 0 ? (
                <div className="flex items-center justify-center h-32 mono text-xs tracking-widest" style={{ color: 'rgba(255,255,255,0.2)' }}>
                  NO GAMES RECORDED YET
                </div>
              ) : (
                <div className="flex flex-col divide-y" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                  {gameHistory.map(record => {
                    const isOpen = expandedSnap === record.id;
                    const winnerName = record.winningTeam === 'A' ? record.teamAName : record.teamBName;

                    // Build per-player view from GameRecord bets (same data as Whitebook)
                    const playerMap: Record<string, { name: string; bets: { opponentName: string; amount: number; won: boolean; startingBalance?: number }[] }> = {};
                    record.bets.teamA.forEach((b, i) => {
                      if (!playerMap[b.userId]) playerMap[b.userId] = { name: b.userName, bets: [] };
                      playerMap[b.userId].bets.push({ opponentName: record.bets.teamB[i]?.userName ?? '?', amount: b.amount, won: b.won, startingBalance: b.startingBalance });
                    });
                    record.bets.teamB.forEach((b, i) => {
                      if (!playerMap[b.userId]) playerMap[b.userId] = { name: b.userName, bets: [] };
                      playerMap[b.userId].bets.push({ opponentName: record.bets.teamA[i]?.userName ?? '?', amount: b.amount, won: b.won, startingBalance: b.startingBalance });
                    });
                    const players = Object.entries(playerMap).map(([userId, data]) => {
                      const before = data.bets[0]?.startingBalance ?? 0;
                      const net = data.bets.reduce((s, b) => s + (b.won ? b.amount : -b.amount), 0);
                      return { userId, name: data.name, before, after: before + net, bets: data.bets };
                    });
                    const totalBefore = players.reduce((s, p) => s + p.before, 0);
                    const totalAfter = players.reduce((s, p) => s + p.after, 0);
                    const change = totalAfter - totalBefore;

                    return (
                      <div key={record.id}>
                        <button
                          className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-black transition-colors"
                          onClick={() => setExpandedSnap(isOpen ? null : record.id)}
                        >
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-2">
                              <span className="mono text-xs font-black" style={{ color: record.winningTeam === 'A' ? 'var(--cyan)' : 'var(--red)' }}>
                                GAME #{record.gameNumber}
                              </span>
                              <span className="mono text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
                                {winnerName.toUpperCase()} WINS
                              </span>
                            </div>
                            <span className="mono text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>
                              {new Date(record.timestamp).toLocaleString()}
                            </span>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="flex flex-col items-end gap-0.5">
                              <div className="flex items-center gap-2 mono text-xs">
                                <span style={{ color: 'rgba(255,255,255,0.4)' }}>BEFORE</span>
                                <span style={{ color: 'var(--text)' }}>{totalBefore.toLocaleString()}</span>
                              </div>
                              <div className="flex items-center gap-2 mono text-xs">
                                <span style={{ color: 'rgba(255,255,255,0.4)' }}>AFTER</span>
                                <span style={{ color: 'var(--text)' }}>{totalAfter.toLocaleString()}</span>
                              </div>
                            </div>
                            <span className="mono text-xs font-black w-16 text-right" style={{ color: change === 0 ? 'var(--green)' : 'var(--red)' }}>
                              {change === 0 ? '✓ CLEAN' : `${change > 0 ? '+' : ''}${change}`}
                            </span>
                            <span className="mono text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>{isOpen ? '▲' : '▼'}</span>
                          </div>
                        </button>

                        {isOpen && (
                          <div className="px-5 pb-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                            <div className="flex flex-col gap-3 mt-3">
                              <div className="grid" style={{ gridTemplateColumns: '1fr 72px 72px 64px' }}>
                                <span className="mono text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>PLAYER</span>
                                <span className="mono text-xs text-right" style={{ color: 'rgba(255,255,255,0.2)' }}>BEFORE</span>
                                <span className="mono text-xs text-right" style={{ color: 'rgba(255,255,255,0.2)' }}>AFTER</span>
                                <span className="mono text-xs text-right" style={{ color: 'rgba(255,255,255,0.2)' }}>NET</span>
                              </div>
                              {players.map(p => {
                                const net = p.after - p.before;
                                return (
                                  <div key={p.userId}>
                                    <div className="grid items-center" style={{ gridTemplateColumns: '1fr 72px 72px 64px' }}>
                                      <span className="mono text-xs font-black" style={{ color: 'var(--text)' }}>{p.name}</span>
                                      <span className="mono text-xs text-right" style={{ color: 'rgba(255,255,255,0.4)' }}>{p.before.toLocaleString()}</span>
                                      <span className="mono text-xs text-right" style={{ color: 'rgba(255,255,255,0.4)' }}>{p.after.toLocaleString()}</span>
                                      <span className="mono text-xs font-black text-right" style={{ color: net > 0 ? 'var(--green)' : net < 0 ? 'var(--red)' : 'rgba(255,255,255,0.2)' }}>
                                        {net > 0 ? `+${net}` : net < 0 ? `${net}` : '—'}
                                      </span>
                                    </div>
                                    {p.bets.map((b, i) => (
                                      <div key={i} className="mt-1 pl-3" style={{ borderLeft: '1px solid rgba(255,255,255,0.08)' }}>
                                        <div className="flex items-center gap-2">
                                          <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 10 }}>└</span>
                                          <span className="mono text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>vs {b.opponentName}</span>
                                          <span className="mono text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>{b.amount} coins</span>
                                          <span className="mono text-xs font-black" style={{ color: b.won ? 'var(--green)' : 'var(--red)' }}>
                                            {b.won ? 'WON' : 'LOST'}
                                          </span>
                                        </div>
                                        {b.startingBalance != null && (
                                          <div className="mono text-xs ml-4" style={{ color: 'rgba(0,229,255,0.35)' }}>
                                            bal before: {b.startingBalance}
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                );
                              })}
                              <div className="grid items-center pt-2 border-t" style={{ gridTemplateColumns: '1fr 72px 72px 64px', borderColor: 'rgba(255,255,255,0.08)' }}>
                                <span className="mono text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>TOTAL</span>
                                <span className="mono text-xs text-right" style={{ color: 'rgba(255,255,255,0.25)' }}>{totalBefore.toLocaleString()}</span>
                                <span className="mono text-xs text-right" style={{ color: 'rgba(255,255,255,0.25)' }}>{totalAfter.toLocaleString()}</span>
                                <span className="mono text-xs font-black text-right" style={{ color: change === 0 ? 'var(--green)' : 'var(--red)' }}>
                                  {change === 0 ? '✓ CLEAN' : `${change > 0 ? '+' : ''}${change}`}
                                </span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              {gameHistory.length > 0 && (
                <div className="flex justify-end px-5 py-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                  <button
                    className="btn btn-ghost px-3 py-1 text-xs"
                    style={{ color: 'rgba(255,255,255,0.3)' }}
                    onClick={() => { if (confirm('Clear game balance history?')) clearHistory(); }}
                  >
                    CLEAR HISTORY
                  </button>
                </div>
              )}
            </>
          )}

          {/* ── Player Balance Snapshots ── */}
          {tab === 'balances' && (
            <>
              {playerSnaps.length === 0 ? (
                <div className="flex items-center justify-center h-32 mono text-xs tracking-widest" style={{ color: 'rgba(255,255,255,0.2)' }}>
                  NO SNAPSHOTS YET — PLAY A GAME
                </div>
              ) : (
                <div className="flex flex-col divide-y" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                  {playerSnaps.map(snap => {
                    const isOpen = expandedSnap === snap.id;
                    return (
                      <div key={snap.id}>
                        <button
                          className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-black transition-colors"
                          onClick={() => setExpandedSnap(isOpen ? null : snap.id)}
                        >
                          <div className="flex flex-col gap-0.5">
                            <span className="mono text-xs font-black" style={{ color: snap.winningTeam === 'A' ? 'var(--cyan)' : 'var(--red)' }}>
                              GAME #{snap.gameNumber}
                            </span>
                            <span className="mono text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>
                              {new Date(snap.timestamp).toLocaleString()}
                            </span>
                          </div>
                          <span className="mono text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>{isOpen ? '▲' : '▼'}</span>
                        </button>
                        {isOpen && (
                          <div className="px-5 pb-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                            <div className="flex flex-col gap-2 mt-3">
                              <div className="grid" style={{ gridTemplateColumns: '1fr 72px 72px 64px' }}>
                                <span className="mono text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>PLAYER</span>
                                <span className="mono text-xs text-right" style={{ color: 'rgba(255,255,255,0.2)' }}>BEFORE</span>
                                <span className="mono text-xs text-right" style={{ color: 'rgba(255,255,255,0.2)' }}>AFTER</span>
                                <span className="mono text-xs text-right" style={{ color: 'rgba(255,255,255,0.2)' }}>NET</span>
                              </div>
                              {snap.players.map(p => {
                                const net = p.after - p.before;
                                return (
                                  <div key={p.userId} className="grid items-center" style={{ gridTemplateColumns: '1fr 72px 72px 64px' }}>
                                    <span className="mono text-xs font-black" style={{ color: 'var(--text)' }}>{p.name}</span>
                                    <span className="mono text-xs text-right" style={{ color: 'rgba(255,255,255,0.4)' }}>{p.before.toLocaleString()}</span>
                                    <span className="mono text-xs text-right" style={{ color: 'rgba(255,255,255,0.4)' }}>{p.after.toLocaleString()}</span>
                                    <span className="mono text-xs font-black text-right" style={{ color: net > 0 ? 'var(--green)' : net < 0 ? 'var(--red)' : 'rgba(255,255,255,0.2)' }}>
                                      {net > 0 ? `+${net}` : net < 0 ? `${net}` : '—'}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              {playerSnaps.length > 0 && (
                <div className="flex justify-end px-5 py-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                  <button
                    className="btn btn-ghost px-3 py-1 text-xs"
                    style={{ color: 'rgba(255,255,255,0.3)' }}
                    onClick={() => { if (confirm('Clear player balance snapshots?')) clearPlayerSnaps(); }}
                  >
                    CLEAR
                  </button>
                </div>
              )}
            </>
          )}

          {/* ── Activity Log ── */}
          {tab === 'activity' && (
            <>
              {adminAuditLog.length === 0 ? (
                <div className="flex items-center justify-center h-32 mono text-xs tracking-widest" style={{ color: 'rgba(255,255,255,0.2)' }}>
                  NO ACTIVITY RECORDED YET
                </div>
              ) : (
                <div className="flex flex-col divide-y" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                  {adminAuditLog.map(entry => {
                    const ev = EVENT_LABELS[entry.type];
                    return (
                      <div key={entry.id} className="flex items-start gap-4 px-5 py-3">
                        <div className="flex flex-col gap-1 flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="mono text-xs font-black px-1.5 py-0.5" style={{ background: `${ev.color}18`, color: ev.color, border: `1px solid ${ev.color}44` }}>
                              {ev.label}
                            </span>
                            <span className="mono text-xs font-black" style={{ color: 'var(--text)' }}>
                              {entry.amount > 0 ? `${entry.type === 'admin_deduct' ? '-' : '+'}${entry.amount}` : ''}
                            </span>
                          </div>
                          {/* Receipt-style TO / FROM / BY labels */}
                          {entry.type === 'transfer' ? (
                            <div className="flex flex-col gap-0.5 mt-0.5 px-2 py-1.5 rounded" style={{ background: 'rgba(0,229,255,0.06)', border: '1px solid rgba(0,229,255,0.12)' }}>
                              <div className="mono text-xs flex items-center gap-2">
                                <span style={{ color: 'rgba(255,255,255,0.3)', minWidth: 24 }}>FROM</span>
                                <span style={{ color: 'var(--gold)', fontWeight: 900 }}>{entry.fromUserName}</span>
                              </div>
                              <div className="mono text-xs flex items-center gap-2">
                                <span style={{ color: 'rgba(255,255,255,0.3)', minWidth: 24 }}>TO</span>
                                <span style={{ color: 'var(--cyan)', fontWeight: 900 }}>{entry.toUserName}</span>
                              </div>
                              <div className="mono text-xs flex items-center gap-2">
                                <span style={{ color: 'rgba(255,255,255,0.3)', minWidth: 24 }}>AMT</span>
                                <span style={{ color: 'var(--green)', fontWeight: 900 }}>{entry.amount} coins</span>
                              </div>
                            </div>
                          ) : (entry.toUserName || entry.userName) && (entry.type === 'admin_add' || entry.type === 'admin_deduct' || entry.type === 'tip' || entry.type === 'reload') ? (
                            <>
                              <div className="mono text-xs flex items-center gap-2">
                                <span style={{ color: 'rgba(255,255,255,0.3)' }}>TO</span>
                                <span style={{ color: 'var(--cyan)', fontWeight: 900 }}>{entry.toUserName ?? entry.userName}</span>
                              </div>
                              <div className="mono text-xs flex items-center gap-2">
                                <span style={{ color: 'rgba(255,255,255,0.3)' }}>BY</span>
                                <span style={{ color: 'var(--gold)', fontWeight: 900 }}>{entry.fromUserName ?? 'Admin'}</span>
                              </div>
                            </>
                          ) : entry.type === 'user_created' || entry.type === 'user_deleted' ? (
                            <div className="mono text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>{entry.userName}</div>
                          ) : null}
                          <div className="mono text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>
                            {new Date(entry.timestamp).toLocaleString()}
                            {entry.balanceBefore !== undefined && entry.balanceAfter !== undefined && (
                              <span className="ml-3">
                                balance: <span style={{ color: 'rgba(255,255,255,0.4)' }}>{entry.balanceBefore}</span>
                                {' → '}
                                <span style={{ color: 'rgba(255,255,255,0.4)' }}>{entry.balanceAfter}</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {adminAuditLog.length > 0 && (
                <div className="flex justify-end px-5 py-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                  <button
                    className="btn btn-ghost px-3 py-1 text-xs"
                    style={{ color: 'rgba(255,255,255,0.3)' }}
                    onClick={() => { if (confirm('Clear activity log?')) clearAdminAudit(); }}
                  >
                    CLEAR LOG
                  </button>
                </div>
              )}
            </>
          )}

          {/* ── Drift Alerts ── */}
          {tab === 'drift' && (
            <>
              {gameDriftRows.length === 0 ? (
                <div className="flex items-center justify-center h-32 mono text-xs tracking-widest" style={{ color: 'rgba(255,255,255,0.2)' }}>
                  NO GAMES RECORDED YET
                </div>
              ) : (
                <div className="flex flex-col divide-y" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                  {gameDriftRows.map(({ snap, record, totalBefore, totalAfter, drift }) => {
                    const isOpen = expandedSnap === snap.id;
                    return (
                      <div key={snap.id} style={{ background: drift !== 0 ? 'rgba(255,0,64,0.04)' : 'transparent' }}>
                        <button
                          className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-black transition-colors"
                          onClick={() => setExpandedSnap(isOpen ? null : snap.id)}
                        >
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-2">
                              <span className="mono text-xs font-black" style={{ color: snap.winningTeam === 'A' ? 'var(--cyan)' : 'var(--red)' }}>
                                GAME #{snap.gameNumber}
                              </span>
                              <span className="mono text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>
                                {new Date(snap.timestamp).toLocaleString()}
                              </span>
                            </div>
                            <div className="mono text-xs flex gap-4 mt-0.5">
                              <span style={{ color: 'rgba(255,255,255,0.4)' }}>BEFORE <span style={{ color: 'var(--text)' }}>{totalBefore.toLocaleString()}</span></span>
                              <span style={{ color: 'rgba(255,255,255,0.4)' }}>AFTER <span style={{ color: 'var(--text)' }}>{totalAfter.toLocaleString()}</span></span>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="mono text-sm font-black" style={{ color: drift === 0 ? 'var(--green)' : 'var(--red)' }}>
                              {drift === 0 ? '✓ CLEAN' : `⚠ ${drift > 0 ? '+' : ''}${drift}`}
                            </span>
                            <span className="mono text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>{isOpen ? '▲' : '▼'}</span>
                          </div>
                        </button>
                        {isOpen && (
                          <div className="px-5 pb-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                            <div className="flex flex-col gap-2 mt-3">
                              <div className="grid" style={{ gridTemplateColumns: '1fr 72px 72px 64px' }}>
                                <span className="mono text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>PLAYER</span>
                                <span className="mono text-xs text-right" style={{ color: 'rgba(255,255,255,0.2)' }}>BEFORE</span>
                                <span className="mono text-xs text-right" style={{ color: 'rgba(255,255,255,0.2)' }}>AFTER</span>
                                <span className="mono text-xs text-right" style={{ color: 'rgba(255,255,255,0.2)' }}>NET</span>
                              </div>
                              {snap.players.map(p => {
                                const net = p.after - p.before;
                                return (
                                  <div key={p.userId} className="grid items-center" style={{ gridTemplateColumns: '1fr 72px 72px 64px' }}>
                                    <span className="mono text-xs font-black" style={{ color: drift !== 0 && net !== 0 ? 'var(--red)' : 'var(--text)' }}>{p.name}</span>
                                    <span className="mono text-xs text-right" style={{ color: 'rgba(255,255,255,0.4)' }}>{p.before.toLocaleString()}</span>
                                    <span className="mono text-xs text-right" style={{ color: 'rgba(255,255,255,0.4)' }}>{p.after.toLocaleString()}</span>
                                    <span className="mono text-xs font-black text-right" style={{ color: net > 0 ? 'var(--green)' : net < 0 ? 'var(--red)' : 'rgba(255,255,255,0.2)' }}>
                                      {net > 0 ? `+${net}` : net < 0 ? `${net}` : '—'}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
