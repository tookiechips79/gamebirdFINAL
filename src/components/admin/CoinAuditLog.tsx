import React, { useState } from 'react';
import { useUser } from '@/contexts/UserContext';
import { useGame } from '@/contexts/GameContext';
import { AdminAuditEventType } from '@/types';

type Tab = 'snapshots' | 'activity' | 'drift';

const EVENT_LABELS: Record<AdminAuditEventType, { label: string; color: string }> = {
  admin_add:    { label: 'ADMIN ADD',    color: 'var(--cyan)' },
  admin_deduct: { label: 'ADMIN DEDUCT', color: 'var(--red)' },
  user_created: { label: 'USER CREATED', color: 'var(--green)' },
  user_deleted: { label: 'USER DELETED', color: 'var(--red)' },
  reload:       { label: 'RELOAD',       color: 'var(--gold)' },
  tip:          { label: 'TIP',          color: 'var(--gold)' },
};

export default function CoinAuditLog({ onClose }: { onClose: () => void }) {
  const { coinAuditLog, acknowledgeAudit, clearAuditLog, gameSnapshots, clearSnapshots, adminAuditLog, clearAdminAudit } = useUser();
  const { game } = useGame();
  const [tab, setTab] = useState<Tab>('snapshots');
  const [expandedSnap, setExpandedSnap] = useState<string | null>(null);

  const unacked = coinAuditLog.filter(e => !e.acknowledged).length;

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
            {unacked > 0 && (
              <span className="mono text-xs font-black px-2 py-0.5" style={{ background: 'rgba(255,0,64,0.15)', color: 'var(--red)', border: '1px solid rgba(255,0,64,0.4)' }}>
                ⚠ {unacked} ALERT{unacked > 1 ? 'S' : ''}
              </span>
            )}
          </div>
          <button className="btn btn-ghost px-2 py-1 text-xs" onClick={onClose}>✕</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b" style={{ borderColor: 'rgba(255,215,0,0.1)', flexShrink: 0 }}>
          <button style={tabStyle('snapshots')} onClick={() => setTab('snapshots')}>
            GAME BALANCES ({gameSnapshots.length})
          </button>
          <button style={tabStyle('activity')} onClick={() => setTab('activity')}>
            ACTIVITY ({adminAuditLog.length})
          </button>
          <button style={tabStyle('drift')} onClick={() => setTab('drift')}>
            DRIFT {unacked > 0 ? `⚠ (${unacked})` : `(${coinAuditLog.length})`}
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">

          {/* ── Game Balance Snapshots ── */}
          {tab === 'snapshots' && (
            <>
              {gameSnapshots.length === 0 ? (
                <div className="flex items-center justify-center h-32 mono text-xs tracking-widest" style={{ color: 'rgba(255,255,255,0.2)' }}>
                  NO GAMES RECORDED YET
                </div>
              ) : (
                <div className="flex flex-col divide-y" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                  {gameSnapshots.map(snap => {
                    const isOpen = expandedSnap === snap.id;
                    const change = snap.totalAfter - snap.totalBefore;
                    const winnerName = snap.winningTeam === 'A' ? game.teamAName : game.teamBName;
                    return (
                      <div key={snap.id}>
                        <button
                          className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-black transition-colors"
                          onClick={() => setExpandedSnap(isOpen ? null : snap.id)}
                        >
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-2">
                              <span className="mono text-xs font-black" style={{ color: snap.winningTeam === 'A' ? 'var(--cyan)' : 'var(--red)' }}>
                                GAME #{snap.gameNumber}
                              </span>
                              <span className="mono text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
                                {winnerName.toUpperCase()} WINS
                              </span>
                            </div>
                            <span className="mono text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>
                              {new Date(snap.timestamp).toLocaleString()}
                            </span>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="flex flex-col items-end gap-0.5">
                              <div className="flex items-center gap-2 mono text-xs">
                                <span style={{ color: 'rgba(255,255,255,0.4)' }}>BEFORE</span>
                                <span style={{ color: 'var(--text)' }}>{snap.totalBefore.toLocaleString()}</span>
                              </div>
                              <div className="flex items-center gap-2 mono text-xs">
                                <span style={{ color: 'rgba(255,255,255,0.4)' }}>AFTER</span>
                                <span style={{ color: 'var(--text)' }}>{snap.totalAfter.toLocaleString()}</span>
                              </div>
                            </div>
                            <span
                              className="mono text-xs font-black w-16 text-right"
                              style={{ color: change === 0 ? 'var(--green)' : 'var(--red)' }}
                            >
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
                              {snap.players.map(p => {
                                const net = p.after - p.before;
                                return (
                                  <div key={p.userId}>
                                    {/* Player row */}
                                    <div className="grid items-center" style={{ gridTemplateColumns: '1fr 72px 72px 64px' }}>
                                      <span className="mono text-xs font-black" style={{ color: 'var(--text)' }}>{p.name}</span>
                                      <span className="mono text-xs text-right" style={{ color: 'rgba(255,255,255,0.4)' }}>{p.before.toLocaleString()}</span>
                                      <span className="mono text-xs text-right" style={{ color: 'rgba(255,255,255,0.4)' }}>{p.after.toLocaleString()}</span>
                                      <span className="mono text-xs font-black text-right" style={{ color: net > 0 ? 'var(--green)' : net < 0 ? 'var(--red)' : 'rgba(255,255,255,0.2)' }}>
                                        {net > 0 ? `+${net}` : net < 0 ? `${net}` : '—'}
                                      </span>
                                    </div>
                                    {/* Bet sub-rows */}
                                    {p.bets.map((b, i) => (
                                      <div key={i} className="flex items-center gap-2 mt-1 pl-3" style={{ borderLeft: '1px solid rgba(255,255,255,0.08)' }}>
                                        <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 10 }}>└</span>
                                        <span className="mono text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
                                          vs {b.opponentName}
                                        </span>
                                        <span className="mono text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>{b.amount} coins</span>
                                        <span className="mono text-xs font-black" style={{ color: b.won ? 'var(--green)' : 'var(--red)' }}>
                                          {b.won ? 'WON' : 'LOST'}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                );
                              })}
                              {/* Totals row */}
                              <div className="grid items-center pt-2 border-t" style={{ gridTemplateColumns: '1fr 72px 72px 64px', borderColor: 'rgba(255,255,255,0.08)' }}>
                                <span className="mono text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>TOTAL</span>
                                <span className="mono text-xs text-right" style={{ color: 'rgba(255,255,255,0.25)' }}>{snap.totalBefore.toLocaleString()}</span>
                                <span className="mono text-xs text-right" style={{ color: 'rgba(255,255,255,0.25)' }}>{snap.totalAfter.toLocaleString()}</span>
                                <span className="mono text-xs font-black text-right" style={{ color: snap.totalAfter === snap.totalBefore ? 'var(--green)' : 'var(--red)' }}>
                                  {snap.totalAfter === snap.totalBefore ? '✓ CLEAN' : `${snap.totalAfter - snap.totalBefore > 0 ? '+' : ''}${snap.totalAfter - snap.totalBefore}`}
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
              {gameSnapshots.length > 0 && (
                <div className="flex justify-end px-5 py-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                  <button
                    className="btn btn-ghost px-3 py-1 text-xs"
                    style={{ color: 'rgba(255,255,255,0.3)' }}
                    onClick={() => { if (confirm('Clear game balance history?')) clearSnapshots(); }}
                  >
                    CLEAR HISTORY
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
                          <div className="mono text-xs" style={{ color: 'var(--text)' }}>{entry.description}</div>
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
              {coinAuditLog.length === 0 ? (
                <div className="flex items-center justify-center h-32 mono text-xs tracking-widest" style={{ color: 'rgba(255,255,255,0.2)' }}>
                  NO DISCREPANCIES RECORDED
                </div>
              ) : (
                <div className="flex flex-col divide-y" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                  {coinAuditLog.map(entry => (
                    <div
                      key={entry.id}
                      className="flex items-start gap-4 px-5 py-3"
                      style={{ background: entry.acknowledged ? 'transparent' : 'rgba(255,0,64,0.04)' }}
                    >
                      <div className="flex flex-col gap-1 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="mono text-sm font-black" style={{ color: entry.drift > 0 ? 'var(--gold)' : 'var(--red)' }}>
                            {entry.drift > 0 ? '+' : ''}{entry.drift} COIN DRIFT
                          </span>
                          {!entry.acknowledged && (
                            <span className="mono text-xs px-1.5 py-0.5" style={{ background: 'rgba(255,0,64,0.15)', color: 'var(--red)', border: '1px solid rgba(255,0,64,0.3)' }}>NEW</span>
                          )}
                        </div>
                        <div className="mono text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>
                          {new Date(entry.timestamp).toLocaleString()} · {entry.trigger}
                        </div>
                        <div className="mono text-xs flex gap-4 mt-0.5">
                          <span>Expected: <span style={{ color: 'var(--cyan)' }}>{entry.expected.toLocaleString()}</span></span>
                          <span>Actual: <span style={{ color: entry.drift !== 0 ? 'var(--red)' : 'var(--green)' }}>{entry.actual.toLocaleString()}</span></span>
                        </div>
                      </div>
                      {!entry.acknowledged && (
                        <button className="btn btn-ghost px-2 py-1 text-xs flex-shrink-0" style={{ color: 'rgba(255,255,255,0.3)' }} onClick={() => acknowledgeAudit(entry.id)}>
                          ACK
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {coinAuditLog.length > 0 && (
                <div className="flex justify-end px-5 py-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                  <button
                    className="btn btn-ghost px-3 py-1 text-xs"
                    style={{ color: 'rgba(255,255,255,0.3)' }}
                    onClick={() => { if (confirm('Clear entire audit log?')) clearAuditLog(); }}
                  >
                    CLEAR LOG
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
