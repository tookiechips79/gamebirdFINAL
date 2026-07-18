import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Header from '@/components/layout/Header';
import { useUser } from '@/contexts/UserContext';
import { useGame } from '@/contexts/GameContext';
import { User } from '@/types';

function MembershipTab({ currentUser, navigate }: { currentUser: User; navigate: (p: string) => void }) {
  const { setCurrentUser, requestAllUsers, mergeServerUsers } = useUser();
  const { isAdmin, setIsAdmin } = useGame();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState('');

  const fetchFromDb = () => {
    const serverUrl = window.location.hostname === 'localhost' ? 'http://localhost:3001' : 'https://gamebird-app-production.up.railway.app';
    setSyncing(true); setSyncMsg('');
    requestAllUsers();
    setTimeout(() => {
      fetch(`${serverUrl}/api/users`)
        .then(r => r.json())
        .then((su: any[]) => { mergeServerUsers(su); setSyncMsg(`✓ Synced — ${su.filter((u: any) => !u.isAdmin).length} users loaded`); })
        .catch(() => setSyncMsg('Sync failed — try again'))
        .finally(() => setSyncing(false));
    }, 1000);
  };

  const mem = currentUser.membership;
  const isPremium = mem?.tier === 'premium' && !mem.cancelledAt;
  const isCancelled = mem?.tier === 'premium' && !!mem.cancelledAt;

  const handleUpgrade = () => {
    updateMembership(currentUser.id, {
      tier: 'premium',
      startedAt: Date.now(),
      renewsAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
      cancelledAt: null,
    });
  };

  const handleCancel = () => {
    updateMembership(currentUser.id, { ...mem!, cancelledAt: Date.now() });
    setConfirmCancel(false);
  };

  return (
    <div className="flex flex-col gap-4">

      {/* Status card */}
      <div className="hud-panel px-5 py-5 flex items-center justify-between gap-4"
        style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)', border: `1px solid ${isPremium ? 'var(--gold)' : 'var(--border)'}` }}>
        <div className="flex items-center gap-4">
          <div className="text-3xl" style={{ color: isPremium ? 'var(--gold)' : 'var(--text)' }}>
            {currentUser.isAdmin ? '⚙' : isPremium ? '★' : '◎'}
          </div>
          <div>
            <div className="font-black uppercase tracking-widest text-base" style={{ color: isPremium ? 'var(--gold)' : 'var(--text)' }}>
              {currentUser.isAdmin ? 'Admin Account' : isPremium ? 'Premium Member' : isCancelled ? 'Cancelled' : 'Free Account'}
            </div>
            <div className="text-xs mt-0.5" style={{ color: 'var(--text)' }}>
              {currentUser.isAdmin && 'Full platform access — no membership required'}
              {isPremium && mem?.renewsAt && `Renews ${new Date(mem.renewsAt).toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })}`}
              {isCancelled && mem?.renewsAt && `Active until ${new Date(mem.renewsAt).toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })}`}
              {!mem && !currentUser.isAdmin && 'Standard access — upgrade for premium features'}
            </div>
          </div>
        </div>
        <div className="flex-shrink-0">
          {isPremium && <span className="mono text-xs px-3 py-1 font-black uppercase tracking-widest" style={{ border: '1px solid var(--gold)', color: 'var(--gold)', background: 'rgba(255,215,0,0.08)' }}>ACTIVE</span>}
          {isCancelled && <span className="mono text-xs px-3 py-1 font-black uppercase tracking-widest" style={{ border: '1px solid var(--red)', color: 'var(--red)', background: 'rgba(255,0,64,0.08)' }}>CANCELLED</span>}
          {!mem && !currentUser.isAdmin && <span className="mono text-xs px-3 py-1 font-black uppercase tracking-widest" style={{ border: '1px solid var(--text)', color: 'var(--text)' }}>FREE</span>}
        </div>
      </div>

      {/* Membership details */}
      {(isPremium || isCancelled) && mem && (
        <div className="hud-panel overflow-hidden" style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}>
          <div className="px-4 py-2 border-b border-[var(--border)]" style={{ background: 'rgba(255,215,0,0.04)' }}>
            <span className="text-xs mono tracking-widest text-[var(--gold)] uppercase">Membership Details</span>
          </div>
          {[
            { label: 'Plan', value: 'Premium' },
            { label: 'Member Since', value: new Date(mem.startedAt).toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' }) },
            { label: isCancelled ? 'Expires' : 'Next Renewal', value: mem.renewsAt ? new Date(mem.renewsAt).toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' }) : '—' },
            { label: 'Status', value: isCancelled ? 'Cancelled — access until expiry' : 'Active' },
          ].map(row => (
            <div key={row.label} className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--border)] last:border-0">
              <span className="text-xs mono text-[var(--text)] uppercase tracking-widest">{row.label}</span>
              <span className="text-xs font-black uppercase tracking-wide" style={{ color: 'var(--text)' }}>{row.value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Cancel section */}
      {isPremium && (
        <div className="hud-panel px-5 py-4" style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)', border: '1px solid rgba(255,0,64,0.2)' }}>
          <div className="text-xs mono tracking-[0.3em] text-[var(--red)] uppercase mb-2">Cancel Membership</div>
          <p className="text-xs leading-relaxed mb-3" style={{ color: 'var(--text)' }}>
            Your membership will remain active until {mem?.renewsAt ? new Date(mem.renewsAt).toLocaleDateString([], { month: 'long', day: 'numeric' }) : 'the end of the billing period'}. After that, your account returns to free access.
          </p>
          {!confirmCancel ? (
            <button className="btn btn-red px-5 py-2 text-xs font-black tracking-widest" onClick={() => setConfirmCancel(true)}>
              CANCEL MEMBERSHIP
            </button>
          ) : (
            <div className="flex items-center gap-3">
              <span className="text-xs mono" style={{ color: 'var(--text)' }}>Are you sure?</span>
              <button className="btn btn-red px-4 py-1.5 text-xs font-black tracking-widest" onClick={handleCancel}>YES, CANCEL</button>
              <button className="btn btn-ghost px-4 py-1.5 text-xs font-black tracking-widest" onClick={() => setConfirmCancel(false)}>KEEP IT</button>
            </div>
          )}
        </div>
      )}

      {/* Upgrade section */}
      {!isPremium && !currentUser.isAdmin && (
        <div className="hud-panel px-5 py-5 text-center flex flex-col items-center gap-3"
          style={{ background: 'rgba(0,0,0,0.50)', backdropFilter: 'blur(4px)', border: '1px solid var(--gold)' }}>
          <div className="text-xs mono tracking-[0.3em] text-[var(--gold)] uppercase">Upgrade to Premium</div>
          <p className="text-sm max-w-sm leading-relaxed" style={{ color: 'var(--text)' }}>
            Get priority bet placement, higher denomination options, and exclusive platform features.
          </p>
          <button className="btn btn-gold px-8 py-3 text-sm font-black tracking-widest" onClick={() => navigate('/membership')}>
            ★ UPGRADE NOW
          </button>
        </div>
      )}

      {/* Feature grid */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Bet Matching', desc: 'Real-time automatic bet matching', active: true },
          { label: 'Live Scoreboard', desc: 'Full access to live game data', active: true },
          { label: 'Bet History', desc: 'Complete record of all bets', active: true },
          { label: 'Multi-Device', desc: 'Sync across all your devices', active: true },
          { label: 'Priority Queue', desc: 'Front-of-line bet placement', active: isPremium },
          { label: 'Custom Limits', desc: 'Higher bet denomination options', active: isPremium },
        ].map(f => (
          <div key={f.label} className="hud-panel px-4 py-3 flex items-start gap-3"
            style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}>
            <span className="text-sm mt-0.5" style={{ color: f.active ? 'var(--green)' : 'var(--text)' }}>{f.active ? '✓' : '○'}</span>
            <div>
              <div className="font-black uppercase tracking-wide text-xs mb-0.5" style={{ color: f.active ? 'var(--text)' : 'var(--text)' }}>{f.label}</div>
              <div className="text-xs" style={{ color: 'var(--text)' }}>{f.desc}</div>
            </div>
          </div>
        ))}
      </div>

      <button onClick={fetchFromDb} disabled={syncing} className="btn btn-ghost w-full py-2.5 text-sm font-black tracking-widest" style={{ border: '1px solid var(--cyan)', color: 'var(--cyan)', opacity: syncing ? 0.5 : 1 }}>
        {syncing ? '⟳ FETCHING...' : '⟳ FETCH DATA'}
      </button>
      {syncMsg && <div className="text-xs mono text-center" style={{ color: 'var(--green)' }}>{syncMsg}</div>}

      <div className="flex gap-3">
        <Link to="/9ball-arena" className="btn btn-cyan flex-1 py-3 text-sm font-black tracking-widest text-center" style={{ textDecoration: 'none' }}>
          ▶ ENTER 9 BALL ARENA
        </Link>
        <button className="btn btn-ghost flex-1 py-3 text-sm font-black tracking-widest" onClick={() => { setCurrentUser(null); if (isAdmin) setIsAdmin(false); navigate('/'); }}>
          LOG OUT
        </button>
      </div>
    </div>
  );
}

