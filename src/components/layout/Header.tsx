import React, { useState, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useGame } from '@/contexts/GameContext';
import { useUser } from '@/contexts/UserContext';
import UserBar from './UserBar';

const NAV_LINKS = [
  { to: '/arena', label: 'ARENA' },
  { to: '/postbox', label: 'POSTBOX' },
  { to: '/features', label: 'FEATURES' },
  { to: '/about', label: 'ABOUT' },
  { to: '/faq', label: 'FAQ' },
  { to: '/membership', label: 'GET COINS' },
];

export default function Header() {
  const { isAdmin, claimAdmin } = useGame();
  const { users, currentUser, challenges } = useUser();
  const pendingChallenges = challenges.filter(c => c.opponentId === currentUser?.id && c.status === 'pending').length;
  const loc = useLocation();
  const navigate = useNavigate();
  const totalCoins = users.filter(u => !u.isAdmin).reduce((s, u) => s + u.credits, 0);
  const [showPwPrompt, setShowPwPrompt] = useState(false);
  const [pw, setPw] = useState('');
  const [pwError, setPwError] = useState(false);
  const [pwBusyMsg, setPwBusyMsg] = useState('');
  const [mobileOpen, setMobileOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const openPrompt = () => {
    setPw('');
    setPwError(false);
    setPwBusyMsg('');
    setShowPwPrompt(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const submitPassword = async () => {
    const res = await claimAdmin(pw);
    if (res.success) {
      setShowPwPrompt(false);
      navigate('/admin');
    } else if (res.alreadyActive) {
      setPwBusyMsg('Admin is already logged in on another device.');
      setPw('');
    } else {
      setPwError(true);
      setPw('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  return (
    <>
      <header
        className="w-full flex items-center justify-between px-3 py-2 border-b gap-2"
        style={{ background: isAdmin ? '#00cc44' : '#cc0000', borderColor: '#000', position: 'sticky', top: 0, zIndex: 100, minWidth: 0 }}
      >
        {/* Logo */}
        <Link to="/" className="flex items-center gap-1 no-underline flex-shrink-0" onClick={() => setMobileOpen(false)}>
          <span className="text-lg font-black tracking-widest uppercase" style={{ color: '#000' }}>Game Bird</span>
          <span className="text-xs mono" style={{ color: isAdmin ? '#000' : '#fff' }}>beta</span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden lg:flex items-center gap-1">
          {NAV_LINKS.map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              className="px-3 py-1 text-xs font-bold tracking-widest uppercase transition-colors"
              style={{
                color: (loc.pathname === to || isAdmin) ? '#000' : '#fff',
                borderBottom: loc.pathname === to ? '1px solid #000' : '1px solid transparent',
                textDecoration: 'none',
                position: 'relative',
              }}
            >
              {label}
              {to === '/postbox' && pendingChallenges > 0 && (
                <span style={{ position: 'absolute', top: 2, right: 2, width: 7, height: 7, borderRadius: '50%', background: 'var(--gold)', boxShadow: '0 0 6px var(--gold)' }} />
              )}
            </Link>
          ))}
        </nav>

        {/* Right side */}
        <div className="flex items-center gap-1 flex-shrink-0 min-w-0">
          {isAdmin && (
            <Link
              to="/admin"
              className="text-xs mono px-2 py-1 flex items-center gap-1"
              style={{ color: 'var(--gold)', border: '1px solid var(--gold)', opacity: 0.8, textDecoration: 'none', whiteSpace: 'nowrap' }}
            >
              ADMIN
            </Link>
          )}
          <UserBar />
          {/* Hamburger — mobile only */}
          <button
            className="lg:hidden flex flex-col justify-center items-center gap-[5px] p-1 ml-1"
            onClick={() => setMobileOpen(o => !o)}
            aria-label="Menu"
          >
            <span style={{ display: 'block', width: 22, height: 2, background: mobileOpen ? '#000' : '#fff', transition: 'all 0.2s', transform: mobileOpen ? 'translateY(7px) rotate(45deg)' : 'none' }} />
            <span style={{ display: 'block', width: 22, height: 2, background: mobileOpen ? 'transparent' : '#fff', transition: 'all 0.2s' }} />
            <span style={{ display: 'block', width: 22, height: 2, background: mobileOpen ? '#000' : '#fff', transition: 'all 0.2s', transform: mobileOpen ? 'translateY(-7px) rotate(-45deg)' : 'none' }} />
          </button>
        </div>

        {/* Admin password prompt */}
        {showPwPrompt && (
          <div
            className="fixed inset-0 z-[500] flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.8)' }}
            onClick={() => setShowPwPrompt(false)}
          >
            <div
              className="flex flex-col gap-4 p-6 w-72"
              style={{ background: '#0a0a18', border: '1px solid rgba(255,215,0,0.4)', borderRadius: 4 }}
              onClick={e => e.stopPropagation()}
            >
              <span className="mono text-sm font-black tracking-[0.25em]" style={{ color: 'var(--gold)' }}>ADMIN ACCESS</span>
              <input
                ref={inputRef}
                type="password"
                value={pw}
                onChange={e => { setPw(e.target.value); setPwError(false); setPwBusyMsg(''); }}
                onKeyDown={e => { if (e.key === 'Enter') submitPassword(); if (e.key === 'Escape') setShowPwPrompt(false); }}
                placeholder="Enter password"
                className="bg-transparent border px-3 py-2 mono text-sm outline-none w-full"
                style={{ borderColor: pwError ? 'var(--red)' : 'rgba(255,215,0,0.3)', color: 'var(--text)' }}
              />
              {pwError && (
                <span className="mono text-xs" style={{ color: 'var(--red)', marginTop: -8 }}>Incorrect password</span>
              )}
              {pwBusyMsg && (
                <span className="mono text-xs" style={{ color: 'var(--red)', marginTop: -8 }}>{pwBusyMsg}</span>
              )}
              <div className="flex gap-2">
                <button className="btn btn-ghost flex-1 py-2 text-xs" onClick={() => setShowPwPrompt(false)}>CANCEL</button>
                <button className="btn btn-gold flex-1 py-2 text-xs font-black" onClick={submitPassword}>ENTER</button>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Mobile drawer */}
      {mobileOpen && (
        <>
          {/* Backdrop */}
          <div
            className="lg:hidden fixed z-[98]"
            style={{ top: 45, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)' }}
            onClick={() => setMobileOpen(false)}
          />
          {/* Drawer */}
          <div
            className="lg:hidden fixed z-[99]"
            style={{ top: 45, left: 0, right: 0, background: isAdmin ? '#00cc44' : '#cc0000', borderBottom: '2px solid #000' }}
          >
            {NAV_LINKS.map(({ to, label }) => (
              <Link
                key={to}
                to={to}
                onClick={() => setMobileOpen(false)}
                style={{
                  display: 'block',
                  padding: '16px',
                  textAlign: 'center',
                  fontSize: '0.875rem',
                  fontWeight: 900,
                  letterSpacing: '0.15em',
                  textTransform: 'uppercase',
                  borderBottom: '1px solid rgba(0,0,0,0.15)',
                  color: (loc.pathname === to || isAdmin) ? '#000' : '#fff',
                  textDecoration: 'none',
                  background: loc.pathname === to ? 'rgba(0,0,0,0.1)' : 'transparent',
                  position: 'relative',
                }}
              >
                {label}
                {to === '/postbox' && pendingChallenges > 0 && (
                  <span style={{ position: 'absolute', top: 12, right: 'calc(50% - 52px)', width: 8, height: 8, borderRadius: '50%', background: 'var(--gold)', boxShadow: '0 0 6px var(--gold)' }} />
                )}
              </Link>
            ))}
          </div>
        </>
      )}
    </>
  );
}
