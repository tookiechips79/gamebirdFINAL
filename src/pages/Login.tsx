import React, { useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useUser } from '@/contexts/UserContext';
import { useGame } from '@/contexts/GameContext';

type Tab = 'login' | 'signup';

const keypadSound = new Audio('/keypad.mp3');
const playKeypad = () => { keypadSound.currentTime = 0; keypadSound.play().catch(() => {}); };


function PinPad({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const digits = ['1','2','3','4','5','6','7','8','9','','0','⌫'];
  return (
    <div className="flex flex-col items-center gap-3">
      {/* PIN dots */}
      <div className="flex gap-3 mb-1">
        {[0,1,2,3].map(i => (
          <div key={i} className="w-4 h-4 rounded-full border-2 transition-all"
            style={{
              borderColor: 'var(--cyan)',
              background: i < value.length ? 'var(--cyan)' : 'transparent',
              boxShadow: i < value.length ? '0 0 8px var(--cyan)' : 'none',
            }} />
        ))}
      </div>
      {/* Grid */}
      <div className="grid grid-cols-3 gap-2">
        {digits.map((d, i) => (
          d === '' ? <div key={i} /> :
          <button
            key={i}
            type="button"
            className="w-14 h-14 rounded font-black text-xl mono transition-all active:scale-90"
            style={{
              background: d === '⌫' ? 'transparent' : 'rgba(0,229,255,0.06)',
              border: `1px solid ${d === '⌫' ? 'rgba(255,255,255,0.1)' : 'rgba(0,229,255,0.2)'}`,
              color: d === '⌫' ? 'var(--text-dim)' : 'var(--text)',
            }}
            onClick={() => {
              playKeypad();
              if (d === '⌫') onChange(value.slice(0, -1));
              else if (value.length < 4) onChange(value + d);
            }}
          >
            {d}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function Login() {
  const { users, addUser, setCurrentUser, setPin, claimUserSession } = useUser();
  const { claimAdmin } = useGame();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>('login');
  const [showAdminPrompt, setShowAdminPrompt] = useState(false);
  const [adminPw, setAdminPw] = useState('');
  const [adminPwError, setAdminPwError] = useState(false);
  const [adminBusyMsg, setAdminBusyMsg] = useState('');
  const adminInputRef = useRef<HTMLInputElement>(null);

  const submitAdminPw = async () => {
    const res = await claimAdmin(adminPw);
    if (res.success) {
      navigate('/admin');
    } else if (res.alreadyActive) {
      setAdminBusyMsg('Admin is already logged in on another device.');
      setAdminPw('');
    } else {
      setAdminPwError(true);
      setAdminPw('');
      setTimeout(() => adminInputRef.current?.focus(), 50);
    }
  };

  // Login state
  const [loginName, setLoginName] = useState('');
  const [loginPin, setLoginPin] = useState('');
  const [loginError, setLoginError] = useState('');

  // Signup state
  const [signupName, setSignupName] = useState('');
  const [signupReferral, setSignupReferral] = useState('');
  const [signupPin, setSignupPin] = useState('');
  const [signupPin2, setSignupPin2] = useState('');
  const [signupStep, setSignupStep] = useState<'name' | 'pin' | 'confirm'>('name');
  const [signupError, setSignupError] = useState('');

  const nonAdminUsers = users.filter(u => !u.isAdmin);

  const handleLogin = async () => {
    setLoginError('');
    const user = nonAdminUsers.find(u => u.name.toLowerCase() === loginName.toLowerCase());
    if (!user) { setLoginError('Account not found.'); return; }
    if (user.pin && user.pin !== loginPin) { setLoginError('Incorrect PIN.'); setLoginPin(''); return; }
    // If no PIN set, accept any PIN and set it
    if (!user.pin && loginPin.length === 4) {
      setPin(user.id, loginPin);
    }
    const res = await claimUserSession(user.id);
    if (res.success) {
      setCurrentUser(user);
      navigate('/');
    } else if (res.alreadyActive) {
      setLoginError('This account is already logged in on another device.');
    } else {
      setLoginError(res.error || 'Login failed — try again.');
    }
  };

  const handleSignup = () => {
    setSignupError('');
    const name = signupName.trim();
    if (!name) { setSignupError('Please enter a name.'); return; }
    if (users.find(u => u.name.toLowerCase() === name.toLowerCase())) {
      setSignupError('That name is already taken.'); return;
    }
    if (signupPin.length < 4) { setSignupError('PIN must be 4 digits.'); return; }
    if (signupPin !== signupPin2) { setSignupError('PINs do not match.'); setSignupPin2(''); return; }
    const user = addUser(name, false, 0, signupPin, signupReferral);
    setCurrentUser(user);
    navigate('/');
  };

  return (
    <div className="flex flex-col items-center justify-center" style={{ minHeight: '100dvh', background: 'var(--bg)', position: 'relative' }}>
      {/* Background */}
      <div style={{ position: 'fixed', inset: 0, backgroundImage: 'url(https://scontent-sjc6-1.xx.fbcdn.net/v/t39.30808-6/492011886_10213524164374025_5298605409934430000_n.jpg?stp=dst-jpg_tt6&cstp=mx2048x1448&ctp=s2048x1448&_nc_cat=102&ccb=1-7&_nc_sid=aa7b47&_nc_ohc=PoE5g3QHd1kQ7kNvwFDpt3b&_nc_oc=Adr75vuEouNrh267qKNqq5xNfuBd6Z1sce3DjEvCBbZeJfA3QfRQ5Tb8PWzjOvLJhrQ&_nc_zt=23&_nc_ht=scontent-sjc6-1.xx&_nc_gid=tE04Vd1MJBqGMZupeD81DQ&_nc_ss=7b289&oh=00_Af9xox8mSRH8SZOv6qMLckD6kMyPO6JtQz_B4SKh-O4HJQ&oe=6A442206)', backgroundSize: 'cover', backgroundPosition: 'center', zIndex: 0 }} />
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,4,18,0.25)', zIndex: 1 }} />

      <div style={{ position: 'relative', zIndex: 2, width: '100%', maxWidth: 380, padding: '0 16px' }}>

        {/* Logo */}
        <div className="text-center mb-6">
          <div className="font-black uppercase tracking-widest whitespace-nowrap" style={{ fontSize: 'clamp(2.5rem,9vw,3.5rem)', color: '#000', textShadow: 'none' }}>
            Game Bird
          </div>
          <div className="mono text-xs tracking-[0.3em] mt-1" style={{ color: '#fff' }}>PRIVATE BETTING PLATFORM</div>
        </div>

        {/* Card */}
        <div className="hud-panel bracket" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', padding: '24px 20px' }}>

          {/* Tabs */}
          <div className="grid grid-cols-2 gap-1 mb-6" style={{ background: 'rgba(0,0,0,0.4)', borderRadius: 4, padding: 3 }}>
            {(['login','signup'] as Tab[]).map(t => (
              <button key={t} onClick={() => { setTab(t); setLoginError(''); setSignupError(''); setLoginPin(''); setSignupPin(''); setSignupPin2(''); setSignupReferral(''); setSignupStep('name'); }}
                className="py-2 font-black text-sm uppercase tracking-widest transition-all"
                style={{
                  background: tab === t ? 'var(--cyan)' : 'transparent',
                  color: tab === t ? '#000' : 'var(--text-dim)',
                  borderRadius: 3,
                }}>
                {t === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            ))}
          </div>

          {/* LOGIN */}
          {tab === 'login' && (
            <div className="flex flex-col gap-4">
              <div>
                <label className="mono text-xs tracking-[0.2em] uppercase mb-1 block" style={{ color: 'var(--text-dim)' }}>Your Name</label>
                <input
                  className="w-full px-3 py-2.5 mono text-sm font-bold"
                  style={{ background: 'rgba(0,229,255,0.05)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 3, outline: 'none' }}
                  placeholder="Enter your name..."
                  value={loginName}
                  maxLength={20}
                  autoFocus
                  onChange={e => { setLoginName(e.target.value); setLoginPin(''); setLoginError(''); }}
                />
              </div>

              {loginName && (
                <div>
                  <label className="mono text-xs tracking-[0.2em] uppercase mb-3 block text-center" style={{ color: 'var(--text-dim)' }}>Enter PIN</label>
                  <div className="flex justify-center">
                    <PinPad value={loginPin} onChange={v => { setLoginPin(v); setLoginError(''); }} />
                  </div>
                </div>
              )}

              {loginError && (
                <div className="text-xs text-center font-black mono" style={{ color: 'var(--red)' }}>{loginError}</div>
              )}

              <button
                className="btn btn-cyan w-full py-3 text-sm font-black tracking-widest mt-1"
                disabled={!loginName || loginPin.length < 4}
                style={{ opacity: (!loginName || loginPin.length < 4) ? 0.4 : 1 }}
                onClick={handleLogin}
              >
                ▶ SIGN IN
              </button>
            </div>
          )}

          {/* SIGN UP */}
          {tab === 'signup' && (
            <div className="flex flex-col gap-4">
              {signupStep === 'name' && (
                <>
                  <div>
                    <label className="mono text-xs tracking-[0.2em] uppercase mb-1 block" style={{ color: 'var(--text-dim)' }}>Choose a Name</label>
                    <input
                      className="w-full px-3 py-2.5 mono text-sm font-bold"
                      style={{ background: 'rgba(0,229,255,0.05)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 3, outline: 'none' }}
                      placeholder="Your display name..."
                      value={signupName}
                      maxLength={20}
                      onChange={e => { setSignupName(e.target.value); setSignupError(''); }}
                      onKeyDown={e => { if (e.key === 'Enter' && signupName.trim()) setSignupStep('pin'); }}
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="mono text-xs tracking-[0.2em] uppercase mb-1 block" style={{ color: 'var(--text-dim)' }}>Bonus Code <span style={{ color: 'var(--text-dim)', fontWeight: 400 }}>(optional)</span></label>
                    <input
                      className="w-full px-3 py-2.5 mono text-sm"
                      style={{ background: 'rgba(255,215,0,0.04)', border: '1px solid rgba(255,215,0,0.2)', color: 'var(--text)', borderRadius: 3, outline: 'none' }}
                      placeholder="Enter bonus code..."
                      value={signupReferral}
                      maxLength={30}
                      onChange={e => setSignupReferral(e.target.value)}
                    />
                  </div>
                  {signupError && <div className="text-xs text-center font-black mono" style={{ color: 'var(--red)' }}>{signupError}</div>}
                  <button
                    className="btn btn-cyan w-full py-3 text-sm font-black tracking-widest"
                    disabled={!signupName.trim()}
                    style={{ opacity: !signupName.trim() ? 0.4 : 1 }}
                    onClick={() => {
                      const name = signupName.trim();
                      if (users.find(u => u.name.toLowerCase() === name.toLowerCase())) {
                        setSignupError('That name is already taken.'); return;
                      }
                      setSignupStep('pin');
                    }}
                  >
                    NEXT →
                  </button>
                </>
              )}

              {signupStep === 'pin' && (
                <>
                  <div className="text-center">
                    <div className="font-black text-sm uppercase tracking-widest mb-1" style={{ color: 'var(--text)' }}>Hi, {signupName}!</div>
                    <div className="mono text-xs tracking-[0.2em] uppercase mb-4" style={{ color: 'var(--text-dim)' }}>Set your 4-digit PIN</div>
                    <PinPad value={signupPin} onChange={v => { setSignupPin(v); setSignupError(''); }} />
                  </div>
                  {signupError && <div className="text-xs text-center font-black mono" style={{ color: 'var(--red)' }}>{signupError}</div>}
                  <button
                    className="btn btn-cyan w-full py-3 text-sm font-black tracking-widest"
                    disabled={signupPin.length < 4}
                    style={{ opacity: signupPin.length < 4 ? 0.4 : 1 }}
                    onClick={() => setSignupStep('confirm')}
                  >
                    NEXT →
                  </button>
                  <button className="btn btn-ghost w-full py-2 text-xs" onClick={() => setSignupStep('name')}>← BACK</button>
                </>
              )}

              {signupStep === 'confirm' && (
                <>
                  <div className="text-center">
                    <div className="mono text-xs tracking-[0.2em] uppercase mb-4" style={{ color: 'var(--text-dim)' }}>Confirm your PIN</div>
                    <PinPad value={signupPin2} onChange={v => { setSignupPin2(v); setSignupError(''); }} />
                  </div>
                  {signupError && <div className="text-xs text-center font-black mono" style={{ color: 'var(--red)' }}>{signupError}</div>}
                  <button
                    className="btn btn-green w-full py-3 text-sm font-black tracking-widest"
                    disabled={signupPin2.length < 4}
                    style={{ opacity: signupPin2.length < 4 ? 0.4 : 1 }}
                    onClick={handleSignup}
                  >
                    ✓ CREATE ACCOUNT
                  </button>
                  <button className="btn btn-ghost w-full py-2 text-xs" onClick={() => { setSignupStep('pin'); setSignupPin2(''); }}>← BACK</button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Admin entry */}
        <div className="flex justify-center mt-4">
          <button
            className="mono text-xs"
            style={{ color: 'rgba(255,255,255,0.2)', background: 'none', border: 'none', cursor: 'pointer' }}
            onClick={() => { setAdminPw(''); setAdminPwError(false); setAdminBusyMsg(''); setShowAdminPrompt(true); setTimeout(() => adminInputRef.current?.focus(), 50); }}
          >
            ⚙ admin
          </button>
        </div>

        {/* Footer links */}
        <div className="flex justify-center gap-4 mt-5 text-xs mono" style={{ color: 'var(--text-dim)' }}>
          <Link to="/terms" style={{ color: 'var(--text-dim)', textDecoration: 'none' }} className="hover:text-[var(--cyan)] transition-colors">Terms</Link>
          <Link to="/privacy" style={{ color: 'var(--text-dim)', textDecoration: 'none' }} className="hover:text-[var(--cyan)] transition-colors">Privacy</Link>
          <Link to="/faq" style={{ color: 'var(--text-dim)', textDecoration: 'none' }} className="hover:text-[var(--cyan)] transition-colors">FAQ</Link>
        </div>

      </div>

      {/* Admin password modal */}
      {showAdminPrompt && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.8)' }} onClick={() => setShowAdminPrompt(false)}>
          <div className="flex flex-col gap-4 p-6 w-72" style={{ background: '#0a0a18', border: '1px solid rgba(255,215,0,0.4)', borderRadius: 4 }} onClick={e => e.stopPropagation()}>
            <span className="mono text-sm font-black tracking-[0.25em]" style={{ color: 'var(--gold)' }}>ADMIN ACCESS</span>
            <input
              ref={adminInputRef}
              type="password"
              value={adminPw}
              onChange={e => { setAdminPw(e.target.value); setAdminPwError(false); setAdminBusyMsg(''); }}
              onKeyDown={e => { if (e.key === 'Enter') submitAdminPw(); if (e.key === 'Escape') setShowAdminPrompt(false); }}
              placeholder="Enter password"
              className="bg-transparent border px-3 py-2 mono text-sm outline-none w-full"
              style={{ borderColor: adminPwError ? 'var(--red)' : 'rgba(255,215,0,0.3)', color: 'var(--text)' }}
            />
            {adminPwError && <span className="mono text-xs" style={{ color: 'var(--red)', marginTop: -8 }}>Incorrect password</span>}
            {adminBusyMsg && <span className="mono text-xs" style={{ color: 'var(--red)', marginTop: -8 }}>{adminBusyMsg}</span>}
            <div className="flex gap-2">
              <button className="btn btn-ghost flex-1 py-2 text-xs" onClick={() => setShowAdminPrompt(false)}>CANCEL</button>
              <button className="btn btn-gold flex-1 py-2 text-xs font-black" onClick={submitAdminPw}>ENTER</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
