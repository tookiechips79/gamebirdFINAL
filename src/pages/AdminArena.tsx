import React, { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useUser } from '@/contexts/UserContext';
import { useGame } from '@/contexts/GameContext';
import Scoreboard from '@/components/scoreboard/Scoreboard';
import BettingQueue from '@/components/betting/BettingQueue';
import Header from '@/components/layout/Header';
import GameDescription from '@/components/game/GameDescription';
import UserManager from '@/components/admin/UserManager';
import CoinAuditLog from '@/components/admin/CoinAuditLog';

function Divider() {
  return <div style={{ width: 1, alignSelf: 'stretch', background: 'rgba(255,215,0,0.15)', margin: '0 4px' }} />;
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="mono text-xs font-black tracking-[0.3em] uppercase" style={{ color: 'rgba(255,215,0,0.6)' }}>{label}</span>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}

export default function AdminArena() {
  const { game, declareWinner, isAdmin, setIsAdmin, resetQueues, updateGame } = useGame();
  const { users, currentUser, coinAuditLog } = useUser();
  const navigate = useNavigate();

  const [winFlash, setWinFlash] = useState<'A' | 'B' | null>(null);
  const [showUserManager, setShowUserManager] = useState(false);
  const [showAuditLog, setShowAuditLog] = useState(false);

  const unackedAlerts = coinAuditLog.filter(e => !e.acknowledged).length;

  
  if (!isAdmin) return <Navigate to="/arena" replace />;

  const totalAllCoins = users.filter(u => !u.isAdmin).reduce((s, u) => s + u.credits, 0);

  const handleWin = (team: 'A' | 'B') => {
    setWinFlash(team);
    declareWinner(team);
    setTimeout(() => setWinFlash(null), 600);
  };

  return (
    <div style={{ background: 'var(--bg)' }}>
      <Header />

      {/* Win flash overlay */}
      {winFlash && (
        <div className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center" style={{ background: 'rgba(0,255,65,0.06)' }}>
          <div className="text-5xl font-black uppercase tracking-widest" style={{ color: 'var(--green)', textShadow: '0 0 24px rgba(0,255,65,0.4)' }}>
            {winFlash === 'A' ? game.teamAName : game.teamBName} WINS
          </div>
        </div>
      )}

      {showUserManager && <UserManager onClose={() => setShowUserManager(false)} />}
      {showAuditLog && <CoinAuditLog onClose={() => setShowAuditLog(false)} />}

      {/* ── Admin Controls Panel ── */}
      <div style={{ background: '#0a0a18', borderBottom: '1px solid rgba(255,215,0,0.25)', flexShrink: 0 }}>

        {/* Header row */}
        <div className="flex items-center justify-between px-3 py-1 border-b" style={{ borderColor: 'rgba(255,215,0,0.15)' }}>
          <span className="mono text-xs font-black tracking-widest" style={{ color: 'var(--gold)' }}>⚙ ADMIN</span>
          <span className="mono text-xs" style={{ color: 'var(--text-dim)' }}>
            {totalAllCoins.toLocaleString()} <span style={{ color: 'rgba(255,215,0,0.5)' }}>coins</span>
          </span>
          <button
            className="btn px-2 py-1 text-xs font-black tracking-widest"
            style={{ color: 'var(--red)', border: '1px solid var(--red)' }}
            onClick={() => { setIsAdmin(false); navigate('/arena'); }}
          >
            EXIT
          </button>
        </div>

        {/* Controls — horizontal scroll on mobile, 4-col on desktop */}
        <div className="flex gap-px overflow-x-scroll lg:grid lg:grid-cols-4" style={{ background: 'rgba(255,215,0,0.1)', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch', touchAction: 'pan-x' }}>

          {/* Declare Winner */}
          <div className="flex flex-col gap-2 p-3 flex-shrink-0" style={{ background: '#0a0a18', minWidth: 160 }}>
            <span className="mono text-xs font-black tracking-[0.2em] uppercase" style={{ color: 'rgba(255,215,0,0.6)' }}>Declare Winner</span>
            <button className="btn btn-cyan py-2.5 text-xs font-black tracking-widest w-full" onClick={() => handleWin('A')}>
              ✓ {game.teamAName}
            </button>
            <button className="btn btn-red py-2.5 text-xs font-black tracking-widest w-full" onClick={() => handleWin('B')}>
              ✓ {game.teamBName}
            </button>
          </div>

          {/* Balls */}
          <div className="flex flex-col gap-2 p-3 flex-shrink-0" style={{ background: '#0a0a18', minWidth: 160 }}>
            <span className="mono text-xs font-black tracking-[0.2em] uppercase" style={{ color: 'rgba(255,215,0,0.6)' }}>Balls</span>
            <div className="flex items-center justify-between gap-1">
              <span className="mono text-xs truncate" style={{ color: 'var(--cyan)', maxWidth: 60 }}>{game.teamAName}</span>
              <div className="flex items-center gap-1">
                <button className="btn btn-ghost w-7 h-7 text-sm font-black" onClick={() => updateGame({ teamABalls: game.teamABalls - 1 })}>−</button>
                <span className="mono font-black text-lg w-6 text-center" style={{ color: 'var(--cyan)' }}>{game.teamABalls}</span>
                <button className="btn btn-cyan w-7 h-7 text-sm font-black" onClick={() => updateGame({ teamABalls: game.teamABalls + 1 })}>+</button>
              </div>
            </div>
            <div className="flex items-center justify-between gap-1">
              <span className="mono text-xs truncate" style={{ color: 'var(--red)', maxWidth: 60 }}>{game.teamBName}</span>
              <div className="flex items-center gap-1">
                <button className="btn btn-ghost w-7 h-7 text-sm font-black" onClick={() => updateGame({ teamBBalls: game.teamBBalls - 1 })}>−</button>
                <span className="mono font-black text-lg w-6 text-center" style={{ color: 'var(--red)' }}>{game.teamBBalls}</span>
                <button className="btn btn-red w-7 h-7 text-sm font-black" onClick={() => updateGame({ teamBBalls: game.teamBBalls + 1 })}>+</button>
              </div>
            </div>
          </div>

          {/* Users & Audit */}
          <div className="flex flex-col gap-2 p-3 flex-shrink-0" style={{ background: '#0a0a18', minWidth: 160 }}>
            <span className="mono text-xs font-black tracking-[0.2em] uppercase" style={{ color: 'rgba(255,215,0,0.6)' }}>Management</span>
            <button className="btn btn-cyan py-2.5 text-xs font-black tracking-widest w-full" onClick={() => setShowUserManager(true)}>
              USERS
            </button>
            <button
              className="btn py-2.5 text-xs font-black tracking-widest w-full"
              style={{ color: unackedAlerts > 0 ? 'var(--red)' : 'var(--text-dim)', border: `1px solid ${unackedAlerts > 0 ? 'var(--red)' : 'rgba(255,255,255,0.15)'}`, background: unackedAlerts > 0 ? 'rgba(255,0,64,0.08)' : 'transparent' }}
              onClick={() => setShowAuditLog(true)}
            >
              {unackedAlerts > 0 ? `⚠ AUDIT (${unackedAlerts})` : 'AUDIT LOG'}
            </button>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2 p-3 flex-shrink-0" style={{ background: '#0a0a18', minWidth: 160 }}>
            <span className="mono text-xs font-black tracking-[0.2em] uppercase" style={{ color: 'rgba(255,215,0,0.6)' }}>Actions</span>
            <Link to="/whitebook" className="btn btn-ghost py-2.5 text-xs font-black tracking-widest w-full text-center" style={{ textDecoration: 'none' }}>
              WHITEBOOK
            </Link>
            <button className="btn btn-ghost py-2.5 text-xs font-black tracking-widest w-full" onClick={() => resetQueues()}>
              CLEAR QUEUE
            </button>
            <button
              className="btn btn-ghost py-2.5 text-xs font-black tracking-widest w-full"
              onClick={() => { if (confirm('Reset all scores to 0?')) updateGame({ teamAGames: 0, teamBGames: 0, teamABalls: 0, teamBBalls: 0, currentGameNumber: 1 }); }}
            >
              RESET SCORES
            </button>
          </div>

        </div>
      </div>

      {/* ── Main Content — stacked on mobile, 3-col on desktop ── */}
      <div className="p-2 flex flex-col gap-3 lg:grid lg:gap-2"
        style={{ gridTemplateColumns: '1fr 200px 1fr', alignItems: 'start' }}>
        <div className="min-w-0 w-full">
          <Scoreboard onTeamAWin={() => handleWin('A')} onTeamBWin={() => handleWin('B')} stackedLayout />
        </div>
        <div className="min-w-0 w-full">
          <GameDescription />
        </div>
        <div className="min-w-0 w-full">
          <BettingQueue compactInput />
        </div>
      </div>
    </div>
  );
}
