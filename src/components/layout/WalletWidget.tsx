import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useUser } from '@/contexts/UserContext';
import { useGame } from '@/contexts/GameContext';
import { TransactionType, User } from '@/types';

const QUICK_AMOUNTS = [10, 20, 50, 100, 200, 500];

function GetCoinsPanel({ currentUser, addCredits }: { currentUser: User; addCredits: (id: string, amt: number, type?: TransactionType, desc?: string) => void }) {
  const [amount, setAmount] = useState(100);
  const [processing, setProcessing] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const handleSubmit = () => {
    if (!amount || amount < 1) return;
    setProcessing(true);
    setTimeout(() => {
      addCredits(currentUser.id, amount, 'admin_add', `Reload — ${amount} coins added`);
      setSuccessMsg(`✓ ${amount} coins added!`);
      setProcessing(false);
      setAmount(100);
      setTimeout(() => setSuccessMsg(''), 3000);
    }, 1000);
  };

  return (
    <div className="p-4 flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-2">
        {QUICK_AMOUNTS.map(a => (
          <button
            key={a}
            type="button"
            className="btn py-2 text-sm font-black tracking-widest"
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
      <div className="flex gap-2">
        <input
          type="number"
          min="1"
          value={amount}
          onChange={e => setAmount(Number(e.target.value))}
          className="flex-1 bg-transparent border border-[var(--border)] px-3 py-2 text-sm mono outline-none focus:border-[var(--gold)]"
          style={{ color: 'var(--text)' }}
          placeholder="Custom amount..."
        />
        <button
          className="btn btn-gold px-5 py-2 text-sm font-black tracking-widest"
          disabled={!amount || amount < 1 || processing}
          onClick={handleSubmit}
          style={{ opacity: (!amount || processing) ? 0.5 : 1 }}
        >
          {processing ? '⟳' : '◈ RELOAD'}
        </button>
      </div>
      <div className="flex items-center justify-between text-xs mono px-1">
        <span style={{ color: 'var(--text)' }}>Current Balance</span>
        <span className="font-black" style={{ color: 'var(--green)' }}>{currentUser.credits.toLocaleString()} coins</span>
      </div>
      {successMsg && <div className="text-sm mono font-black text-center" style={{ color: 'var(--green)' }}>{successMsg}</div>}
    </div>
  );
}

function CoinsInAction() {
  const { users } = useUser();
  const { game } = useGame();

  const activeUsers = users.filter(u => !u.isAdmin && u.online);
  const totalCoins = activeUsers.reduce((s, u) => s + u.credits, 0);
  const inQueue = [
    ...game.teamAQueue, ...game.teamBQueue,
    ...game.nextTeamAQueue, ...game.nextTeamBQueue,
  ].reduce((s, b) => s + b.amount, 0);

  return (
    <div
      className="hud-panel flex items-center justify-between px-4 py-2"
      style={{ borderColor: 'rgba(255,215,0,0.2)' }}
    >
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--green)', boxShadow: '0 0 6px var(--green)' }} />
        <span className="text-xs mono text-[var(--text)] tracking-widest">COINS IN ACTION</span>
      </div>
      <div className="flex items-center gap-6">
        <div className="flex flex-col items-center">
          <span className="mono text-lg font-black" style={{ color: 'var(--green)', textShadow: '0 0 3px rgba(0,255,65,0.5)' }}>
            {totalCoins.toLocaleString()}
          </span>
          <span className="text-xs text-[var(--text)] mono tracking-widest" style={{ fontSize: '0.6rem' }}>ALL USERS</span>
        </div>
        <div className="w-px h-6" style={{ background: 'var(--border)' }} />
        <div className="flex flex-col items-center">
          <span className="mono text-lg font-black" style={{ color: inQueue > 0 ? 'var(--gold)' : 'var(--text)', textShadow: inQueue > 0 ? '0 0 3px rgba(255,215,0,0.5)' : 'none' }}>
            {inQueue.toLocaleString()}
          </span>
          <span className="text-xs text-[var(--text)] mono tracking-widest" style={{ fontSize: '0.6rem' }}>IN QUEUES</span>
        </div>
        <div className="w-px h-6" style={{ background: 'var(--border)' }} />
        <div className="flex flex-col items-center">
          <span className="mono text-lg font-black" style={{ color: 'var(--cyan)', textShadow: '0 0 3px rgba(0,229,255,0.5)' }}>
            {activeUsers.length}
          </span>
          <span className="text-xs text-[var(--text)] mono tracking-widest" style={{ fontSize: '0.6rem' }}>PLAYERS</span>
        </div>
      </div>
    </div>
  );
}

export { CoinsInAction };

type WalletTab = 'receipts' | 'bets' | 'transactions' | 'membership' | 'getcoins' | 'p2p' | 'challenges';

const typeColor: Record<string, string> = {
  bet_placed: 'var(--cyan)', bet_refund: 'var(--gold)', bet_win: 'var(--green)',
  bet_loss: 'var(--red)', tip_given: 'var(--red)', tip_received: 'var(--green)',
  admin_add: 'var(--green)', admin_deduct: 'var(--red)', cashout: 'var(--gold)',
  membership_activate: 'var(--cyan)', membership_renew: 'var(--cyan)', membership_cancel: 'var(--text)',
  transfer_sent: 'var(--red)', transfer_received: 'var(--green)',
  challenge_escrow: 'var(--red)', challenge_win: 'var(--green)', challenge_refund: 'var(--cyan)',
};
const typeLabel: Record<string, string> = {
  bet_placed: 'BET', bet_refund: 'REFUND', bet_win: 'WIN', bet_loss: 'LOSS',
  tip_given: 'TIP OUT', tip_received: 'TIP IN', admin_add: 'RELOAD', admin_deduct: 'DEDUCT',
  cashout: 'CASHOUT', membership_activate: 'MEMBER', membership_renew: 'RENEWED', membership_cancel: 'CANCELLED',
  transfer_sent: 'P2P SENT', transfer_received: 'P2P RECEIVED',
  challenge_escrow: 'ESCROW', challenge_win: 'WIN', challenge_refund: 'REFUND',
};
const txSign: Record<string, string> = {
  bet_placed: '−', bet_loss: '−', tip_given: '−', admin_deduct: '−', cashout: '−',
  bet_refund: '+', bet_win: '+', tip_received: '+', admin_add: '+', membership_activate: '−', membership_renew: '−',
  transfer_sent: '−', transfer_received: '+',
  challenge_escrow: '−', challenge_win: '+', challenge_refund: '+',
};

export default function WalletWidget() {
  const { currentUser, addCredits, updateMembership, setCurrentUser, transferCredits, users, challenges, createChallenge, acceptChallenge, cancelChallenge } = useUser();
  const pendingChallenges = challenges.filter(c => c.opponentId === currentUser?.id && c.status === 'pending').length;
  const { game, gameHistory, isAdmin, setIsAdmin } = useGame();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [walletTab, setWalletTab] = useState<WalletTab>('receipts');
  const [cashoutAmt, setCashoutAmt] = useState('');
  const [cashoutMsg, setCashoutMsg] = useState('');
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [p2pTo, setP2pTo] = useState('');
  const [p2pAmt, setP2pAmt] = useState('');
  const [p2pMsg, setP2pMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [chOpponent, setChOpponent] = useState('');
  const [chMyPlayer, setChMyPlayer] = useState('');
  const [chTheirPlayer, setChTheirPlayer] = useState('');
  const [chAmt, setChAmt] = useState('');
  const [chPhone, setChPhone] = useState('');
  const [chMsg, setChMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [chBusy, setChBusy] = useState(false);
  const [chJudgeLink, setChJudgeLink] = useState('');
  const [chCopied, setChCopied] = useState(false);

  if (!currentUser) {
    return (
      <div className="hud-panel px-4 py-2 flex items-center gap-2">
        <span className="text-xs mono text-[var(--text)] tracking-widest">NO PLAYER SELECTED</span>
      </div>
    );
  }

  const allQueued = [...game.teamAQueue, ...game.teamBQueue, ...game.nextTeamAQueue, ...game.nextTeamBQueue];
  const myBets = allQueued.filter(b => b.userId === currentUser.id);
  const matchedTotal = myBets.filter(b => b.booked).reduce((s, b) => s + b.amount, 0);
  const unmatchedTotal = myBets.filter(b => !b.booked).reduce((s, b) => s + b.amount, 0);
  const pendingTotal = matchedTotal + unmatchedTotal;
  const total = currentUser.credits + pendingTotal;

  const fallbackA = game.teamAName;
  const fallbackB = game.teamBName;
  const myHistoryBets = gameHistory.flatMap(r => [...r.bets.teamA, ...r.bets.teamB]).filter(b => b.userId === currentUser.id && b.booked);
  const wins = myHistoryBets.filter(b => b.won).length;
  const totalBets = myHistoryBets.length;
  const winPct = totalBets > 0 ? Math.round((wins / totalBets) * 100) : null;

  const liveMatched = [...game.teamAQueue, ...game.teamBQueue]
    .filter(b => b.booked && b.userId === currentUser.id)
    .map(b => ({ type: 'live' as const, id: b.id, gameNumber: game.currentGameNumber, teamSide: b.teamSide, amount: b.amount, nameA: game.teamAName, nameB: game.teamBName }));

  const settled = gameHistory.flatMap(record => {
    const nameA = (!record.teamAName || record.teamAName === 'Player A') ? fallbackA : record.teamAName;
    const nameB = (!record.teamBName || record.teamBName === 'Player B') ? fallbackB : record.teamBName;
    return [...record.bets.teamA.map(b => ({ ...b, teamSide: 'A' as const, nameA, nameB, record })),
            ...record.bets.teamB.map(b => ({ ...b, teamSide: 'B' as const, nameA, nameB, record }))].filter(b => b.userId === currentUser.id && b.booked);
  });

  const receiptCount = liveMatched.length + settled.length;
  const tipsGiven = currentUser.tipsGiven ?? 0;
  const tipsReceived = currentUser.tipsReceived ?? 0;

  // Bet history
  const mySettledBets = gameHistory.flatMap(r => [
    ...r.bets.teamA.map(b => ({ ...b, record: r, side: 'A' as const })),
    ...r.bets.teamB.map(b => ({ ...b, record: r, side: 'B' as const })),
  ]).filter(b => b.userId === currentUser.id && b.booked);

  // Transactions
  const txList = (currentUser.transactions ?? []);

  // Membership
  const mem = currentUser.membership;
  const isPremium = isAdmin || (mem?.tier === 'premium' && !mem.cancelledAt);
  const isCancelled = mem?.tier === 'premium' && !!mem.cancelledAt;

  const handleCashout = () => {
    const amt = parseInt(cashoutAmt);
    if (!amt || amt <= 0) { setCashoutMsg('Enter a valid amount.'); return; }
    if (amt > currentUser.credits) { setCashoutMsg('Insufficient coins.'); return; }
    addCredits(currentUser.id, -amt, 'cashout', `Cashout of ${amt} coins`);
    setCashoutMsg(`✓ ${amt} coins cashed out.`);
    setCashoutAmt('');
    setTimeout(() => setCashoutMsg(''), 3000);
  };

  const handleCancelMembership = () => {
    updateMembership(currentUser.id, { ...mem!, cancelledAt: Date.now() });
    setConfirmCancel(false);
  };

  const tabs: { id: WalletTab; label: string; count?: number }[] = [
    { id: 'receipts', label: 'RECEIPTS', count: receiptCount },
    { id: 'bets', label: 'BETS', count: mySettledBets.length },
    { id: 'transactions', label: 'TXN', count: txList.length },
    { id: 'membership', label: 'MEMBERSHIP' },
    { id: 'p2p', label: 'P2P TRANSFER' },
  ];

  return (
    <div className="hud-panel overflow-hidden w-full" style={{ borderColor: 'rgba(255,215,0,0.3)' }}>
      {/* Stats row */}
      <div className="flex items-center gap-0">
        <button
          className="flex items-center gap-2 px-4 py-2.5 flex-shrink-0 hover:bg-black transition-colors"
          style={{
            borderRight: '1px solid var(--border)',
            backgroundImage: 'url(https://eidk95seyu2.exactdn.com/en/blog/wp-content/uploads/2023/11/apr29-casino-how-to-manage-your-bankroll-for-baccarat-success-header-min.jpg?strip=all)',
            backgroundSize: '100%',
            backgroundPosition: 'center 70%',
            position: 'relative',
          }}
          onClick={() => setOpen(v => !v)}
        >
          {pendingChallenges > 0 && (
            <span style={{ position: 'absolute', top: 6, right: 6, width: 8, height: 8, borderRadius: '50%', background: 'var(--gold)', boxShadow: '0 0 6px var(--gold)', zIndex: 1 }} />
          )}
          <span className="text-base" style={{ color: '#000' }}>◈</span>
          <div className="flex flex-col leading-tight items-start">
            <span className="text-sm mono font-black uppercase tracking-widest" style={{ color: '#000', fontWeight: 900 }}>
              {currentUser.name.toUpperCase()}'S WALLET
            </span>
            <span className="tracking-wider flex items-center gap-1 font-black" style={{ fontSize: '0.7rem', color: '#000', fontWeight: 900 }}>
              {open ? 'CLOSE' : 'EXPAND'}
              <span style={{ color: '#000' }}>{open ? '▲' : '▼'}</span>
            </span>
          </div>
          <Link
            to="/settings"
            onClick={e => e.stopPropagation()}
            className="ml-2 flex items-center justify-center"
            style={{ color: 'var(--cyan)', fontSize: '1.2rem', textDecoration: 'none', opacity: 0.85 }}
            title="Account Settings"
          >
            ⚙
          </Link>
        </button>

        <div className="flex flex-col items-center px-4 py-2.5 flex-1" style={{ borderRight: '1px solid var(--border)' }}>
          <span className="mono text-xl font-black" style={{ color: 'var(--green)', textShadow: '0 0 3px rgba(0,255,65,0.5)' }}>{currentUser.credits}</span>
          <span className="text-xs text-[var(--text)] uppercase tracking-widest" style={{ fontSize: '0.6rem' }}>AVAILABLE</span>
        </div>
        <div className="flex flex-col items-center px-4 py-2.5 flex-1" style={{ borderRight: '1px solid var(--border)' }}>
          <span className="mono text-xl font-black" style={{ color: unmatchedTotal > 0 ? 'var(--cyan)' : 'var(--text)' }}>{unmatchedTotal}</span>
          <span className="text-xs text-[var(--text)] uppercase tracking-widest" style={{ fontSize: '0.6rem' }}>PENDING</span>
        </div>
        <div className="flex flex-col items-center px-4 py-2.5 flex-1" style={{ borderRight: '1px solid var(--border)' }}>
          <span className="mono text-xl font-black" style={{ color: matchedTotal > 0 ? 'var(--green)' : 'var(--text)' }}>{matchedTotal}</span>
          <span className="text-xs text-[var(--text)] uppercase tracking-widest" style={{ fontSize: '0.6rem' }}>MATCHED</span>
        </div>
        <div className="flex flex-col items-center px-4 py-2.5 flex-1" style={{ borderRight: '1px solid var(--border)' }}>
          <span className="mono text-xl font-black" style={{ color: 'var(--gold)', textShadow: '0 0 3px rgba(255,215,0,0.4)' }}>{total}</span>
          <span className="text-xs text-[var(--text)] uppercase tracking-widest" style={{ fontSize: '0.6rem' }}>TOTAL</span>
        </div>
        <div className="flex flex-col items-center px-4 py-2.5 flex-1">
          <span className="mono text-xl font-black" style={{ color: winPct === null ? 'var(--text)' : winPct >= 50 ? 'var(--green)' : 'var(--red)', textShadow: winPct !== null ? `0 0 8px ${winPct >= 50 ? 'var(--green)' : 'var(--red)'}` : 'none' }}>
            {winPct === null ? '—' : `${winPct}%`}
          </span>
          <span className="text-xs text-[var(--text)] uppercase tracking-widest" style={{ fontSize: '0.6rem' }}>
            WIN {totalBets > 0 ? `${wins}W·${totalBets - wins}L` : 'RATE'}
          </span>
        </div>
      </div>

      {/* Expanded panel */}
      {open && (
        <div className="border-t border-[var(--border)]">
          {/* Tab bar */}
          <div className="flex border-b border-[var(--border)] overflow-x-auto" style={{ background: 'rgba(0,0,0,0.3)', scrollbarWidth: 'none' }}>
            {tabs.map(t => (
              <button
                key={t.id}
                onClick={() => setWalletTab(t.id)}
                className="px-4 py-2 text-xs font-black tracking-widest uppercase transition-colors flex items-center gap-1"
                style={{
                  color: walletTab === t.id ? 'var(--cyan)' : 'var(--text)',
                  borderBottom: walletTab === t.id ? '2px solid var(--cyan)' : '2px solid transparent',
                  background: 'transparent',
                  cursor: 'pointer',
                }}
              >
                {t.label}
                {t.count !== undefined && t.count > 0 && (
                  <span className="mono text-xs" style={{ color: walletTab === t.id ? 'var(--cyan)' : 'var(--text)' }}>({t.count})</span>
                )}
              </button>
            ))}
            <Link
              to="/membership"
              onClick={() => setOpen(false)}
              className="px-4 py-2 text-xs font-black tracking-widest uppercase flex items-center"
              style={{ color: 'var(--gold)', textDecoration: 'none', whiteSpace: 'nowrap' }}
            >
              + COINS
            </Link>
            <div className="flex-1" />
            <button
              className="px-4 py-2 text-xs mono tracking-widest"
              style={{ color: 'var(--text)', cursor: 'pointer' }}
              onClick={() => { setCurrentUser(null); if (isAdmin) setIsAdmin(false); navigate('/'); }}
            >
              LOG OUT
            </button>
          </div>

          {/* ── RECEIPTS ── */}
          {walletTab === 'receipts' && (
            <div className="flex flex-col divide-y divide-[var(--border)] max-h-72 overflow-y-auto">
              <div className="flex items-center justify-between px-4 py-2" style={{ background: 'rgba(255,215,0,0.04)' }}>
                <span className="text-xs mono tracking-widest" style={{ color: 'var(--text)' }}>TIPS GIVEN</span>
                <span className="mono font-black text-sm" style={{ color: tipsGiven > 0 ? 'var(--red)' : 'var(--text)' }}>{tipsGiven > 0 ? `-${tipsGiven}` : '—'}</span>
              </div>
              <div className="flex items-center justify-between px-4 py-2" style={{ background: 'rgba(255,215,0,0.04)' }}>
                <span className="text-xs mono tracking-widest" style={{ color: 'var(--text)' }}>TIPS RECEIVED</span>
                <span className="mono font-black text-sm" style={{ color: tipsReceived > 0 ? 'var(--green)' : 'var(--text)' }}>{tipsReceived > 0 ? `+${tipsReceived}` : '—'}</span>
              </div>
              {receiptCount === 0 ? (
                <div className="flex items-center justify-center h-14 text-xs mono text-[var(--text)] tracking-widest">NO RECEIPTS YET</div>
              ) : (
                <>
                  {liveMatched.map(r => {
                    const betColor = r.teamSide === 'A' ? 'var(--cyan)' : 'var(--red)';
                    const teamBetOn = r.teamSide === 'A' ? r.nameA : r.nameB;
                    return (
                      <div key={r.id} className="flex items-center justify-between px-4 py-2 hover:bg-black" style={{ borderLeft: '3px solid var(--gold)' }}>
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full animate-pulse flex-shrink-0" style={{ background: 'var(--gold)', boxShadow: '0 0 4px var(--gold)' }} />
                            <span className="text-xs mono font-black" style={{ color: betColor }}>GAME #{r.gameNumber} — {teamBetOn.toUpperCase()}</span>
                            {r.txId && <span className="mono text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>#{r.txId}</span>}
                          </div>
                          <span className="text-xs mono tracking-wider" style={{ color: 'var(--gold)', paddingLeft: 14 }}>LIVE · MATCHED</span>
                        </div>
                        <div className="mono font-black text-sm px-2 py-1" style={{ color: 'var(--gold)', background: 'rgba(255,215,0,0.1)', border: '1px solid rgba(255,215,0,0.3)' }}>{r.amount}</div>
                      </div>
                    );
                  })}
                  {settled.map((r, i) => {
                    const betColor = r.teamSide === 'A' ? 'var(--cyan)' : 'var(--red)';
                    const teamBetOn = r.teamSide === 'A' ? r.nameA : r.nameB;
                    const winner = r.record.winningTeam === 'A' ? r.nameA : r.nameB;
                    const winnerColor = r.record.winningTeam === 'A' ? 'var(--cyan)' : 'var(--red)';
                    return (
                      <div key={`${r.record.id}-${i}`} className="flex items-center justify-between px-4 py-2 hover:bg-black" style={{ borderLeft: `3px solid ${betColor}` }}>
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-2">
                            <span className="text-xs mono font-black" style={{ color: betColor }}>GAME #{r.record.gameNumber} — {teamBetOn.toUpperCase()}</span>
                            {r.txId && <span className="mono text-xs" style={{ color: 'rgba(255,255,255,0.25)' }}>#{r.txId}</span>}
                          </div>
                          <span className="text-xs mono text-[var(--text)] tracking-wider">
                            {new Date(r.record.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}{'  ·  '}<span style={{ color: winnerColor }}>W: {winner}</span>
                          </span>
                        </div>
                        <div className="mono font-black text-sm px-2 py-1" style={{ color: r.won ? 'var(--green)' : 'var(--red)', background: r.won ? 'rgba(0,255,65,0.1)' : 'rgba(255,0,64,0.1)', border: `1px solid ${r.won ? 'rgba(0,255,65,0.3)' : 'rgba(255,0,64,0.3)'}` }}>
                          {r.won ? '+' : '-'}{r.amount}
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          )}

          {/* ── BET HISTORY ── */}
          {walletTab === 'bets' && (
            <div className="max-h-72 overflow-y-auto">
              {mySettledBets.length === 0 ? (
                <div className="flex items-center justify-center h-16 text-xs mono text-[var(--text)] tracking-widest">NO BETS YET</div>
              ) : (
                <div className="divide-y divide-[var(--border)]">
                  <div className="grid grid-cols-6 px-4 py-2" style={{ background: 'rgba(0,229,255,0.04)' }}>
                    {['Tx', 'Game', 'Side', 'Amt', 'Result', 'Date'].map(h => (
                      <div key={h} className="text-xs mono text-[var(--text)] tracking-widest uppercase">{h}</div>
                    ))}
                  </div>
                  {[...mySettledBets].reverse().map((b, i) => {
                    const teamName = b.side === 'A' ? b.record.teamAName : b.record.teamBName;
                    const dateStr = new Date(b.record.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' });
                    return (
                      <div key={i} className="grid grid-cols-6 px-4 py-2 items-center hover:bg-black">
                        <div className="text-xs mono" style={{ color: 'rgba(255,255,255,0.4)' }}>{b.txId ? `#${b.txId}` : '—'}</div>
                        <div className="text-xs mono text-[var(--text)]">#{b.record.gameNumber}</div>
                        <div className="text-xs font-black uppercase tracking-wide" style={{ color: b.side === 'A' ? 'var(--cyan)' : 'var(--red)' }}>{teamName}</div>
                        <div className="text-xs mono" style={{ color: 'var(--text)' }}>{b.amount}</div>
                        <div className="text-xs mono font-black" style={{ color: b.won ? 'var(--green)' : 'var(--red)' }}>{b.won ? `+${b.amount}` : `-${b.amount}`}</div>
                        <div className="text-xs mono text-[var(--text)]">{dateStr}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── TRANSACTIONS ── */}
          {walletTab === 'transactions' && (
            <div className="max-h-72 overflow-y-auto">
              {txList.length === 0 ? (
                <div className="flex items-center justify-center h-16 text-xs mono text-[var(--text)] tracking-widest">NO TRANSACTIONS YET</div>
              ) : (
                <div className="divide-y divide-[var(--border)]">
                  <div className="grid grid-cols-4 px-4 py-2" style={{ background: 'rgba(0,229,255,0.04)' }}>
                    {['Type', 'Description', 'Amount', 'Date'].map(h => (
                      <div key={h} className="text-xs mono text-[var(--text)] tracking-widest uppercase">{h}</div>
                    ))}
                  </div>
                  {txList.map((tx, i) => {
                    const isTransfer = tx.type === 'transfer_sent' || tx.type === 'transfer_received';
                    if (isTransfer) {
                      const isSent = tx.type === 'transfer_sent';
                      // description format: "P2P transfer to NAME" or "P2P transfer from NAME"
                      const otherParty = tx.description.replace(/^P2P transfer (to|from) /, '');
                      return (
                        <div key={`${tx.id}-${i}`} className="px-4 py-2 hover:bg-black">
                          <div className="flex items-center justify-between mb-1">
                            <span className="mono text-xs font-black px-1.5 py-0.5" style={{ background: isSent ? 'rgba(255,0,64,0.12)' : 'rgba(0,255,136,0.12)', color: typeColor[tx.type], border: `1px solid ${typeColor[tx.type]}44` }}>
                              {isSent ? 'SENT' : 'RECEIVED'}
                            </span>
                            <span className="mono text-xs font-black" style={{ color: typeColor[tx.type] }}>
                              {txSign[tx.type]}{tx.amount} coins
                            </span>
                          </div>
                          <div className="flex flex-col gap-0.5 px-2 py-1.5 rounded" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                            {isSent ? (
                              <>
                                <div className="mono text-xs flex items-center gap-2">
                                  <span style={{ color: 'rgba(255,255,255,0.3)', minWidth: 28 }}>FROM</span>
                                  <span style={{ color: 'var(--gold)', fontWeight: 900 }}>{currentUser.name}</span>
                                </div>
                                <div className="mono text-xs flex items-center gap-2">
                                  <span style={{ color: 'rgba(255,255,255,0.3)', minWidth: 28 }}>TO</span>
                                  <span style={{ color: 'var(--cyan)', fontWeight: 900 }}>{otherParty}</span>
                                </div>
                              </>
                            ) : (
                              <>
                                <div className="mono text-xs flex items-center gap-2">
                                  <span style={{ color: 'rgba(255,255,255,0.3)', minWidth: 28 }}>FROM</span>
                                  <span style={{ color: 'var(--gold)', fontWeight: 900 }}>{otherParty}</span>
                                </div>
                                <div className="mono text-xs flex items-center gap-2">
                                  <span style={{ color: 'rgba(255,255,255,0.3)', minWidth: 28 }}>TO</span>
                                  <span style={{ color: 'var(--cyan)', fontWeight: 900 }}>{currentUser.name}</span>
                                </div>
                              </>
                            )}
                            <div className="mono text-xs flex items-center gap-2">
                              <span style={{ color: 'rgba(255,255,255,0.3)', minWidth: 28 }}>DATE</span>
                              <span style={{ color: 'rgba(255,255,255,0.4)' }}>
                                {new Date(tx.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}{' '}
                                {new Date(tx.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return (
                      <div key={`${tx.id}-${i}`} className="grid grid-cols-4 px-4 py-2 items-center hover:bg-black">
                        <div className="text-xs mono font-black" style={{ color: typeColor[tx.type] ?? 'var(--text)' }}>{typeLabel[tx.type] ?? tx.type}</div>
                        <div className="text-xs" style={{ color: 'var(--text)' }}>
                          {tx.description}
                          {tx.betTxId && <span className="mono ml-2" style={{ color: 'rgba(255,255,255,0.3)' }}>#{tx.betTxId}</span>}
                        </div>
                        <div className="text-xs mono font-black" style={{ color: typeColor[tx.type] ?? 'var(--text)' }}>
                          {txSign[tx.type] ?? ''}{tx.amount}
                          {tx.type === 'challenge_win' && <span style={{ opacity: 0.7 }}> (+{tx.amount / 2})</span>}
                        </div>
                        <div className="text-xs mono text-[var(--text)]">
                          {new Date(tx.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}{' '}
                          {new Date(tx.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── MEMBERSHIP ── */}
          {walletTab === 'membership' && (
            <div className="p-4 flex flex-col gap-3">
              {/* Status */}
              <div className="flex items-center justify-between px-4 py-3 hud-panel" style={{ border: `1px solid ${isPremium ? 'var(--gold)' : 'var(--border)'}`, background: 'rgba(0,0,0,0.3)' }}>
                <div className="flex items-center gap-3">
                  <span style={{ color: isPremium ? 'var(--gold)' : 'var(--text)', fontSize: '1.5rem' }}>
                    {currentUser.isAdmin ? '⚙' : isPremium ? '★' : '◎'}
                  </span>
                  <div>
                    <div className="font-black uppercase tracking-widest text-sm" style={{ color: isPremium ? 'var(--gold)' : 'var(--text)' }}>
                      {currentUser.isAdmin ? 'Admin Account' : isPremium ? 'Premium Member' : isCancelled ? 'Cancelled' : 'Free Account'}
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: 'var(--text)' }}>
                      {currentUser.isAdmin && 'Full platform access'}
                      {isPremium && mem?.renewsAt && `Renews ${new Date(mem.renewsAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}`}
                      {isCancelled && mem?.renewsAt && `Active until ${new Date(mem.renewsAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}`}
                      {!mem && !currentUser.isAdmin && 'Upgrade to place bets'}
                    </div>
                  </div>
                </div>
                {isPremium && <span className="mono text-xs px-2 py-0.5 font-black" style={{ border: '1px solid var(--gold)', color: 'var(--gold)' }}>ACTIVE</span>}
                {isCancelled && <span className="mono text-xs px-2 py-0.5 font-black" style={{ border: '1px solid var(--red)', color: 'var(--red)' }}>CANCELLED</span>}
                {!mem && !currentUser.isAdmin && <span className="mono text-xs px-2 py-0.5 font-black" style={{ border: '1px solid var(--text)', color: 'var(--text)' }}>FREE</span>}
              </div>

              {/* Cashout */}
              <div className="hud-panel px-4 py-3" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,215,0,0.2)' }}>
                <div className="text-xs mono tracking-[0.3em] text-[var(--gold)] uppercase mb-2">Cashout</div>
                <div className="flex gap-2 mb-2">
                  {[50, 100, 200].map(amt => (
                    <button key={amt} className="btn btn-ghost flex-1 py-1 text-xs font-black"
                      onClick={() => setCashoutAmt(String(amt))}
                      style={{ borderColor: cashoutAmt === String(amt) ? 'var(--gold)' : undefined, color: cashoutAmt === String(amt) ? 'var(--gold)' : undefined }}>
                      {amt}
                    </button>
                  ))}
                  <button className="btn btn-ghost px-3 text-xs font-black" onClick={() => setCashoutAmt(String(currentUser.credits))}>MAX</button>
                </div>
                <div className="flex gap-2">
                  <input type="number" className="flex-1 bg-transparent border border-[var(--border)] px-2 py-1.5 text-xs mono outline-none placeholder:text-[var(--text)] focus:border-[var(--gold)]"
                    style={{ color: 'var(--text)' }} placeholder="Custom amount..." value={cashoutAmt} onChange={e => setCashoutAmt(e.target.value)} />
                  <button className="btn btn-gold px-4 py-1.5 text-xs font-black tracking-widest" onClick={handleCashout}>CASHOUT</button>
                </div>
                <div className="flex items-center justify-between mt-2 text-xs mono">
                  <span style={{ color: 'var(--text)' }}>Available Balance</span>
                  <span className="font-black" style={{ color: 'var(--green)' }}>{currentUser.credits.toLocaleString()} coins</span>
                </div>
                {cashoutMsg && <div className="mt-1.5 text-xs mono" style={{ color: cashoutMsg.startsWith('✓') ? 'var(--green)' : 'var(--red)' }}>{cashoutMsg}</div>}
              </div>

              {/* Upgrade / Cancel */}
              {!isPremium && !currentUser.isAdmin && (
                <button className="btn btn-gold py-2.5 text-sm font-black tracking-widest w-full" onClick={() => { setOpen(false); navigate('/membership'); }}>
                  ★ UPGRADE TO PREMIUM
                </button>
              )}
              {isPremium && !confirmCancel && (
                <button className="btn btn-ghost py-2 text-xs font-black tracking-widest w-full" style={{ borderColor: 'rgba(255,0,64,0.3)', color: 'var(--red)' }} onClick={() => setConfirmCancel(true)}>
                  CANCEL MEMBERSHIP
                </button>
              )}
              {isPremium && confirmCancel && (
                <div className="flex items-center gap-3">
                  <span className="text-xs mono flex-1" style={{ color: 'var(--text)' }}>Are you sure?</span>
                  <button className="btn btn-red px-4 py-1.5 text-xs font-black" onClick={handleCancelMembership}>YES, CANCEL</button>
                  <button className="btn btn-ghost px-4 py-1.5 text-xs font-black" onClick={() => setConfirmCancel(false)}>KEEP IT</button>
                </div>
              )}
            </div>
          )}

          {/* ── CHALLENGES ── */}
          {walletTab === 'challenges' && (() => {
            const uid = currentUser.id;
            const myChallenges = challenges.filter(c => c.creatorId === uid || c.opponentId === uid);
            const incoming = myChallenges.filter(c => c.opponentId === uid && c.status === 'pending');
            const outgoing = myChallenges.filter(c => c.creatorId === uid && c.status === 'pending');
            const active = myChallenges.filter(c => c.status === 'accepted');
            const history = myChallenges.filter(c => c.status === 'judged' || c.status === 'cancelled');
            const judged = myChallenges.filter(c => c.status === 'judged');
            const chWins = judged.filter(c => c.winnerId === uid).length;
            const chLosses = judged.filter(c => c.winnerId && c.winnerId !== uid).length;
            const chTotal = chWins + chLosses;
            const chWinPct = chTotal > 0 ? Math.round((chWins / chTotal) * 100) : null;

            const statusColor = (s: string) =>
              s === 'accepted' ? 'var(--gold)' : s === 'judged' ? 'var(--green)' : s === 'cancelled' ? 'var(--text)' : 'var(--cyan)';

            return (
              <div className="flex flex-col gap-4 p-4 max-h-[480px] overflow-y-auto">

                {/* W/L ratio */}
                <div>
                  <div className="text-xs mono tracking-widest mb-2" style={{ color: 'var(--cyan)' }}>CHALLENGE RECORD</div>
                  <div className="flex items-center overflow-hidden" style={{ border: '1px solid rgba(0,229,255,0.2)', background: 'rgba(0,0,0,0.4)' }}>
                    <div className="flex flex-col items-center px-4 py-3 flex-1" style={{ borderRight: '1px solid rgba(255,255,255,0.08)' }}>
                      <span className="mono text-xl font-black" style={{ color: 'var(--green)' }}>{chWins}</span>
                      <span className="mono tracking-widest" style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.6rem' }}>WINS</span>
                    </div>
                    <div className="flex flex-col items-center px-4 py-3 flex-1" style={{ borderRight: '1px solid rgba(255,255,255,0.08)' }}>
                      <span className="mono text-xl font-black" style={{ color: 'var(--red)' }}>{chLosses}</span>
                      <span className="mono tracking-widest" style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.6rem' }}>LOSSES</span>
                    </div>
                    <div className="flex flex-col items-center px-4 py-3 flex-1" style={{ borderRight: '1px solid rgba(255,255,255,0.08)' }}>
                      <span className="mono text-xl font-black" style={{ color: 'rgba(255,255,255,0.7)' }}>{chTotal}</span>
                      <span className="mono tracking-widest" style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.6rem' }}>PLAYED</span>
                    </div>
                    <div className="flex flex-col items-center px-4 py-3 flex-1">
                      <span className="mono text-xl font-black" style={{ color: chWinPct !== null && chWinPct >= 50 ? 'var(--green)' : chWinPct !== null ? 'var(--red)' : 'rgba(255,255,255,0.4)' }}>
                        {chWinPct !== null ? `${chWinPct}%` : '—'}
                      </span>
                      <span className="mono tracking-widest" style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.6rem' }}>WIN RATE</span>
                    </div>
                  </div>
                </div>

                {/* New challenge form */}
                <div className="flex flex-col gap-3">
                  <div className="text-xs mono tracking-widest" style={{ color: 'var(--cyan)' }}>NEW CHALLENGE</div>
                  <input
                    className="bg-transparent border px-3 py-2 mono text-sm outline-none"
                    style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
                    placeholder="Opponent username..."
                    value={chOpponent}
                    onChange={e => { setChOpponent(e.target.value); setChMsg(null); }}
                    list="ch-users"
                  />
                  <datalist id="ch-users">
                    {users.filter(u => u.id !== currentUser.id).map(u => <option key={u.id} value={u.name} />)}
                  </datalist>
                  <div className="flex flex-col gap-1">
                    <div className="text-xs mono tracking-widest" style={{ color: 'var(--text)', opacity: 0.6 }}>PLAYERS IN ACTION</div>
                    <div className="flex gap-2">
                      <input
                        className="flex-1 bg-transparent border px-3 py-2 mono text-sm outline-none"
                        style={{ borderColor: 'var(--cyan)', color: 'var(--text)' }}
                        placeholder="My player..."
                        value={chMyPlayer}
                        onChange={e => { setChMyPlayer(e.target.value); setChMsg(null); }}
                      />
                      <input
                        className="flex-1 bg-transparent border px-3 py-2 mono text-sm outline-none"
                        style={{ borderColor: 'var(--red)', color: 'var(--text)' }}
                        placeholder="Their player..."
                        value={chTheirPlayer}
                        onChange={e => { setChTheirPlayer(e.target.value); setChMsg(null); }}
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="number" min={1}
                      className="flex-1 bg-transparent border px-3 py-2 mono text-sm outline-none"
                      style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
                      placeholder="Amount each..."
                      value={chAmt}
                      onChange={e => { setChAmt(e.target.value); setChMsg(null); }}
                    />
                    <input
                      type="tel"
                      className="flex-1 bg-transparent border px-3 py-2 mono text-sm outline-none"
                      style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
                      placeholder="Judge phone #..."
                      value={chPhone}
                      onChange={e => { setChPhone(e.target.value); setChMsg(null); }}
                    />
                  </div>
                  <button
                    className="btn btn-cyan w-full py-2 text-xs font-black tracking-widest"
                    disabled={chBusy}
                    onClick={async () => {
                      setChBusy(true); setChMsg(null);
                      const result = await createChallenge(chOpponent, parseInt(chAmt), chPhone, chMyPlayer, chTheirPlayer);
                      setChBusy(false);
                      if (result.success) {
                        setChMsg({ text: `✓ Challenge sent to ${chOpponent}! Waiting for them to accept.`, ok: true });
                        setChOpponent(''); setChAmt(''); setChPhone(''); setChMyPlayer(''); setChTheirPlayer('');
                      } else {
                        setChMsg({ text: result.error ?? 'Failed.', ok: false });
                      }
                    }}
                  >
                    {chBusy ? 'SENDING...' : 'SEND CHALLENGE'}
                  </button>
                  {chMsg && <div className="mono text-xs text-center" style={{ color: chMsg.ok ? 'var(--green)' : 'var(--red)' }}>{chMsg.text}</div>}
                </div>

                {/* Incoming challenges */}
                {incoming.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <div className="text-xs mono tracking-widest" style={{ color: 'var(--gold)' }}>INCOMING ({incoming.length})</div>
                    {incoming.map(c => (
                      <div key={c.id} className="flex flex-col gap-2 p-3" style={{ border: '1px solid rgba(255,215,0,0.3)', background: 'rgba(255,215,0,0.04)' }}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex flex-col gap-1">
                            <span className="text-xs font-black" style={{ color: 'var(--gold)' }}>{c.creatorName} is challenging you</span>
                            {(c.myPlayer || c.theirPlayer) && (
                              <div className="flex items-center gap-1 text-xs mono font-black">
                                <span style={{ color: 'var(--cyan)' }}>{c.myPlayer}</span>
                                <span style={{ color: 'var(--text)' }}>vs</span>
                                <span style={{ color: 'var(--red)' }}>{c.theirPlayer}</span>
                              </div>
                            )}
                            <span className="text-xs" style={{ color: 'var(--text)' }}>
                              {c.myPlayer && <>They're betting on <span style={{ color: 'var(--cyan)', fontWeight: 700 }}>{c.myPlayer}</span> · </>}
                              {c.amount} coins each · pot: <span style={{ color: 'var(--gold)' }}>{c.amount * 2}</span>
                            </span>
                            <span className="mono text-xs" style={{ color: 'var(--text)', opacity: 0.5, fontSize: '0.6rem' }}>
                              {new Date(c.createdAt).toLocaleString()}
                            </span>
                          </div>
                          <div className="flex gap-2 flex-shrink-0">
                            <button
                              className="btn btn-ghost px-2 py-1 text-xs"
                              onClick={async () => {
                                setChBusy(true);
                                const result = await cancelChallenge(c.id);
                                setChBusy(false);
                                if (!result.success) setChMsg({ text: result.error ?? 'Failed.', ok: false });
                              }}
                            >DECLINE</button>
                            <button
                              className="btn btn-gold px-2 py-1 text-xs font-black"
                              disabled={chBusy}
                              onClick={async () => {
                                setChBusy(true);
                                const result = await acceptChallenge(c.id);
                                setChBusy(false);
                                if (result.success) {
                                  if (result.judgeLink) setChJudgeLink(result.judgeLink);
                                  setChMsg({ text: `✓ Accepted! Judge has been notified.`, ok: true });
                                } else {
                                  setChMsg({ text: result.error ?? 'Failed.', ok: false });
                                }
                              }}
                            >ACCEPT</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Active / awaiting judge */}
                {active.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <div className="text-xs mono tracking-widest" style={{ color: 'var(--gold)' }}>AWAITING JUDGE</div>
                    {active.map(c => (
                      <div key={c.id} className="p-3 flex flex-col gap-2" style={{ border: '1px solid rgba(255,215,0,0.2)', background: 'rgba(0,0,0,0.3)' }}>
                        <div className="flex justify-between items-start">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1 text-xs mono font-black">
                              <span style={{ color: 'var(--cyan)' }}>{c.myPlayer}</span>
                              <span style={{ color: 'var(--text)' }}>vs</span>
                              <span style={{ color: 'var(--red)' }}>{c.theirPlayer}</span>
                            </div>
                            <span className="text-xs" style={{ color: 'var(--text)' }}>
                              {c.creatorName} on <span style={{ color: 'var(--cyan)', fontWeight: 700 }}>{c.myPlayer}</span> · {c.opponentName} on <span style={{ color: 'var(--red)', fontWeight: 700 }}>{c.theirPlayer}</span>
                            </span>
                            <span className="mono text-xs" style={{ color: 'var(--text)', opacity: 0.5, fontSize: '0.6rem' }}>
                              Accepted {c.acceptedAt ? new Date(c.acceptedAt).toLocaleString() : ''}
                            </span>
                          </div>
                          <span className="mono text-xs font-black flex-shrink-0" style={{ color: 'var(--gold)' }}>POT: {c.amount * 2}</span>
                        </div>
                        <div className="text-xs animate-pulse" style={{ color: 'var(--text)' }}>⏳ Waiting for judge decision...</div>
                        {(() => {
                          const link = c.judgeLink || chJudgeLink;
                          if (!link) return null;
                          return (
                            <div className="flex flex-col gap-1">
                              <div className="text-xs mono tracking-widest" style={{ color: 'var(--text)' }}>JUDGE LINK</div>
                              <div className="flex items-center gap-2 p-2" style={{ background: 'rgba(0,229,255,0.05)', border: '1px solid var(--border)' }}>
                                <span className="text-xs break-all flex-1 mono" style={{ color: 'var(--cyan)' }}>{link}</span>
                                <button
                                  className="flex-shrink-0 px-2 py-1 text-xs font-black mono tracking-widest"
                                  style={{
                                    border: `1px solid ${chCopied ? 'var(--green)' : 'var(--cyan)'}`,
                                    color: chCopied ? 'var(--green)' : 'var(--cyan)',
                                    background: chCopied ? 'rgba(0,255,65,0.08)' : 'rgba(0,229,255,0.08)',
                                    cursor: 'pointer', whiteSpace: 'nowrap',
                                  }}
                                  onClick={() => { navigator.clipboard.writeText(link); setChCopied(true); setTimeout(() => setChCopied(false), 2000); }}
                                >
                                  {chCopied ? '✓ COPIED' : 'COPY'}
                                </button>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    ))}
                  </div>
                )}

                {/* Outgoing pending */}
                {outgoing.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <div className="text-xs mono tracking-widest" style={{ color: 'var(--text)' }}>SENT — WAITING FOR ACCEPT</div>
                    {outgoing.map(c => (
                      <div key={c.id} className="flex items-start justify-between p-3 gap-2" style={{ border: '1px solid var(--border)' }}>
                        <div className="flex flex-col gap-1">
                          <span className="text-xs font-black" style={{ color: 'var(--cyan)' }}>Challenge to {c.opponentName}</span>
                          <div className="flex items-center gap-1 text-xs mono">
                            <span style={{ color: 'var(--cyan)' }}>{c.myPlayer}</span>
                            <span style={{ color: 'var(--text)' }}>vs</span>
                            <span style={{ color: 'var(--red)' }}>{c.theirPlayer}</span>
                          </div>
                          <span className="text-xs" style={{ color: 'var(--text)' }}>
                            You're on <span style={{ color: 'var(--cyan)', fontWeight: 700 }}>{c.myPlayer}</span> · {c.amount} coins each
                          </span>
                          <span className="mono text-xs" style={{ color: 'var(--text)', opacity: 0.5, fontSize: '0.6rem' }}>
                            Sent {new Date(c.createdAt).toLocaleString()}
                          </span>
                        </div>
                        <button
                          className="btn btn-ghost px-2 py-1 text-xs flex-shrink-0"
                          onClick={() => cancelChallenge(c.id)}
                        >CANCEL</button>
                      </div>
                    ))}
                  </div>
                )}

                {/* History */}
                {history.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <div className="text-xs mono tracking-widest" style={{ color: 'var(--text)' }}>HISTORY</div>
                    {history.slice(0, 20).map(c => (
                      <div key={c.id} className="p-3 flex flex-col gap-1" style={{ border: '1px solid var(--border)', opacity: 0.8 }}>
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-1 text-xs mono font-black">
                              <span style={{ color: c.winnerName === c.myPlayer ? 'var(--green)' : 'var(--text)' }}>{c.myPlayer}</span>
                              <span style={{ color: 'var(--text)' }}>vs</span>
                              <span style={{ color: c.winnerName === c.theirPlayer ? 'var(--green)' : 'var(--text)' }}>{c.theirPlayer}</span>
                            </div>
                            <span className="text-xs" style={{ color: 'var(--text)' }}>
                              {c.creatorName} vs {c.opponentName} · {c.amount} coins each
                            </span>
                            {c.winnerName && (
                              <span className="text-xs font-black" style={{ color: 'var(--green)' }}>🏆 {c.winnerName} won</span>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-1 flex-shrink-0">
                            <span className="mono text-xs font-black" style={{ color: statusColor(c.status) }}>{c.status.toUpperCase()}</span>
                            <span className="mono text-xs" style={{ color: 'var(--text)', opacity: 0.5, fontSize: '0.6rem' }}>
                              {new Date(c.judgedAt ?? c.createdAt).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {myChallenges.length === 0 && (
                  <div className="flex items-center justify-center h-16 text-xs mono text-[var(--text)] tracking-widest">
                    NO CHALLENGES YET
                  </div>
                )}

              </div>
            );
          })()}

          {/* ── P2P TRANSFER ── */}
          {walletTab === 'p2p' && (
            <div className="p-4 flex flex-col gap-4">
              <div className="flex items-center gap-3 mb-1">
                <span className="text-xs mono tracking-widest" style={{ color: 'var(--cyan)' }}>AVAILABLE</span>
                <span className="mono font-black" style={{ color: 'var(--green)' }}>{currentUser.credits} coins</span>
              </div>
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <label className="text-xs mono tracking-widest" style={{ color: 'var(--text)' }}>RECIPIENT USERNAME</label>
                  <input
                    className="bg-transparent border px-3 py-2 mono text-sm outline-none w-full"
                    style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
                    placeholder="Enter player name..."
                    value={p2pTo}
                    onChange={e => { setP2pTo(e.target.value); setP2pMsg(null); }}
                    list="p2p-users"
                  />
                  <datalist id="p2p-users">
                    {users.filter(u => u.id !== currentUser.id).map(u => (
                      <option key={u.id} value={u.name} />
                    ))}
                  </datalist>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs mono tracking-widest" style={{ color: 'var(--text)' }}>AMOUNT</label>
                  <input
                    type="number"
                    min={1}
                    className="bg-transparent border px-3 py-2 mono text-sm outline-none w-full"
                    style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
                    placeholder="0"
                    value={p2pAmt}
                    onChange={e => { setP2pAmt(e.target.value); setP2pMsg(null); }}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        const amt = parseInt(p2pAmt);
                        const result = transferCredits(currentUser.id, p2pTo, amt);
                        if (result.success) { setP2pMsg({ text: `✓ ${amt} coins sent to ${p2pTo}.`, ok: true }); setP2pTo(''); setP2pAmt(''); }
                        else setP2pMsg({ text: result.error ?? 'Transfer failed.', ok: false });
                      }
                    }}
                  />
                </div>
                <button
                  className="btn btn-cyan w-full py-2 text-xs font-black tracking-widest"
                  onClick={() => {
                    const amt = parseInt(p2pAmt);
                    const result = transferCredits(currentUser.id, p2pTo, amt);
                    if (result.success) { setP2pMsg({ text: `✓ ${amt} coins sent to ${p2pTo}.`, ok: true }); setP2pTo(''); setP2pAmt(''); }
                    else setP2pMsg({ text: result.error ?? 'Transfer failed.', ok: false });
                  }}
                >
                  SEND COINS
                </button>
                {p2pMsg && (
                  <div className="mono text-xs text-center py-1" style={{ color: p2pMsg.ok ? 'var(--green)' : 'var(--red)' }}>
                    {p2pMsg.text}
                  </div>
                )}
              </div>
              {/* Recent transfer transactions */}
              {(() => {
                const transfers = (currentUser.transactions ?? []).filter(t => t.type === 'transfer_sent' || t.type === 'transfer_received');
                if (transfers.length === 0) return null;
                return (
                  <div className="flex flex-col gap-0 border-t border-[var(--border)] pt-3 mt-1">
                    <div className="text-xs mono tracking-widest mb-2" style={{ color: 'var(--text)' }}>RECENT TRANSFERS</div>
                    <div className="flex flex-col divide-y divide-[var(--border)] max-h-40 overflow-y-auto">
                      {transfers.slice(0, 20).map(tx => (
                        <div key={tx.id} className="flex items-center justify-between py-2">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-xs mono font-black" style={{ color: typeColor[tx.type] }}>
                              {typeLabel[tx.type]}
                            </span>
                            <span className="text-xs" style={{ color: 'var(--text)', fontSize: '0.65rem' }}>{tx.description}</span>
                          </div>
                          <div className="flex flex-col items-end gap-0.5">
                            <span className="mono text-xs font-black" style={{ color: typeColor[tx.type] }}>
                              {txSign[tx.type]}{tx.amount}
                            </span>
                            <span className="mono" style={{ color: 'var(--text)', fontSize: '0.6rem' }}>
                              {new Date(tx.timestamp).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}

        </div>
      )}
    </div>
  );
}
