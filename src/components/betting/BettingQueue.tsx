import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useGame } from '@/contexts/GameContext';
import { useUser } from '@/contexts/UserContext';
import { Bet, BookedBet } from '@/types';

const PAIR_COLORS = [
  '#FFD700', '#00FFFF', '#FF6B00', '#FF00FF', '#00FF41',
  '#1E90FF', '#FF4500', '#7FFF00', '#FF1493', '#00CED1',
];

function BetRow({ bet, isMatched, pairColor, onDelete }: { bet: Bet; isMatched: boolean; pairColor?: string; onDelete?: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.classList.add('flash-in');
    const t = setTimeout(() => ref.current?.classList.remove('flash-in'), 500);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      ref={ref}
      className="flex items-center justify-between py-1.5 border-b border-[var(--border)] last:border-0"
      style={{
        paddingLeft: pairColor ? 0 : 12,
        borderLeft: pairColor ? `3px solid ${pairColor}` : 'none',
      }}
    >
      <div className="flex items-center gap-2 min-w-0 pl-2">
        <span className="text-base font-semibold truncate" style={{ color: pairColor || (isMatched ? 'var(--text)' : 'var(--text-dim)') }}>
          {bet.userName}
        </span>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0 pr-2">
        <span className="mono text-base font-bold" style={{ color: pairColor || (isMatched ? 'var(--green)' : 'var(--text-dim)') }}>
          {bet.amount}
        </span>
        {isMatched
          ? <span className="text-xs font-black tracking-widest" style={{ color: pairColor || 'var(--green)' }}>✓ BOOKED</span>
          : onDelete && (
            <button
              onClick={onDelete}
              className="w-5 h-5 flex items-center justify-center text-xs rounded hover:bg-[rgba(255,0,64,0.2)] transition-colors ml-1"
              style={{ color: 'var(--red)', border: '1px solid rgba(255,0,64,0.3)', lineHeight: 1 }}
              title="Cancel bet (refund)"
            >
              ✕
            </button>
          )
        }
      </div>
    </div>
  );
}

const betSound = new Audio('/bet-click.mp3');
const playBetSound = () => { betSound.currentTime = 0; betSound.play().catch(() => {}); };

const hoverSound = new Audio('/hover.mp3');
hoverSound.volume = 1.0;
// Prime on first click so browser allows subsequent hover playback
document.addEventListener('click', () => {
  hoverSound.play().then(() => { hoverSound.pause(); hoverSound.currentTime = 0; }).catch(() => {});
}, { once: true });
const playHoverSound = () => { hoverSound.currentTime = 0; hoverSound.play().catch(() => {}); };

