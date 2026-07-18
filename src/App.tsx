import React, { useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    document.getElementById('root')?.scrollTo(0, 0);
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

// Global — this account's session was taken over from another device. Can fire on
// any route, not just Login, so it lives at the app shell level.
function UserKickedNotice() {
  const { userKickedMessage, clearUserKickedMessage } = useUser();
  const navigate = useNavigate();
  if (!userKickedMessage) return null;
  return (
    <div className="fixed inset-0 z-[600] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.85)' }}>
      <div className="flex flex-col gap-4 p-6" style={{ background: '#0a0a18', border: '1px solid rgba(255,0,64,0.4)', borderRadius: 4, maxWidth: 340 }}>
        <span className="mono text-sm font-black tracking-widest" style={{ color: 'var(--red)' }}>⚠ SESSION ENDED</span>
        <span className="mono text-xs" style={{ color: 'var(--text)' }}>{userKickedMessage}</span>
        <button
          className="btn btn-gold py-2 text-xs font-black tracking-widest"
          onClick={() => { clearUserKickedMessage(); navigate('/login'); }}
        >
          OK
        </button>
      </div>
    </div>
  );
}
import { UserProvider, useUser } from '@/contexts/UserContext';
import { GameProvider } from '@/contexts/GameContext';
import Landing from '@/pages/Landing';
import NineBallArena from '@/pages/NineBallArena';
import Whitebook from '@/pages/Whitebook';
import Features from '@/pages/Features';
import About from '@/pages/About';
import FAQ from '@/pages/FAQ';
import AccountSettings from '@/pages/AccountSettings';
import GetCoins from '@/pages/GetCoins';
import Membership from '@/pages/Membership';
import Terms from '@/pages/Terms';
import Privacy from '@/pages/Privacy';
import Login from '@/pages/Login';
import AdminArena from '@/pages/AdminArena';
import JudgePage from '@/pages/JudgePage';
import Postbox from '@/pages/Postbox';
import Disclaimer from '@/pages/Disclaimer';
import Contact from '@/pages/Contact';
import './index.css';

export default function App() {
  return (
    <UserProvider>
      <HashRouter>
        <GameProvider>
          <ScrollToTop />
          <UserKickedNotice />
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/arena" element={<Navigate to="/9ball-arena" replace />} />
            <Route path="/9ball-arena" element={<NineBallArena />} />
            <Route path="/admin" element={<AdminArena />} />
            <Route path="/whitebook" element={<Whitebook />} />
            <Route path="/features" element={<Features />} />
            <Route path="/about" element={<About />} />
            <Route path="/faq" element={<FAQ />} />
            <Route path="/settings" element={<AccountSettings />} />
            <Route path="/get-coins" element={<GetCoins />} />
            <Route path="/membership" element={<Membership />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/judge/:token" element={<JudgePage />} />
            <Route path="/postbox" element={<Postbox />} />
            <Route path="/disclaimer" element={<Disclaimer />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="*" element={<Landing />} />
          </Routes>
        </GameProvider>
      </HashRouter>
    </UserProvider>
  );
}
