import React, { useState, useEffect, useRef } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useUser } from '@/contexts/UserContext';
import { useGame } from '@/contexts/GameContext';
import Scoreboard from '@/components/scoreboard/Scoreboard';
import BettingQueue from '@/components/betting/BettingQueue';
import Header from '@/components/layout/Header';
import WalletWidget, { CoinsInAction } from '@/components/layout/WalletWidget';
import PlayerBank from '@/components/scoreboard/PlayerBank';
import GameDescription from '@/components/game/GameDescription';
import GameHistory from '@/components/history/GameHistory';
import BetLedger from '@/components/history/BetLedger';
import UserManager from '@/components/admin/UserManager';
import CoinAuditLog from '@/components/admin/CoinAuditLog';

export default function NineBallArena() {
  const { game, declareWinner, isAdmin, setIsAdmin, resetQueues, updateGame } = useGame();
  const { users, currentUser, currentUserId, coinAuditLog, mergeServerUsers, requestAllUsers } = useUser();
  const [fetchingData, setFetchingData] = useState(false);

  const fetchDataFromDb = () => {
    const serverUrl = window.location.hostname === 'localhost' ? 'http://localhost:3001' : 'https://gamebird-app-production.up.railway.app';
    setFetchingData(true);
    requestAllUsers();
    setTimeout(() => {
      fetch(`${serverUrl}/api/users`)
        .then(r => r.json())
        .then((data: any) => { const su = Array.isArray(data) ? data : (data?.users ?? []); mergeServerUsers(su, data?.deletedIds); })
        .catch(() => {})
        .finally(() => setFetchingData(false));
    }, 1000);
  };

  // Allow a stored session ID to pass even if users haven't re-hydrated yet
  if (!currentUser && !isAdmin && !currentUserId) return <Navigate to="/login" replace />;
  const totalAllCoins = users.filter(u => !u.isAdmin).reduce((s, u) => s + u.credits, 0);
  const [winFlash, setWinFlash] = useState<'A' | 'B' | null>(null);
  const [showUserManager, setShowUserManager] = useState(false);
  const [showAuditLog, setShowAuditLog] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const unackedAlerts = coinAuditLog.filter(e => !e.acknowledged).length;
  const [headerH, setHeaderH] = useState(53);
  useEffect(() => {
    const h = document.querySelector('header');
    if (h) setHeaderH(h.getBoundingClientRect().height);
  }, []);

  const handleWin = (team: 'A' | 'B') => {
    setWinFlash(team);
    declareWinner(team);
    setTimeout(() => setWinFlash(null), 600);
  };

  return (
    <div className="flex flex-col" style={{ minHeight: '100dvh', position: 'relative' }}>
      {/* GB diamond pattern background */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, backgroundImage: 'url(/arena-bg.png)', backgroundSize: '30%', backgroundPosition: 'center' }} />
      <div style={{ position: 'fixed', inset: 0, zIndex: 1, background: 'rgba(4,4,14,0.88)' }} />
      <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>
      <Header />

      {/* Win flash overlay */}
      {winFlash && (
        <div className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center win-flash" style={{ background: 'rgba(0,255,65,0.08)' }}>
          <div className="text-6xl font-black uppercase tracking-widest" style={{ color: 'var(--green)', textShadow: '0 0 16px rgba(0,255,65,0.3)' }}>
            {winFlash === 'A' ? game.teamAName : game.teamBName} WINS
          </div>
        </div>
      )}

      {/* Admin dropdown bar */}
      {isAdmin && (
        <div id="admin-bar" style={{ background: 'rgba(10,10,20,0.98)', borderBottom: '1px solid rgba(255,215,0,0.2)', position: 'fixed', top: headerH, left: 0, right: 0, zIndex: 90 }}>
          {/* Toggle row */}
          <button
            className="w-full flex items-center justify-between px-4 py-2 hover:bg-black transition-colors"
            onClick={() => setAdminOpen(v => !v)}
          >
            <div className="flex items-center gap-3">
              <span className="mono text-xs font-black tracking-[0.3em] uppercase" style={{ color: 'var(--gold)' }}>⚙ ADMIN CONTROLS</span>
              <span className="mono text-xs tracking-widest">
                <span style={{ color: 'var(--text)' }}>ALL COINS: </span>
                <span className="font-black" style={{ color: 'var(--gold)' }}>{totalAllCoins.toLocaleString()}</span>
              </span>
            </div>
            <span className="mono text-xs" style={{ color: 'var(--gold)' }}>{adminOpen ? '▲' : '▼'}</span>
          </button>

          {/* Expanded controls */}
          {adminOpen && (
            <div className="px-4 pb-3 flex flex-col gap-3 border-t border-[rgba(255,215,0,0.1)]" style={{ paddingTop: 10 }}>

              {/* Win buttons */}
              <div>
                <div className="text-xs mono tracking-[0.3em] text-[var(--text)] uppercase mb-2">Declare Winner</div>
                <div className="grid grid-cols-2 gap-2">
                  <button className="btn btn-cyan py-2.5 text-sm font-black tracking-widest" onClick={() => { handleWin('A'); setAdminOpen(false); }}>
                    ✓ {game.teamAName} WINS
                  </button>
                  <button className="btn btn-red py-2.5 text-sm font-black tracking-widest" onClick={() => { handleWin('B'); setAdminOpen(false); }}>
                    ✓ {game.teamBName} WINS
                  </button>
                </div>
              </div>

              {/* Games */}
              <div>
                <div className="text-xs mono tracking-[0.3em] text-[var(--text)] uppercase mb-2">Games</div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-2 hud-panel px-3 py-2" style={{ background: 'rgba(0,229,255,0.04)' }}>
                    <span className="text-xs mono font-black flex-1" style={{ color: 'var(--cyan)' }}>{game.teamAName}</span>
                    <button className="btn btn-ghost w-7 h-7 text-sm font-black" onClick={() => updateGame({ teamAGames: game.teamAGames - 1 })}>−</button>
                    <span className="mono font-black text-lg w-8 text-center" style={{ color: 'var(--cyan)' }}>{game.teamAGames}</span>
                    <button className="btn btn-cyan w-7 h-7 text-sm font-black" onClick={() => updateGame({ teamAGames: game.teamAGames + 1 })}>+</button>
                  </div>
                  <div className="flex items-center gap-2 hud-panel px-3 py-2" style={{ background: 'rgba(255,0,64,0.04)' }}>
                    <span className="text-xs mono font-black flex-1" style={{ color: 'var(--red)' }}>{game.teamBName}</span>
                    <button className="btn btn-ghost w-7 h-7 text-sm font-black" onClick={() => updateGame({ teamBGames: game.teamBGames - 1 })}>−</button>
                    <span className="mono font-black text-lg w-8 text-center" style={{ color: 'var(--red)' }}>{game.teamBGames}</span>
                    <button className="btn btn-red w-7 h-7 text-sm font-black" onClick={() => updateGame({ teamBGames: game.teamBGames + 1 })}>+</button>
                  </div>
                </div>
              </div>

              {/* Balls */}
              <div>
                <div className="text-xs mono tracking-[0.3em] text-[var(--text)] uppercase mb-2">Balls</div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-2 hud-panel px-3 py-2" style={{ background: 'rgba(0,229,255,0.04)' }}>
                    <span className="text-xs mono font-black flex-1" style={{ color: 'var(--cyan)' }}>{game.teamAName}</span>
                    <button className="btn btn-ghost w-7 h-7 text-sm font-black" onClick={() => updateGame({ teamABalls: game.teamABalls - 1 })}>−</button>
                    <span className="mono font-black text-lg w-8 text-center" style={{ color: 'var(--cyan)' }}>{game.teamABalls}</span>
                    <button className="btn btn-cyan w-7 h-7 text-sm font-black" onClick={() => updateGame({ teamABalls: game.teamABalls + 1 })}>+</button>
                  </div>
                  <div className="flex items-center gap-2 hud-panel px-3 py-2" style={{ background: 'rgba(255,0,64,0.04)' }}>
                    <span className="text-xs mono font-black flex-1" style={{ color: 'var(--red)' }}>{game.teamBName}</span>
                    <button className="btn btn-ghost w-7 h-7 text-sm font-black" onClick={() => updateGame({ teamBBalls: game.teamBBalls - 1 })}>−</button>
                    <span className="mono font-black text-lg w-8 text-center" style={{ color: 'var(--red)' }}>{game.teamBBalls}</span>
                    <button className="btn btn-red w-7 h-7 text-sm font-black" onClick={() => updateGame({ teamBBalls: game.teamBBalls + 1 })}>+</button>
                  </div>
                </div>
              </div>

              {/* Management buttons */}
              <div>
                <div className="text-xs mono tracking-[0.3em] text-[var(--text)] uppercase mb-2">Management</div>
                <div className="flex flex-wrap gap-2">
                  <button className="btn btn-cyan px-4 py-2 text-xs font-black tracking-widest" onClick={() => { setShowUserManager(true); setAdminOpen(false); }}>
                    ★ MANAGE USERS
                  </button>
                  <button
                    className="btn px-4 py-2 text-xs font-black tracking-widest"
                    style={{ color: unackedAlerts > 0 ? 'var(--red)' : 'var(--text-dim)', border: `1px solid ${unackedAlerts > 0 ? 'var(--red)' : 'rgba(255,255,255,0.15)'}`, background: unackedAlerts > 0 ? 'rgba(255,0,64,0.08)' : 'transparent' }}
                    onClick={() => { setShowAuditLog(true); setAdminOpen(false); }}
                  >
                    {unackedAlerts > 0 ? `⚠ AUDIT (${unackedAlerts})` : 'AUDIT LOG'}
                  </button>
                  <Link to="/whitebook" className="btn btn-ghost px-4 py-2 text-xs font-black tracking-widest" style={{ textDecoration: 'none' }}>
                    WHITEBOOK
                  </Link>
                  <button className="btn btn-ghost px-4 py-2 text-xs font-black tracking-widest" onClick={() => { resetQueues(); setAdminOpen(false); }}>
                    CLEAR QUEUES
                  </button>
                  <button
                    className="btn btn-ghost px-4 py-2 text-xs font-black tracking-widest"
                    onClick={() => {
                      if (confirm('Reset all scores to 0?')) {
                        updateGame({ teamAGames: 0, teamBGames: 0, teamABalls: 0, teamBBalls: 0, currentGameNumber: 1 });
                        setAdminOpen(false);
                      }
                    }}
                  >
                    RESET SCORES
                  </button>
                  <button
                    className="btn btn-ghost px-4 py-2 text-xs font-black tracking-widest"
                    style={{ color: 'var(--text)', borderColor: 'var(--border)' }}
                    onClick={() => { setIsAdmin(false); setAdminOpen(false); }}
                  >
                    EXIT ADMIN
                  </button>
                </div>
              </div>

            </div>
          )}
        </div>
      )}

      <main className="flex-1 w-full max-w-2xl mx-auto px-3 flex flex-col gap-3" style={{ paddingTop: isAdmin ? (adminOpen ? headerH + 160 : headerH + 48) : 16 }}>
        <CoinsInAction />
        <GameDescription hideAdminControls />
        <WalletWidget />
        <button onClick={fetchDataFromDb} disabled={fetchingData} className="w-full py-2 text-xs mono font-black tracking-widest" style={{ background: 'none', border: '1px solid rgba(0,229,255,0.3)', color: fetchingData ? 'rgba(0,229,255,0.4)' : 'var(--cyan)', cursor: fetchingData ? 'default' : 'pointer', borderRadius: 4 }}>
          {fetchingData ? '⟳ FETCHING...' : '⟳ FETCH DATA'}
        </button>
        <PlayerBank />
        <Scoreboard onTeamAWin={() => handleWin('A')} onTeamBWin={() => handleWin('B')} hideAdminControls avatarASrc="/james.jpeg" avatarBSrc="/ross.jpeg" avatarBPosition="0% center" hideBallCount hideBreakIndicator />
        <BettingQueue />
        <GameHistory />
        <BetLedger />
      </main>

      {showUserManager && <UserManager onClose={() => setShowUserManager(false)} />}
      {showAuditLog && <CoinAuditLog onClose={() => setShowAuditLog(false)} />}
      </div>
    </div>
  );
}
