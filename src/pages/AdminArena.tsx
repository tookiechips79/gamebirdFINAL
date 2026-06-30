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
  const { users, currentUser, coinAuditLog, mergeServerUsers, requestAllUsers } = useUser();
  const [fetchingUsers, setFetchingUsers] = React.useState(false);

  const fetchUsersFromDb = () => {
    const serverUrl = window.location.hostname === 'localhost'
      ? 'http://localhost:3001'
      : 'https://gamebird-app-production.up.railway.app';
    setFetchingUsers(true);
    requestAllUsers();
    setTimeout(() => {
      fetch(`${serverUrl}/api/users`)
        .then(r => r.json())
        .then((serverUsers: any[]) => mergeServerUsers(serverUsers))
        .catch(() => {})
        .finally(() => setFetchingUsers(false));
    }, 1000);
  };
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
          <div className="flex items-center gap-2">
            <span className="mono text-xs" style={{ color: 'var(--text-dim)' }}>
              {totalAllCoins.toLocaleString()} <span style={{ color: 'rgba(255,215,0,0.5)' }}>coins</span>
            </span>
            <button
              className="btn px-2 py-1 text-xs font-black tracking-widest"
              style={{ color: 'var(--cyan)', border: '1px solid var(--cyan)', opacity: fetchingUsers ? 0.5 : 1 }}
              onClick={fetchUsersFromDb}
              disabled={fetchingUsers}
            >
              {fetchingUsers ? '⟳' : '⟳ FETCH USERS'}
            </button>
            <button
              className="btn px-2 py-1 text-xs font-black tracking-widest"
              style={{ color: 'var(--red)', border: '1px solid var(--red)' }}
              onClick={() => { setIsAdmin(false); navigate('/arena'); }}
            >
              EXIT
            </button>
          </div>
        </div>

        {/* Controls — stacked on mobile, 4-col on desktop */}
        <div className="flex flex-col gap-px overflow-hidden" style={{ background: 'rgba(255,215,0,0.1)' }}>

          {/* Declare Winner */}
          <div className="flex flex-col gap-1 p-2" style={{ background: '#0a0a18' }}>
            <span className="mono text-xs font-black tracking-[0.2em] uppercase" style={{ color: 'rgba(255,215,0,0.6)' }}>Declare Winner</span>
            <div className="flex gap-2">
              <button className="btn btn-cyan py-1 text-xs font-black tracking-widest flex-1" onClick={() => handleWin('A')}>
                ✓ {game.teamAName}
              </button>
              <button className="btn btn-red py-1 text-xs font-black tracking-widest flex-1" onClick={() => handleWin('B')}>
                ✓ {game.teamBName}
              </button>
            </div>
          </div>

          {/* Balls */}
          <div className="flex flex-col gap-1 p-2" style={{ background: '#0a0a18' }}>
            <span className="mono text-xs font-black tracking-[0.2em] uppercase" style={{ color: 'rgba(255,215,0,0.6)' }}>Balls</span>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 flex-1">
                <span className="mono text-xs truncate" style={{ color: 'var(--cyan)', maxWidth: 50 }}>{game.teamAName}</span>
                <button className="btn btn-ghost w-6 h-6 text-xs font-black ml-auto" onClick={() => updateGame({ teamABalls: game.teamABalls - 1 })}>−</button>
                <span className="mono font-black text-sm w-5 text-center" style={{ color: 'var(--cyan)' }}>{game.teamABalls}</span>
                <button className="btn btn-cyan w-6 h-6 text-xs font-black" onClick={() => updateGame({ teamABalls: game.teamABalls + 1 })}>+</button>
              </div>
              <div className="w-px h-5" style={{ background: 'rgba(255,215,0,0.2)' }} />
              <div className="flex items-center gap-1 flex-1">
                <span className="mono text-xs truncate" style={{ color: 'var(--red)', maxWidth: 50 }}>{game.teamBName}</span>
                <button className="btn btn-ghost w-6 h-6 text-xs font-black ml-auto" onClick={() => updateGame({ teamBBalls: game.teamBBalls - 1 })}>−</button>
                <span className="mono font-black text-sm w-5 text-center" style={{ color: 'var(--red)' }}>{game.teamBBalls}</span>
                <button className="btn btn-red w-6 h-6 text-xs font-black" onClick={() => updateGame({ teamBBalls: game.teamBBalls + 1 })}>+</button>
              </div>
            </div>
          </div>

          {/* Users & Audit */}
          <div className="flex flex-col gap-1 p-2" style={{ background: '#0a0a18' }}>
            <span className="mono text-xs font-black tracking-[0.2em] uppercase" style={{ color: 'rgba(255,215,0,0.6)' }}>Management</span>
            <div className="flex gap-2">
              <button className="btn btn-cyan py-1 text-xs font-black tracking-widest flex-1" onClick={() => setShowUserManager(true)}>USERS</button>
              <button
                className="btn py-1 text-xs font-black tracking-widest flex-1"
                style={{ color: unackedAlerts > 0 ? 'var(--red)' : 'var(--text-dim)', border: `1px solid ${unackedAlerts > 0 ? 'var(--red)' : 'rgba(255,255,255,0.15)'}`, background: unackedAlerts > 0 ? 'rgba(255,0,64,0.08)' : 'transparent' }}
                onClick={() => setShowAuditLog(true)}
              >
                {unackedAlerts > 0 ? `⚠ (${unackedAlerts})` : 'AUDIT'}
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-1 p-2" style={{ background: '#0a0a18' }}>
            <span className="mono text-xs font-black tracking-[0.2em] uppercase" style={{ color: 'rgba(255,215,0,0.6)' }}>Actions</span>
            <div className="flex gap-2">
              <Link to="/whitebook" className="btn btn-ghost py-1 text-xs font-black tracking-widest flex-1 text-center" style={{ textDecoration: 'none' }}>WHITEBOOK</Link>
              <button className="btn btn-ghost py-1 text-xs font-black tracking-widest flex-1" onClick={() => resetQueues()}>CLEAR Q</button>
              <button className="btn btn-ghost py-1 text-xs font-black tracking-widest flex-1" onClick={() => { if (confirm('Reset all scores to 0?')) updateGame({ teamAGames: 0, teamBGames: 0, teamABalls: 0, teamBBalls: 0, currentGameNumber: 1 }); }}>RESET</button>
            </div>
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