function BetButtons({ color, teamSide, isNextGame, onPlaceBet }: {
  color: string; teamSide: 'A' | 'B'; isNextGame: boolean;
  onPlaceBet: (side: 'A' | 'B', amount: number, isNext: boolean) => void;
}) {
  const [inputAmt, setInputAmt] = useState('');
  const submit = () => {
    const amt = parseInt(inputAmt);
    if (amt > 0) { onPlaceBet(teamSide, amt, isNextGame); setInputAmt(''); }
  };
  return (
    <div
      className={`flex flex-col gap-1.5 p-2 bet-buttons-col bet-buttons-${teamSide}`}
      style={{ width: 96 }}
    >
      {[10, 50, 100].map(amt => (
        <button key={amt}
          className="bet-circle btn-glow-dynamic flex items-center justify-center text-xs font-black mono transition-all active:scale-95"
          style={{ width: 52, height: 52, borderRadius: '50%', background: `${color}18`, border: `2px solid ${color}`, color, '--glow-color': color, alignSelf: 'center', margin: '0 auto' } as React.CSSProperties}
          onMouseEnter={e => { playHoverSound(); e.currentTarget.style.background = color; e.currentTarget.style.color = '#000'; e.currentTarget.style.boxShadow = `0 0 16px ${color}`; }}
          onMouseLeave={e => { e.currentTarget.style.background = `${color}18`; e.currentTarget.style.color = color; e.currentTarget.style.boxShadow = ''; }}
          onClick={() => onPlaceBet(teamSide, amt, isNextGame)}
        >{amt}</button>
      ))}
      <input type="number" min="1" placeholder="Amt"
        className="w-full bg-transparent px-1 py-1.5 text-xs mono outline-none text-center placeholder:text-[var(--text-dim)]"
        style={{ border: `1px solid ${color}40`, color }}
        value={inputAmt} onChange={e => setInputAmt(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()} />
      <button className="w-full py-1.5 text-xs font-black tracking-widest mono transition-all active:scale-95 btn-glow-dynamic"
        style={{ background: color, color: '#000', border: 'none', '--glow-color': color } as React.CSSProperties}
        onClick={submit}>BET</button>
      <style>{`
        @media (max-width: 1023px) {
          .bet-circle { width: 42px !important; height: 42px !important; }
          .bet-buttons-col { width: 80px !important; }
          .bet-buttons-A { margin-left: -5px; margin-top: 60px; }
          .bet-buttons-B { margin-right: -5px; margin-top: 60px; }
        }
        @media (min-width: 1024px) {
          .bet-buttons-A, .bet-buttons-B { margin-top: 24px; }
        }
      `}</style>
    </div>
  );
}

function BetList({ label, color, bets, bookedBets, currentUserId, onDeleteBet }: {
  label: string; color: string; bets: Bet[]; bookedBets: BookedBet[];
  currentUserId: string | null; onDeleteBet: (bet: Bet) => void;
}) {
  const pairColorMap: Record<string, string> = {};
  bookedBets.forEach((bb, i) => {
    const c = PAIR_COLORS[i % PAIR_COLORS.length];
    pairColorMap[bb.betIdA] = c;
    pairColorMap[bb.betIdB] = c;
  });
  const bookedIds = new Set(Object.keys(pairColorMap));
  const total = bets.reduce((s, b) => s + b.amount, 0);
  const matchedTotal = bets.filter(b => bookedIds.has(b.id)).reduce((s, b) => s + b.amount, 0);

  return (
    <div className="flex flex-col flex-1 min-w-0 overflow-hidden" style={{ borderLeft: `1px solid ${color}20` }}>
      <div className="px-2 py-1.5 flex flex-col items-center gap-0.5" style={{ borderBottom: `1px solid ${color}30`, background: `${color}08` }}>
        <span className="font-black text-xs uppercase tracking-widest text-center" style={{ color }}>{label}</span>
        <div className="flex gap-2 mono text-sm font-bold">
          <span style={{ color: 'var(--green)' }}>{matchedTotal} ✓</span>
          <span style={{ color: 'var(--text)' }}>{total} TTL</span>
        </div>
      </div>
      <div className="overflow-y-auto flex-1">
        {Array.from({ length: Math.max(8, bets.length) }).map((_, i) => {
          const bet = bets[i];
          return bet
            ? <BetRow key={bet.id} bet={bet} isMatched={bookedIds.has(bet.id)}
                pairColor={pairColorMap[bet.id]}
                onDelete={!bookedIds.has(bet.id) && bet.userId === currentUserId ? () => onDeleteBet(bet) : undefined} />
            : <div key={`empty-${i}`} className="py-1.5 border-b border-[var(--border)]" style={{ minHeight: 34 }} />;
        })}
      </div>
    </div>
  );
}

// Keep QueueColumn for compactInput (admin) mode
function QueueColumn({ label, color, bets, bookedBets, teamSide, isNextGame, currentUserId, onPlaceBet, onDeleteBet }: {
  label: string; color: string; bets: Bet[]; bookedBets: BookedBet[];
  teamSide: 'A' | 'B'; isNextGame: boolean; currentUserId: string | null;
  onPlaceBet: (side: 'A' | 'B', amount: number, isNext: boolean) => void;
  onDeleteBet: (bet: Bet) => void;
}) {
  const [inputAmt, setInputAmt] = useState('');
  const pairColorMap: Record<string, string> = {};
  bookedBets.forEach((bb, i) => {
    const c = PAIR_COLORS[i % PAIR_COLORS.length];
    pairColorMap[bb.betIdA] = c; pairColorMap[bb.betIdB] = c;
  });
  const bookedIds = new Set(Object.keys(pairColorMap));
  const total = bets.reduce((s, b) => s + b.amount, 0);
  const matchedTotal = bets.filter(b => bookedIds.has(b.id)).reduce((s, b) => s + b.amount, 0);
  const submit = () => { const amt = parseInt(inputAmt); if (amt > 0) { onPlaceBet(teamSide, amt, isNextGame); setInputAmt(''); } };

  return (
    <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
      <div className="px-3 py-2 flex flex-col items-center gap-0.5" style={{ borderBottom: `1px solid ${color}30`, background: `${color}08` }}>
        <span className="font-black text-sm uppercase tracking-widest text-center" style={{ color }}>{label}</span>
        <div className="flex gap-2 mono text-xs">
          <span style={{ color: 'var(--green)' }}>{matchedTotal} ✓</span>
          <span style={{ color: 'var(--text)' }}>{total} TTL</span>
        </div>
      </div>
      <div className="overflow-y-auto" style={{ maxHeight: 160 }}>
        {bets.length === 0
          ? <div className="flex items-center justify-center h-12 text-sm text-[var(--text)] tracking-wider">NO BETS PLACED</div>
          : bets.map(bet => (
            <BetRow key={bet.id} bet={bet} isMatched={bookedIds.has(bet.id)} pairColor={pairColorMap[bet.id]}
              onDelete={!bookedIds.has(bet.id) && bet.userId === currentUserId ? () => onDeleteBet(bet) : undefined} />
          ))
        }
      </div>
      <div className="p-2 border-t" style={{ borderColor: `${color}30` }}>
        <div className="grid gap-1.5" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
          {[10, 50, 100].map(amt => (
            <button key={amt} className="py-2 text-sm font-black tracking-widest mono transition-all active:scale-95"
              style={{ background: `${color}18`, border: `1.5px solid ${color}`, color, boxShadow: `0 0 8px ${color}30` }}
              onMouseEnter={e => { e.currentTarget.style.background = color; e.currentTarget.style.color = '#000'; e.currentTarget.style.boxShadow = `0 0 18px ${color}`; }}
              onMouseLeave={e => { e.currentTarget.style.background = `${color}18`; e.currentTarget.style.color = color; e.currentTarget.style.boxShadow = `0 0 8px ${color}30`; }}
              onClick={() => onPlaceBet(teamSide, amt, isNextGame)}
            >{amt}</button>
          ))}
          <div className="col-start-1 col-span-3 flex gap-1.5">
            <input type="number" min="1" placeholder="Custom"
              className="bg-transparent px-2 py-1.5 text-xs mono outline-none placeholder:text-[var(--text)]"
              style={{ border: `1px solid ${color}40`, color, width: 160 }}
              value={inputAmt} onChange={e => setInputAmt(e.target.value)} onKeyDown={e => e.key === 'Enter' && submit()} />
            <button className="px-3 py-1.5 text-xs font-black tracking-widest mono transition-all active:scale-95"
              style={{ background: color, color: '#000', border: 'none', boxShadow: `0 0 10px ${color}50` }}
              onClick={submit}>BET</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BettingQueue({ compactInput }: { compactInput?: boolean } = {}) {
  const { game, placeBet, cancelBet, isAdmin } = useGame();
  const { currentUser, refundBet } = useUser();

  const { teamAName, teamBName, teamAQueue, teamBQueue, bookedBets,
    nextTeamAQueue, nextTeamBQueue, nextBookedBets,
    totalBookedAmount, nextTotalBookedAmount } = game;

  const [notice, setNotice] = useState<{ title: string; message: string; action?: { label: string; to: string } } | null>(null);

  const handlePlaceBet = (side: 'A' | 'B', amount: number, isNext: boolean) => {
    if (!currentUser) {
      setNotice({ title: 'Not Signed In', message: 'You must be signed in to place a bet.' });
      return;
    }
    if (!isActiveMember) {
      setNotice({
        title: 'Membership Required',
        message: 'You must be an active member to place bets. Sign up for a membership to get started.',
        action: { label: 'VIEW MEMBERSHIP', to: '/membership' },
      });
      return;
    }
    if (currentUser.credits <= 0) {
      setNotice({
        title: 'No Coins',
        message: 'You have no coins. Purchase coins to start betting.',
        action: { label: 'GET COINS', to: '/get-coins' },
      });
      return;
    }
    if (currentUser.credits < amount) {
      setNotice({
        title: 'Insufficient Coins',
        message: `You only have ${currentUser.credits} coins — need ${amount} to place this bet. Purchase more coins to continue.`,
        action: { label: 'GET COINS', to: '/get-coins' },
      });
      return;
    }
    placeBet(currentUser.id, currentUser.name, side, amount, isNext);
    playBetSound();
  };

  const handleDeleteBet = (bet: Bet, isNext: boolean) => {
    if (bet.userId !== currentUser?.id) return;
    cancelBet(bet.id, bet.teamSide, isNext);
    refundBet(bet.userId, bet.id, bet.amount);
  };

  const matchedCount = bookedBets.length;

  const membership = currentUser?.membership;
  const isActiveMember = isAdmin || !!(membership && membership.tier === 'premium' && !membership.cancelledAt);

  return (
    <div className="flex flex-col gap-2" style={{ position: 'relative' }}>
      {notice && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50 px-4"
          style={{ background: 'rgba(0,0,0,0.75)' }}
          onClick={() => setNotice(null)}
        >
          <div
            className="hud-panel bracket flex flex-col items-center gap-4 text-center"
            style={{ background: 'rgba(8,8,24,0.98)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,0,64,0.5)', maxWidth: 320, width: '100%', padding: '28px 24px' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="text-2xl font-black uppercase tracking-widest" style={{ color: 'var(--red)' }}>
              {notice.title}
            </div>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text)' }}>
              {notice.message}
            </p>
            <div className="flex gap-2 mt-1 w-full">
              {notice.action && (
                <Link
                  to={notice.action.to}
                  className="btn btn-cyan flex-1 py-2.5 text-xs font-black tracking-widest"
                  style={{ textDecoration: 'none' }}
                  onClick={() => setNotice(null)}
                >
                  {notice.action.label}
                </Link>
              )}
              <button
                className="btn btn-ghost py-2.5 text-xs font-black tracking-widest"
                style={{ flex: notice.action ? '0 0 auto' : 1, paddingLeft: 16, paddingRight: 16 }}
                onClick={() => setNotice(null)}
              >
                DISMISS
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Section label */}
      <div className="flex items-center gap-3">
        <span className="mono text-xs font-black tracking-[0.3em] uppercase" style={{ color: 'var(--gold)' }}>GameBird Betting Queue</span>
        <div className="flex-1 border-t border-[var(--border)]" />
      </div>

      {/* Queue content — blurred for non-members */}
      <div style={{ position: 'relative' }}>
        <div style={{ filter: isActiveMember ? 'none' : 'blur(5px)', pointerEvents: isActiveMember ? 'auto' : 'none', userSelect: isActiveMember ? 'auto' : 'none' }}>
          {/* Current game queue */}
          <div className="hud-panel bracket overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border)]">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[var(--green)]" style={{ boxShadow: '0 0 6px var(--green)' }} />
                <span className="text-xs mono tracking-widest text-[var(--text)]">CURRENT GAME QUEUE</span>
              </div>
              <div className="flex items-center gap-3 text-xs mono">
                <span style={{ color: 'var(--green)' }}>{matchedCount} MATCHED</span>
                <span style={{ color: 'var(--gold)', fontWeight: 700 }}>{totalBookedAmount * 2} ITM</span>
              </div>
            </div>
            <div className="flex flex-wrap sm:flex-nowrap" style={{ minHeight: 200 }}>
              <BetButtons color="var(--cyan)" teamSide="A" isNextGame={false} onPlaceBet={handlePlaceBet} />
              <BetList label={teamAName} color="var(--cyan)" bets={teamAQueue} bookedBets={bookedBets} currentUserId={currentUser?.id ?? null} onDeleteBet={bet => handleDeleteBet(bet, false)} />
              <BetList label={teamBName} color="var(--red)" bets={teamBQueue} bookedBets={bookedBets} currentUserId={currentUser?.id ?? null} onDeleteBet={bet => handleDeleteBet(bet, false)} />
              <BetButtons color="var(--red)" teamSide="B" isNextGame={false} onPlaceBet={handlePlaceBet} />
            </div>
          </div>

          {/* Up arrow divider */}
          <div className="flex items-center justify-center py-1">
            <span className="mono font-black text-2xl" style={{ color: 'var(--gold)', textShadow: '0 0 10px var(--gold)' }}>↑</span>
          </div>

          {/* Next game queue */}
          <div className="hud-panel overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border)]">
              <span className="text-xs mono tracking-widest text-[var(--text)]">NEXT GAME QUEUE</span>
              {(nextTeamAQueue.length + nextTeamBQueue.length) > 0 && (
                <span className="text-xs mono" style={{ color: 'var(--gold)' }}>{nextTotalBookedAmount * 2} ITM</span>
              )}
            </div>
            <div className="flex flex-wrap sm:flex-nowrap" style={{ minHeight: 200 }}>
              <BetButtons color="var(--cyan)" teamSide="A" isNextGame={true} onPlaceBet={handlePlaceBet} />
              <BetList label={teamAName} color="var(--cyan)" bets={nextTeamAQueue} bookedBets={nextBookedBets} currentUserId={currentUser?.id ?? null} onDeleteBet={bet => handleDeleteBet(bet, true)} />
              <BetList label={teamBName} color="var(--red)" bets={nextTeamBQueue} bookedBets={nextBookedBets} currentUserId={currentUser?.id ?? null} onDeleteBet={bet => handleDeleteBet(bet, true)} />
              <BetButtons color="var(--red)" teamSide="B" isNextGame={true} onPlaceBet={handlePlaceBet} />
            </div>
          </div>
        </div>

        {/* Members-only overlay centered over the blurred content */}
        {!isActiveMember && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 text-center px-4">
            <div className="hud-panel bracket px-6 py-5 flex flex-col items-center gap-3"
              style={{ background: 'rgba(5,5,20,0.88)', border: '1px solid var(--cyan)' }}>
              <div className="font-black uppercase tracking-widest text-lg" style={{ color: 'var(--cyan)' }}>Premium Membership Required</div>
              <p className="text-xs mono" style={{ color: 'var(--text-dim)' }}>Subscribe to access the scorebox</p>
              <Link to="/membership" className="btn btn-cyan px-5 py-2 text-xs font-black tracking-widest" style={{ textDecoration: 'none' }}>
                VIEW MEMBERSHIP
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
