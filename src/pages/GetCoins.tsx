import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import Header from '@/components/layout/Header';
import { useUser } from '@/contexts/UserContext';

const QUICK_AMOUNTS = [10, 20, 50, 100, 200, 500];

export default function GetCoins() {
  const { currentUser, users, addCredits } = useUser();

  const [selectedUserId, setSelectedUserId] = useState(currentUser?.id ?? '');
  const [amount, setAmount] = useState(100);
  const [processing, setProcessing] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const selectedUser = users.find(u => u.id === selectedUserId);
  const nonAdminUsers = users.filter(u => !u.isAdmin);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId || !amount || amount < 1) return;
    setProcessing(true);
    setTimeout(() => {
      addCredits(selectedUserId, amount, 'admin_add', `Reload — ${amount} coins added`);
      setSuccessMsg(`✓ ${amount} coins added to ${selectedUser?.name ?? 'account'}!`);
      setProcessing(false);
      setAmount(100);
      setTimeout(() => setSuccessMsg(''), 3000);
    }, 1000);
  };

  return (
    <div className="flex flex-col" style={{ minHeight: "100dvh", position: 'relative' }}>
      <div style={{ position: 'fixed', inset: 0, backgroundImage: 'url(/111.jpg)', backgroundSize: 'cover', backgroundPosition: 'center', zIndex: 0 }} />
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,4,18,0.38)', zIndex: 1 }} />

      <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <Header />

        <main className="flex-1 w-full max-w-lg mx-auto px-3 py-6 flex flex-col gap-4">

          {/* Hero */}
          <div className="hud-panel bracket px-6 py-6 text-center flex flex-col items-center gap-2"
            style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}>
            <div className="mono text-xs tracking-[0.4em] text-[var(--text)] uppercase">Game Bird</div>
            <h1 className="font-black uppercase tracking-widest leading-none" style={{ fontSize: 'clamp(1.6rem,6vw,2.4rem)', color: 'var(--gold)' }}>
              ◈ Get Coins
            </h1>
            <p className="text-sm" style={{ color: 'var(--text)' }}>Add Sweep Coins to any player account instantly</p>
          </div>

          {/* Reload form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">

            {/* User select */}
            <div className="hud-panel px-5 py-4" style={{ background: 'rgba(0,0,0,0.50)', backdropFilter: 'blur(4px)' }}>
              <div className="text-xs mono tracking-[0.3em] text-[var(--cyan)] uppercase mb-3">Select Player</div>
              <select
                className="w-full bg-transparent border border-[var(--border)] px-3 py-2.5 text-sm mono outline-none focus:border-[var(--cyan)] appearance-none"
                style={{ color: selectedUserId ? 'var(--text)' : 'var(--text)' }}
                value={selectedUserId}
                onChange={e => setSelectedUserId(e.target.value)}
              >
                <option value="" style={{ background: '#0d0d20' }}>Choose a player...</option>
                {nonAdminUsers.map(u => (
                  <option key={u.id} value={u.id} style={{ background: '#0d0d20' }}>
                    {u.name} — {u.credits.toLocaleString()} coins
                  </option>
                ))}
              </select>
              {selectedUser && (
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-[var(--text)] mono uppercase tracking-widest">Current Balance</span>
                  <span className="mono font-black text-sm" style={{ color: 'var(--green)' }}>{selectedUser.credits.toLocaleString()} coins</span>
                </div>
              )}
            </div>

            {/* Amount */}
            <div className="hud-panel px-5 py-4" style={{ background: 'rgba(0,0,0,0.50)', backdropFilter: 'blur(4px)' }}>
              <div className="text-xs mono tracking-[0.3em] text-[var(--cyan)] uppercase mb-3">Reload Amount</div>
              <div className="grid grid-cols-3 gap-2 mb-3">
                {QUICK_AMOUNTS.map(a => (
                  <button
                    key={a}
                    type="button"
                    className="btn py-2.5 text-sm font-black tracking-widest"
                    style={{
                      border: `1px solid ${amount === a ? 'var(--gold)' : 'var(--border)'}`,
                      color: amount === a ? 'var(--gold)' : 'var(--text)',
                      background: amount === a ? 'rgba(255,215,0,0.08)' : 'transparent',
                    }}
                    onClick={() => setAmount(a)}
                  >
                    ◈ {a}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <span className="mono text-sm text-[var(--text)]">◈</span>
                <input
                  type="number"
                  min="1"
                  value={amount}
                  onChange={e => setAmount(Number(e.target.value))}
                  className="flex-1 bg-transparent border border-[var(--border)] px-3 py-2 text-sm mono outline-none focus:border-[var(--gold)] placeholder:text-[var(--text)]"
                  style={{ color: 'var(--text)' }}
                  placeholder="Custom amount..."
                />
              </div>
            </div>

            {/* Summary */}
            {selectedUser && amount > 0 && (
              <div className="hud-panel px-5 py-3 flex items-center justify-between"
                style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)', border: '1px solid rgba(255,215,0,0.2)' }}>
                <div>
                  <div className="text-xs mono text-[var(--gold)] uppercase tracking-widest mb-0.5">Reload Summary</div>
                  <div className="text-xs" style={{ color: 'var(--text)' }}>Adding {amount} coins to {selectedUser.name}</div>
                </div>
                <div className="text-right">
                  <div className="mono font-black text-sm" style={{ color: 'var(--green)' }}>
                    {selectedUser.credits.toLocaleString()} → {(selectedUser.credits + amount).toLocaleString()}
                  </div>
                  <div className="text-xs mono text-[var(--text)]">coins</div>
                </div>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={!selectedUserId || !amount || amount < 1 || processing}
              className="btn btn-gold py-4 text-base font-black tracking-widest w-full"
              style={{ opacity: (!selectedUserId || !amount || processing) ? 0.5 : 1 }}
            >
              {processing ? '⟳  PROCESSING...' : '◈  RELOAD COINS'}
            </button>

            {successMsg && (
              <div className="text-center text-sm mono font-black" style={{ color: 'var(--green)' }}>
                {successMsg}
              </div>
            )}
          </form>

          {/* Info panel */}
          <div className="hud-panel px-5 py-4 flex items-start gap-4"
            style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)', border: '1px solid var(--border)' }}>
            <span style={{ color: 'var(--cyan)', fontSize: '1.2rem', flexShrink: 0 }}>◉</span>
            <div>
              <div className="font-black uppercase tracking-wide text-sm mb-1" style={{ color: 'var(--cyan)' }}>Instant Reload</div>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--text)' }}>
                Coins are added instantly to the selected account. No payment processing required for admin reloads.
              </p>
            </div>
          </div>

          {/* Notes */}
          <div className="hud-panel px-5 py-4" style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}>
            <div className="text-xs mono tracking-[0.3em] text-[var(--text)] uppercase mb-3">How It Works</div>
            <div className="flex flex-col gap-2">
              {[
                { step: '01', text: 'Select the player you want to reload coins for.' },
                { step: '02', text: 'Choose a quick amount or enter a custom value.' },
                { step: '03', text: 'Review the summary — current balance and new balance are shown.' },
                { step: '04', text: 'Click Reload Coins. The balance updates instantly.' },
              ].map(item => (
                <div key={item.step} className="flex items-start gap-3">
                  <span className="mono font-black text-xs flex-shrink-0" style={{ color: 'var(--gold)' }}>{item.step}</span>
                  <span className="text-xs leading-relaxed" style={{ color: 'var(--text)' }}>{item.text}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <Link to="/9ball-arena" className="btn btn-cyan flex-1 py-3 text-sm font-black tracking-widest text-center" style={{ textDecoration: 'none' }}>
              ▶ ENTER 9 BALL ARENA
            </Link>
            <Link to="/settings" className="btn btn-ghost flex-1 py-3 text-sm font-black tracking-widest text-center" style={{ textDecoration: 'none' }}>
              ACCOUNT
            </Link>
          </div>

        </main>
      </div>
    </div>
  );
}