type Tab = 'wallet' | 'bets' | 'transactions' | 'users' | 'membership' | 'security';

export default function AccountSettings() {
  const { currentUser, setCurrentUser, users, addUser, renameUser, deleteUser, addCredits, updateMembership, changeCredential } = useUser();
  const { gameHistory, isAdmin, setIsAdmin } = useGame();
  const navigate = useNavigate();

  const [tab, setTab] = useState<Tab>('wallet');

  // Wallet tab
  const [cashoutAmt, setCashoutAmt] = useState('');
  const [cashoutMsg, setCashoutMsg] = useState('');

  // Admin user management tab
  const [newName, setNewName] = useState('');
  const [newCredits, setNewCredits] = useState('1000');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [adjustId, setAdjustId] = useState<string | null>(null);
  const [adjustAmt, setAdjustAmt] = useState('');

  // Security tab
  const [secMethod, setSecMethod] = useState<'pin' | 'password'>('pin');
  const [secCurrent, setSecCurrent] = useState('');
  const [secNewPin, setSecNewPin] = useState('');
  const [secNewPin2, setSecNewPin2] = useState('');
  const [secNewPassword, setSecNewPassword] = useState('');
  const [secNewPassword2, setSecNewPassword2] = useState('');
  const [secMsg, setSecMsg] = useState<{ text: string; ok: boolean } | null>(null);

  useEffect(() => {
    if (!currentUser) navigate('/');
  }, [currentUser]);

  if (!currentUser) return null;

  const isAdminUser = currentUser.isAdmin;

  // Derived bet stats from gameHistory
  const myBets = gameHistory.flatMap(r => [
    ...r.bets.teamA.map(b => ({ ...b, record: r, side: 'A' as const })),
    ...r.bets.teamB.map(b => ({ ...b, record: r, side: 'B' as const })),
  ]).filter(b => b.userId === currentUser.id && b.booked);

  const wins = myBets.filter(b => b.won).length;
  const losses = myBets.filter(b => !b.won).length;
  const winPct = myBets.length > 0 ? Math.round((wins / myBets.length) * 100) : null;
  const tipsGiven = currentUser.tipsGiven ?? 0;
  const tipsReceived = currentUser.tipsReceived ?? 0;

  const handleCashout = () => {
    const amt = parseInt(cashoutAmt);
    if (!amt || amt <= 0) { setCashoutMsg('Enter a valid amount.'); return; }
    if (amt > currentUser.credits) { setCashoutMsg('Insufficient coins.'); return; }
    addCredits(currentUser.id, -amt, 'cashout', `Cashout of ${amt} coins`);
    setCashoutMsg(`✓ Cashout of ${amt} coins submitted.`);
    setCashoutAmt('');
    setTimeout(() => setCashoutMsg(''), 3000);
  };

  const handleAddUser = () => {
    if (!newName.trim()) return;
    addUser(newName.trim(), false, parseInt(newCredits) || 1000);
    setNewName('');
    setNewCredits('1000');
  };

  const handleRename = (id: string) => {
    if (editingName.trim()) renameUser(id, editingName.trim());
    setEditingId(null);
    setEditingName('');
  };

  const handleAdjust = (id: string, dir: 1 | -1) => {
    const amt = parseInt(adjustAmt);
    if (!amt || amt <= 0) return;
    const target = users.find(u => u.id === id)?.name ?? 'player';
    addCredits(id, dir * amt,
      dir === 1 ? 'admin_add' : 'admin_deduct',
      dir === 1 ? `Admin added ${amt} coins to ${target}` : `Admin deducted ${amt} coins from ${target}`
    );
    setAdjustId(null);
    setAdjustAmt('');
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: 'wallet', label: 'WALLET' },
    { id: 'bets', label: 'BET HISTORY' },
    { id: 'transactions', label: 'TRANSACTIONS' },
    ...(isAdmin ? [{ id: 'users' as Tab, label: 'MANAGE USERS' }] : []),
    { id: 'membership', label: 'MEMBERSHIP' },
    { id: 'security', label: 'SECURITY' },
  ];

  const handleChangePin = async () => {
    setSecMsg(null);
    if (secNewPin.length !== 4) { setSecMsg({ text: 'New PIN must be 4 digits.', ok: false }); return; }
    if (secNewPin !== secNewPin2) { setSecMsg({ text: 'New PINs do not match.', ok: false }); return; }
    const res = await changeCredential(currentUser.id, secCurrent, secNewPin, undefined);
    if (!res.success) { setSecMsg({ text: res.error || 'Update failed.', ok: false }); return; }
    setSecCurrent(''); setSecNewPin(''); setSecNewPin2('');
    setSecMsg({ text: '✓ PIN updated.', ok: true });
  };

  const handleChangePassword = async () => {
    setSecMsg(null);
    if (secNewPassword.length < 6) { setSecMsg({ text: 'Password must be at least 6 characters.', ok: false }); return; }
    if (secNewPassword !== secNewPassword2) { setSecMsg({ text: 'Passwords do not match.', ok: false }); return; }
    const res = await changeCredential(currentUser.id, secCurrent, undefined, secNewPassword);
    if (!res.success) { setSecMsg({ text: res.error || 'Update failed.', ok: false }); return; }
    setSecCurrent(''); setSecNewPassword(''); setSecNewPassword2('');
    setSecMsg({ text: '✓ Password updated.', ok: true });
  };

  return (
    <div className="flex flex-col" style={{ minHeight: "100dvh", position: 'relative' }}>
      <div style={{ position: 'fixed', inset: 0, backgroundImage: 'url(/111.jpg)', backgroundSize: 'cover', backgroundPosition: 'center', zIndex: 0 }} />
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,4,18,0.38)', zIndex: 1 }} />

      <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <Header />

        <main className="flex-1 w-full max-w-2xl mx-auto px-3 py-6 flex flex-col gap-4">

          {/* Page title */}
          <div className="hud-panel bracket px-5 py-4 flex items-center justify-between"
            style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}>
            <div>
              <div className="mono text-xs tracking-[0.4em] text-[var(--text)] uppercase">Account</div>
              <h1 className="font-black uppercase tracking-widest leading-none" style={{ fontSize: '1.6rem', color: 'var(--cyan)' }}>
                {currentUser.name}'s Settings
              </h1>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="mono font-black text-2xl" style={{ color: 'var(--green)' }}>{currentUser.credits.toLocaleString()}</span>
              <span className="text-xs mono text-[var(--text)] tracking-widest">COINS</span>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-[var(--border)]">
            {tabs.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className="px-4 py-2 text-xs font-black tracking-widest uppercase transition-colors"
                style={{
                  color: tab === t.id ? 'var(--cyan)' : 'var(--text)',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: tab === t.id ? '2px solid var(--cyan)' : '2px solid transparent',
                  cursor: 'pointer',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* ── WALLET TAB ── */}
          {tab === 'wallet' && (
            <div className="flex flex-col gap-4">
              {/* Stats grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="hud-panel px-4 py-4" style={{ background: 'rgba(0,0,0,0.50)', backdropFilter: 'blur(4px)' }}>
                  <div className="text-xs mono text-[var(--text)] tracking-widest uppercase mb-1">Available Balance</div>
                  <div className="mono font-black text-3xl" style={{ color: 'var(--green)' }}>{currentUser.credits.toLocaleString()}</div>
                  <div className="text-xs text-[var(--text)] uppercase tracking-widest mt-1">Sweep Coins</div>
                </div>
                <div className="hud-panel px-4 py-4" style={{ background: 'rgba(0,0,0,0.50)', backdropFilter: 'blur(4px)' }}>
                  <div className="text-xs mono text-[var(--text)] tracking-widest uppercase mb-1">Win / Loss</div>
                  <div className="mono font-black text-2xl">
                    <span style={{ color: 'var(--green)' }}>{wins}W</span>
                    <span style={{ color: 'var(--text)' }}> · </span>
                    <span style={{ color: 'var(--red)' }}>{losses}L</span>
                  </div>
                  <div className="text-xs text-[var(--text)] uppercase tracking-widest mt-1">
                    {winPct !== null ? `${winPct}% win rate` : 'No bets yet'}
                  </div>
                </div>
                <div className="hud-panel px-4 py-4" style={{ background: 'rgba(0,0,0,0.50)', backdropFilter: 'blur(4px)' }}>
                  <div className="text-xs mono text-[var(--text)] tracking-widest uppercase mb-1">Tips Given</div>
                  <div className="mono font-black text-2xl" style={{ color: tipsGiven > 0 ? 'var(--red)' : 'var(--text)' }}>
                    {tipsGiven > 0 ? `-${tipsGiven}` : '—'}
                  </div>
                  <div className="text-xs text-[var(--text)] uppercase tracking-widest mt-1">Coins tipped out</div>
                </div>
                <div className="hud-panel px-4 py-4" style={{ background: 'rgba(0,0,0,0.50)', backdropFilter: 'blur(4px)' }}>
                  <div className="text-xs mono text-[var(--text)] tracking-widest uppercase mb-1">Tips Received</div>
                  <div className="mono font-black text-2xl" style={{ color: tipsReceived > 0 ? 'var(--green)' : 'var(--text)' }}>
                    {tipsReceived > 0 ? `+${tipsReceived}` : '—'}
                  </div>
                  <div className="text-xs text-[var(--text)] uppercase tracking-widest mt-1">Coins received</div>
                </div>
              </div>

              {/* Cashout */}
              <div className="hud-panel px-5 py-5" style={{ background: 'rgba(0,0,0,0.50)', backdropFilter: 'blur(4px)', border: '1px solid var(--gold)' }}>
                <div className="text-xs mono tracking-[0.3em] text-[var(--gold)] uppercase mb-3">Cashout Funds</div>
                <div className="flex gap-2 mb-3">
                  {[50, 100, 200].map(amt => (
                    <button
                      key={amt}
                      className="btn btn-ghost flex-1 py-1.5 text-xs font-black tracking-widest"
                      onClick={() => setCashoutAmt(String(amt))}
                      style={{ borderColor: cashoutAmt === String(amt) ? 'var(--gold)' : undefined, color: cashoutAmt === String(amt) ? 'var(--gold)' : undefined }}
                    >
                      {amt}
                    </button>
                  ))}
                  <button className="btn btn-ghost px-3 text-xs font-black" onClick={() => setCashoutAmt(String(currentUser.credits))}>MAX</button>
                </div>
                <div className="flex gap-2">
                  <input
                    type="number"
                    className="flex-1 bg-transparent border border-[var(--border)] px-3 py-2 text-sm mono outline-none placeholder:text-[var(--text)] focus:border-[var(--gold)]"
                    style={{ color: 'var(--text)' }}
                    placeholder="Custom amount..."
                    value={cashoutAmt}
                    onChange={e => setCashoutAmt(e.target.value)}
                  />
                  <button className="btn btn-gold px-6 py-2 text-sm font-black tracking-widest" onClick={handleCashout}>
                    CASHOUT
                  </button>
                </div>
                {cashoutMsg && (
                  <div className="mt-2 text-xs mono" style={{ color: cashoutMsg.startsWith('✓') ? 'var(--green)' : 'var(--red)' }}>
                    {cashoutMsg}
                  </div>
                )}
                <div className="mt-3 text-xs" style={{ color: 'var(--text)' }}>
                  Cashouts are processed per venue terms. Equivalent value sent to your registered payment method.
                </div>
              </div>
            </div>
          )}

          {/* ── BET HISTORY TAB ── */}
          {tab === 'bets' && (
            <div className="hud-panel overflow-hidden" style={{ background: 'rgba(0,0,0,0.50)', backdropFilter: 'blur(4px)' }}>
              {myBets.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-14 gap-2">
                  <span className="text-3xl" style={{ color: 'var(--text)' }}>◎</span>
                  <div className="text-xs mono tracking-widest text-[var(--text)] uppercase">No matched bets yet</div>
                </div>
              ) : (
                <div className="divide-y divide-[var(--border)]">
                  <div className="grid grid-cols-6 px-4 py-2" style={{ background: 'rgba(0,229,255,0.04)' }}>
                    {['Tx', 'Game', 'Side', 'Amount', 'Result', 'Date'].map(h => (
                      <div key={h} className="text-xs mono text-[var(--text)] tracking-widest uppercase">{h}</div>
                    ))}
                  </div>
                  {myBets.map((b, i) => {
                    const teamName = b.side === 'A' ? b.record.teamAName : b.record.teamBName;
                    const dateStr = new Date(b.record.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' });
                    return (
                      <div key={i} className="grid grid-cols-6 px-4 py-2.5 items-center hover:bg-black">
                        <div className="text-xs mono" style={{ color: 'rgba(255,255,255,0.4)' }}>{b.txId ? `#${b.txId}` : '—'}</div>
                        <div className="text-xs mono text-[var(--text)]">#{b.record.gameNumber}</div>
                        <div className="text-xs font-black uppercase tracking-wide" style={{ color: b.side === 'A' ? 'var(--cyan)' : 'var(--red)' }}>{teamName}</div>
                        <div className="text-xs mono" style={{ color: 'var(--text)' }}>{b.amount}</div>
                        <div className="text-xs mono font-black" style={{ color: b.won ? 'var(--green)' : 'var(--red)' }}>
                          {b.won ? `+${b.amount}` : `-${b.amount}`}
                        </div>
                        <div className="text-xs mono text-[var(--text)]">{dateStr}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── TRANSACTIONS TAB ── */}
          {tab === 'transactions' && (() => {
            const txList = isAdmin
              ? users.flatMap(u => (u.transactions ?? []).map(tx => ({ ...tx, userName: u.name })))
                  .sort((a, b) => b.timestamp - a.timestamp)
              : (currentUser.transactions ?? []).map(tx => ({ ...tx, userName: currentUser.name }));

            const typeColor: Record<string, string> = {
              bet_placed: 'var(--cyan)',
              bet_refund: 'var(--gold)',
              bet_win:    'var(--green)',
              bet_loss:   'var(--red)',
              tip_given:  'var(--red)',
              tip_received: 'var(--green)',
              admin_add:  'var(--green)',
              admin_deduct: 'var(--red)',
              cashout:    'var(--gold)',
              membership_activate: 'var(--cyan)',
              membership_renew:    'var(--cyan)',
              membership_cancel:   'var(--text)',
            };
            const typeLabel: Record<string, string> = {
              bet_placed:   'BET',
              bet_refund:   'REFUND',
              bet_win:      'WIN',
              bet_loss:     'LOSS',
              tip_given:    'TIP OUT',
              tip_received: 'TIP IN',
              admin_add:    'RELOAD',
              admin_deduct: 'DEDUCT',
              cashout:      'CASHOUT',
              membership_activate: 'MEMBER',
              membership_renew:    'RENEWED',
              membership_cancel:   'CANCELLED',
            };
            const sign: Record<string, string> = {
              bet_placed: '−', bet_loss: '−', tip_given: '−', admin_deduct: '−', cashout: '−',
              bet_refund: '+', bet_win: '+', tip_received: '+', admin_add: '+', membership_activate: '−', membership_renew: '−',
            };

            return (
              <div className="hud-panel overflow-hidden" style={{ background: 'rgba(0,0,0,0.50)', backdropFilter: 'blur(4px)' }}>
                {txList.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-14 gap-2">
                    <span className="text-3xl" style={{ color: 'var(--text)' }}>◎</span>
                    <div className="text-xs mono tracking-widest text-[var(--text)] uppercase">No transactions yet</div>
                    <div className="text-xs text-[var(--text)]">Transactions will appear here as you bet, tip, and reload</div>
                  </div>
                ) : (
                  <div className="divide-y divide-[var(--border)]">
                    <div className={`grid px-4 py-2 ${isAdmin ? 'grid-cols-5' : 'grid-cols-4'}`} style={{ background: 'rgba(0,229,255,0.04)' }}>
                      <div className="text-xs mono text-[var(--text)] tracking-widest uppercase">Type</div>
                      {isAdmin && <div className="text-xs mono text-[var(--text)] tracking-widest uppercase">Player</div>}
                      <div className="text-xs mono text-[var(--text)] tracking-widest uppercase">Description</div>
                      <div className="text-xs mono text-[var(--text)] tracking-widest uppercase">Amount</div>
                      <div className="text-xs mono text-[var(--text)] tracking-widest uppercase">Date</div>
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                      {txList.map((tx, i) => (
                        <div key={`${tx.id}-${i}`} className={`grid px-4 py-2.5 items-center hover:bg-black ${isAdmin ? 'grid-cols-5' : 'grid-cols-4'}`}>
                          <div className="text-xs mono font-black" style={{ color: typeColor[tx.type] ?? 'var(--text)' }}>
                            {typeLabel[tx.type] ?? tx.type}
                          </div>
                          {isAdmin && (
                            <div className="text-xs font-black uppercase tracking-wide" style={{ color: 'var(--text)' }}>
                              {tx.userName}
                            </div>
                          )}
                          <div className="text-xs" style={{ color: 'var(--text)' }}>
                            {tx.description}
                            {tx.betTxId && <span className="mono ml-2" style={{ color: 'rgba(255,255,255,0.3)' }}>#{tx.betTxId}</span>}
                          </div>
                          <div className="text-xs mono font-black" style={{ color: typeColor[tx.type] ?? 'var(--text)' }}>
                            {sign[tx.type] ?? ''}{tx.amount}
                          </div>
                          <div className="text-xs mono text-[var(--text)]">
                            {new Date(tx.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                            {' '}
                            {new Date(tx.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* ── MANAGE USERS TAB (admin only) ── */}
          {tab === 'users' && isAdmin && (
            <div className="flex flex-col gap-4">
              {/* Add user */}
              <div className="hud-panel px-5 py-4" style={{ background: 'rgba(0,0,0,0.50)', backdropFilter: 'blur(4px)' }}>
                <div className="text-xs mono tracking-[0.3em] text-[var(--cyan)] uppercase mb-3">Add New Player</div>
                <div className="flex gap-2">
                  <input
                    className="flex-1 bg-transparent border border-[var(--border)] px-3 py-2 text-sm mono outline-none placeholder:text-[var(--text)] focus:border-[var(--cyan)]"
                    style={{ color: 'var(--text)' }}
                    placeholder="Player name..."
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddUser()}
                  />
                  <input
                    className="w-24 bg-transparent border border-[var(--border)] px-3 py-2 text-sm mono outline-none placeholder:text-[var(--text)] focus:border-[var(--cyan)]"
                    style={{ color: 'var(--text)' }}
                    type="number"
                    placeholder="Credits"
                    value={newCredits}
                    onChange={e => setNewCredits(e.target.value)}
                  />
                  <button className="btn btn-cyan px-4 py-2 text-xs font-black tracking-widest" onClick={handleAddUser}>
                    + ADD
                  </button>
                </div>
              </div>

              {/* User list */}
              <div className="hud-panel overflow-hidden" style={{ background: 'rgba(0,0,0,0.50)', backdropFilter: 'blur(4px)' }}>
                <div className="px-4 py-2 border-b border-[var(--border)]" style={{ background: 'rgba(0,229,255,0.04)' }}>
                  <span className="text-xs mono tracking-widest text-[var(--text)] uppercase">All Players</span>
                </div>
                {users.filter(u => !u.isAdmin).map(u => (
                  <div key={u.id} className="px-4 py-3 border-b border-[var(--border)] last:border-0">
                    <div className="flex items-center justify-between gap-3">
                      {editingId === u.id ? (
                        <input
                          autoFocus
                          className="flex-1 bg-transparent border-b border-[var(--cyan)] text-sm mono outline-none"
                          style={{ color: 'var(--cyan)' }}
                          value={editingName}
                          onChange={e => setEditingName(e.target.value)}
                          onBlur={() => handleRename(u.id)}
                          onKeyDown={e => e.key === 'Enter' && handleRename(u.id)}
                        />
                      ) : (
                        <span className="font-black uppercase tracking-wide text-sm" style={{ color: 'var(--text)' }}>{u.name}</span>
                      )}
                      <div className="flex items-center gap-3">
                        <span className="mono text-sm" style={{ color: 'var(--green)' }}>{u.credits.toLocaleString()}</span>
                        <button className="text-xs mono text-[var(--cyan)] hover:text-white" onClick={() => { setEditingId(u.id); setEditingName(u.name); }}>RENAME</button>
                        <button className="text-xs mono text-[var(--gold)] hover:text-white" onClick={() => setAdjustId(adjustId === u.id ? null : u.id)}>ADJUST</button>
                        <button className="text-xs mono text-[var(--red)] hover:text-white" onClick={() => deleteUser(u.id)}>DELETE</button>
                      </div>
                    </div>
                    {adjustId === u.id && (
                      <div className="flex gap-2 mt-2">
                        <input
                          autoFocus
                          type="number"
                          className="flex-1 bg-transparent border border-[var(--border)] px-2 py-1 text-xs mono outline-none focus:border-[var(--gold)]"
                          style={{ color: 'var(--text)' }}
                          placeholder="Amount..."
                          value={adjustAmt}
                          onChange={e => setAdjustAmt(e.target.value)}
                        />
                        <button className="btn btn-green px-3 py-1 text-xs font-black" onClick={() => handleAdjust(u.id, 1)}>+ ADD</button>
                        <button className="btn btn-red px-3 py-1 text-xs font-black" onClick={() => handleAdjust(u.id, -1)}>− DEDUCT</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── MEMBERSHIP TAB ── */}
          {tab === 'membership' && <MembershipTab currentUser={currentUser} navigate={navigate} />}

          {/* ── SECURITY TAB ── */}
          {tab === 'security' && (
            <div className="flex flex-col gap-4">
              <div className="hud-panel px-5 py-4" style={{ background: 'rgba(0,0,0,0.50)', backdropFilter: 'blur(4px)' }}>
                <div className="text-xs mono tracking-[0.3em] text-[var(--cyan)] uppercase mb-1">Login Method</div>
                <div className="text-xs mb-3" style={{ color: 'var(--text)' }}>
                  Currently: {currentUser.password ? 'Password' : 'PIN'} {currentUser.password && currentUser.pin ? '(both set)' : ''}
                </div>
                <div className="flex border-b border-[var(--border)]">
                  {(['pin', 'password'] as const).map(m => (
                    <button
                      key={m}
                      onClick={() => { setSecMethod(m); setSecMsg(null); }}
                      className="px-4 py-2 text-xs font-black tracking-widest uppercase transition-colors"
                      style={{
                        color: secMethod === m ? 'var(--cyan)' : 'var(--text)',
                        background: 'transparent', border: 'none',
                        borderBottom: secMethod === m ? '2px solid var(--cyan)' : '2px solid transparent',
                        cursor: 'pointer',
                      }}
                    >
                      {m === 'pin' ? 'Change PIN' : 'Change Password'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="hud-panel px-5 py-5" style={{ background: 'rgba(0,0,0,0.50)', backdropFilter: 'blur(4px)' }}>
                <div className="text-xs mono tracking-[0.2em] uppercase mb-1 block" style={{ color: 'var(--text-dim)' }}>
                  Current PIN or Password
                </div>
                <input
                  type="password"
                  className="w-full px-3 py-2.5 mono text-sm font-bold mb-4"
                  style={{ background: 'rgba(0,229,255,0.05)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 3, outline: 'none' }}
                  placeholder={currentUser.password || currentUser.pin ? 'Enter current PIN or password...' : 'No credential set yet — leave blank'}
                  value={secCurrent}
                  onChange={e => setSecCurrent(e.target.value)}
                />

                {secMethod === 'pin' ? (
                  <>
                    <div className="text-xs mono tracking-[0.2em] uppercase mb-1 block" style={{ color: 'var(--text-dim)' }}>New 4-Digit PIN</div>
                    <input
                      type="password"
                      inputMode="numeric"
                      maxLength={4}
                      className="w-full px-3 py-2.5 mono text-sm font-bold mb-3"
                      style={{ background: 'rgba(0,229,255,0.05)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 3, outline: 'none' }}
                      placeholder="4 digits..."
                      value={secNewPin}
                      onChange={e => setSecNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    />
                    <div className="text-xs mono tracking-[0.2em] uppercase mb-1 block" style={{ color: 'var(--text-dim)' }}>Confirm New PIN</div>
                    <input
                      type="password"
                      inputMode="numeric"
                      maxLength={4}
                      className="w-full px-3 py-2.5 mono text-sm font-bold mb-4"
                      style={{ background: 'rgba(0,229,255,0.05)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 3, outline: 'none' }}
                      placeholder="4 digits..."
                      value={secNewPin2}
                      onChange={e => setSecNewPin2(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    />
                    <button className="btn btn-cyan w-full py-3 text-sm font-black tracking-widest" onClick={handleChangePin}>
                      UPDATE PIN
                    </button>
                  </>
                ) : (
                  <>
                    <div className="text-xs mono tracking-[0.2em] uppercase mb-1 block" style={{ color: 'var(--text-dim)' }}>New Password</div>
                    <input
                      type="password"
                      className="w-full px-3 py-2.5 mono text-sm font-bold mb-3"
                      style={{ background: 'rgba(0,229,255,0.05)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 3, outline: 'none' }}
                      placeholder="At least 6 characters..."
                      value={secNewPassword}
                      onChange={e => setSecNewPassword(e.target.value)}
                    />
                    <div className="text-xs mono tracking-[0.2em] uppercase mb-1 block" style={{ color: 'var(--text-dim)' }}>Confirm New Password</div>
                    <input
                      type="password"
                      className="w-full px-3 py-2.5 mono text-sm font-bold mb-4"
                      style={{ background: 'rgba(0,229,255,0.05)', border: '1px solid var(--border)', color: 'var(--text)', borderRadius: 3, outline: 'none' }}
                      placeholder="Repeat password..."
                      value={secNewPassword2}
                      onChange={e => setSecNewPassword2(e.target.value)}
                    />
                    <button className="btn btn-cyan w-full py-3 text-sm font-black tracking-widest" onClick={handleChangePassword}>
                      UPDATE PASSWORD
                    </button>
                  </>
                )}

                {secMsg && (
                  <div className="mt-3 text-xs mono text-center" style={{ color: secMsg.ok ? 'var(--green)' : 'var(--red)' }}>
                    {secMsg.text}
                  </div>
                )}
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  );
}
