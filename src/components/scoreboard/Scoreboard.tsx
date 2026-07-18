import React, { useState, useRef, useEffect } from 'react';
import { useGame } from '@/contexts/GameContext';
import { useUser } from '@/contexts/UserContext';
import TimerDisplay from './TimerDisplay';

interface Props {
  onTeamAWin: () => void;
  onTeamBWin: () => void;
  avatarASrc?: string;
  avatarBSrc?: string;
  avatarBPosition?: string;
  hideBallCount?: boolean;
  hideBreakIndicator?: boolean;
  hideGameType?: boolean;
  hideGameNumber?: boolean;
  avatarSize?: number;
  streamUrl?: string;
}

function TipButton({ playerName, color, align }: { playerName: string; color: string; align: 'left' | 'right' }) {
  const { currentUser, users, addCredits, getUserById, recordTip } = useUser();
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState('');
  const [flash, setFlash] = useState('');
  const btnRef = useRef<HTMLButtonElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const [dropPos, setDropPos] = useState({ top: 0, left: 0, right: 0 });

  useEffect(() => {
    if (!open) return;
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setDropPos({ top: r.bottom + 6, left: r.left, right: window.innerWidth - r.right });
    }
    const handler = (e: MouseEvent) => {
      if (dropRef.current && !dropRef.current.contains(e.target as Node) &&
          btnRef.current && !btnRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const sendTip = (amount: number) => {
    if (!currentUser) { setFlash('SELECT A PLAYER FIRST'); setTimeout(() => setFlash(''), 2000); return; }
    // Read fresh balance from ref via getUserById
    const fresh = getUserById(currentUser.id);
    if (!fresh || fresh.credits < amount) { setFlash('NOT ENOUGH COINS'); setTimeout(() => setFlash(''), 2000); return; }

    const recipient = users.find(u => u.name.toLowerCase() === playerName.toLowerCase());
    const recipientId = recipient?.id ?? users.find(u => u.isAdmin)?.id;

    // Simple direct transfer — no pending bet entry
    addCredits(currentUser.id, -amount);
    if (recipientId) addCredits(recipientId, amount);
    recordTip(currentUser.id, recipientId ?? '', amount);

    setFlash(`✓ +${amount} TIPPED!`);
    setCustom('');
    setTimeout(() => { setFlash(''); setOpen(false); }, 1400);
  };

  const handleCustom = () => { const n = parseInt(custom); if (n > 0) sendTip(n); };

  return (
    <>
      <button
        ref={btnRef}
        className="btn btn-glow-dynamic w-full py-1.5 text-xs font-black tracking-widest"
        style={{ border: `1px solid ${color}`, color, background: `${color}15`, '--glow-color': color } as React.CSSProperties}
        onClick={() => setOpen(v => !v)}
      >
        TIP
      </button>

      {open && (
        <div
          ref={dropRef}
          className="fixed z-[100] flex flex-col gap-2 p-3"
          style={{
            background: '#050505',
            border: `1px solid ${color}`,
            boxShadow: "none",
            minWidth: 180,
            top: dropPos.top,
            ...(align === 'left' ? { left: dropPos.left } : { right: dropPos.right }),
          }}
        >
          {flash ? (
            <div className="text-sm mono font-black text-center py-2" style={{ color }}>
              {flash}
            </div>
          ) : (
            <>
              <div className="text-xs mono text-[var(--text)] tracking-widest text-center">
                TIP {playerName.toUpperCase()}
              </div>
              <div className="flex gap-1.5">
                {[10, 20].map(amt => (
                  <button
                    key={amt}
                    className="flex-1 btn py-1.5 text-xs font-black"
                    style={{ border: `1px solid ${color}`, color, background: `${color}15` }}
                    onClick={() => sendTip(amt)}
                  >
                    ${amt}
                  </button>
                ))}
              </div>
              <div className="flex gap-1.5">
                <input
                  type="number"
                  placeholder="Custom..."
                  className="flex-1 bg-transparent border border-[var(--border)] px-2 py-1 text-xs mono outline-none placeholder:text-[var(--text)] focus:border-current"
                  style={{ color }}
                  value={custom}
                  onChange={e => setCustom(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleCustom()}
                />
                <button
                  className="btn px-2 py-1 text-xs font-black"
                  style={{ border: `1px solid ${color}`, color, background: `${color}15` }}
                  onClick={handleCustom}
                >
                  GO
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}

export default function Scoreboard({ onTeamAWin, onTeamBWin, hideAdminControls, stackedLayout, avatarASrc, avatarBSrc, avatarBPosition, hideBallCount, hideBreakIndicator, hideGameType, hideGameNumber, avatarSize, streamUrl }: Props & { hideAdminControls?: boolean; stackedLayout?: boolean }) {
  const avatarA = avatarASrc || '/alex.png';
  const avatarB = avatarBSrc || '/tony.jpg';
  const avatarBPos = avatarBPosition || '70% center';
  const avW = avatarSize || 112;
  const avH = Math.round(avW * (144 / 112));
  const { game, isAdmin: isAdminCtx, updateGame } = useGame();
  const isAdmin = isAdminCtx && !hideAdminControls;
  const { teamAName, teamBName, teamAGames, teamBGames, teamABalls, teamBBalls, teamAHasBreak, currentGameNumber, lastWinner } = game;

  const [editingA, setEditingA] = useState(false);
  const [editingB, setEditingB] = useState(false);
  const [nameA, setNameA] = useState(teamAName);
  const [nameB, setNameB] = useState(teamBName);

  const commitA = () => { updateGame({ teamAName: nameA }); setEditingA(false); };
  const commitB = () => { updateGame({ teamBName: nameB }); setEditingB(false); };

  return (
    <>
    <div className="flex items-center gap-3">
      <span className="mono text-xs font-black tracking-[0.3em] uppercase" style={{ color: 'var(--gold)' }}>GameBird Scorebox</span>
      <div className="flex-1 border-t border-[var(--border)]" />
      {streamUrl && (
        <a
          href={streamUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mono text-xs font-black tracking-widest uppercase flex items-center gap-1 flex-shrink-0"
          style={{ color: 'var(--red)', border: '1px solid var(--red)', padding: '3px 10px', textDecoration: 'none' }}
        >
          📺 WATCH LIVE
        </a>
      )}
    </div>
    <div className="hud-panel bracket w-full overflow-hidden">
      {/* Description ticker at top */}
      <DescriptionTicker />
      {/* Top bar — grid with equal side columns so TimerDisplay stays mathematically
          centered even when the left slot is empty (hideGameNumber/hideGameType) */}
      <div className="grid items-center px-4 py-1.5 border-b border-[var(--border)]" style={{ gridTemplateColumns: '1fr auto 1fr' }}>
        <div className="flex items-center gap-2">
          {!hideGameNumber && (
            <span className="mono text-xs font-black tracking-widest" style={{ color: 'var(--gold)' }}>
              GAME #{currentGameNumber}
            </span>
          )}
          {!hideGameType && game.gameType && (
            <>
              {!hideGameNumber && <span style={{ color: 'var(--border)' }}>◆</span>}
              <span className="mono text-xs font-black tracking-widest uppercase" style={{ color: 'var(--gold)' }}>
                {game.gameType}
              </span>
            </>
          )}
        </div>
        <TimerDisplay hideGameType={hideGameType} />
        <div />
      </div>

      {/* ── DESKTOP layout (original, untouched) ── */}
      <div className={`${stackedLayout ? 'hidden' : 'hidden lg:flex'} items-center px-4 py-4 gap-4`}>

        {/* TEAM A — avatar left, stats right */}
        <div className="flex-1 grid gap-4" style={{ gridTemplateColumns: `${avW}px 1fr`, minWidth: 0 }}>
          <div className="flex flex-col items-center gap-1">
            <div className="flex items-center gap-1">
              {!hideBreakIndicator && teamAHasBreak && (
                <span className="mono font-black text-xs flex items-center justify-center" style={{ width: 18, height: 18, border: '1.5px solid var(--gold)', color: 'var(--gold)', background: 'rgba(255,215,0,0.1)', flexShrink: 0 }}>B</span>
              )}
              {editingA && isAdmin ? (
                <input autoFocus className="bg-transparent border-b border-[var(--cyan)] text-xs font-bold uppercase tracking-widest outline-none text-[var(--cyan)] w-full" value={nameA} onChange={e => setNameA(e.target.value)} onBlur={commitA} onKeyDown={e => e.key === 'Enter' && commitA()} />
              ) : (
                <div className="text-xs font-black uppercase tracking-widest neon-cyan cursor-pointer text-center leading-tight" onClick={() => isAdmin && setEditingA(true)}>{teamAName}</div>
              )}
            </div>
            <div style={{ position: 'relative', width: avW, height: avH, overflow: 'hidden', border: `2px solid ${lastWinner === 'A' ? 'var(--green)' : 'var(--cyan)'}` }}>
              <img src={avatarA} alt={teamAName} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: '70% center', display: 'block' }} />
              {lastWinner === 'A' && (
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,255,65,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span className="mono font-black tracking-widest" style={{ fontSize: '0.75rem', color: '#fff', textShadow: '0 1px 3px #000', textAlign: 'center', lineHeight: 1.2 }}>🏆{'\n'}WINNER</span>
                </div>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-2 min-w-0 justify-center">
            <div className="flex items-end gap-3">
              <div className="flex flex-col items-center">
                <div className="flex items-center gap-1">
                  {isAdmin && <button className="btn btn-ghost w-5 h-5 text-xs" onClick={() => updateGame({ teamAGames: teamAGames - 1 })}>−</button>}
                  <span className="mono text-5xl font-bold neon-cyan leading-none">{teamAGames}</span>
                  {isAdmin && <button className="btn btn-cyan w-5 h-5 text-xs" onClick={() => updateGame({ teamAGames: teamAGames + 1 })}>+</button>}
                </div>
                <span className="text-xs text-[var(--text)] uppercase tracking-wider">games</span>
              </div>
              {!hideBallCount && <div className="w-px h-10 self-center" style={{ background: 'var(--border)' }} />}
              {!hideBallCount && <div className="flex flex-col items-center">
                <div className="flex items-center gap-1">
                  {isAdmin && <button className="btn btn-ghost w-5 h-5 text-xs" onClick={() => updateGame({ teamABalls: teamABalls - 1 })}>−</button>}
                  <span className="mono text-5xl font-bold leading-none" style={{ color: 'var(--cyan)' }}>{teamABalls}</span>
                  {isAdmin && <button className="btn btn-cyan w-5 h-5 text-xs" onClick={() => updateGame({ teamABalls: teamABalls + 1 })}>+</button>}
                </div>
                <span className="text-xs text-[var(--text)] uppercase tracking-wider">balls</span>
              </div>}
            </div>
            <TipButton playerName={teamAName} color="var(--cyan)" align="left" />
            {isAdmin && <button className="btn btn-cyan w-full py-1.5 text-xs font-black tracking-widest" onClick={onTeamAWin}>✓ WIN</button>}
          </div>
        </div>

        {/* VS */}
        <div className="flex-shrink-0 flex items-center justify-center px-2">
          <span className="mono font-black" style={{ fontSize: '2.5rem', color: 'var(--text)' }}>VS</span>
        </div>

        {/* TEAM B — stats left, avatar right */}
        <div className="flex-1 grid gap-4" style={{ gridTemplateColumns: `1fr ${avW}px`, minWidth: 0 }}>
          <div className="flex flex-col gap-2 min-w-0 items-end justify-center">
            <div className="flex items-end gap-3">
              {!hideBallCount && <div className="flex flex-col items-center">
                <div className="flex items-center gap-1">
                  {isAdmin && <button className="btn btn-ghost w-5 h-5 text-xs" onClick={() => updateGame({ teamBBalls: teamBBalls - 1 })}>−</button>}
                  <span className="mono text-5xl font-bold leading-none" style={{ color: 'var(--red)', textShadow: 'none' }}>{teamBBalls}</span>
                  {isAdmin && <button className="btn btn-red w-5 h-5 text-xs" onClick={() => updateGame({ teamBBalls: teamBBalls + 1 })}>+</button>}
                </div>
                <span className="text-xs text-[var(--text)] uppercase tracking-wider">balls</span>
              </div>}
              {!hideBallCount && <div className="w-px h-10 self-center" style={{ background: 'var(--border)' }} />}
              <div className="flex flex-col items-center">
                <div className="flex items-center gap-1">
                  {isAdmin && <button className="btn btn-ghost w-5 h-5 text-xs" onClick={() => updateGame({ teamBGames: teamBGames - 1 })}>−</button>}
                  <span className="mono text-5xl font-bold leading-none" style={{ color: 'var(--red)', textShadow: 'none' }}>{teamBGames}</span>
                  {isAdmin && <button className="btn btn-red w-5 h-5 text-xs" onClick={() => updateGame({ teamBGames: teamBGames + 1 })}>+</button>}
                </div>
                <span className="text-xs text-[var(--text)] uppercase tracking-wider">games</span>
              </div>
            </div>
            <TipButton playerName={teamBName} color="var(--red)" align="right" />
            {isAdmin && <button className="btn btn-red w-full py-1.5 text-xs font-black tracking-widest" onClick={onTeamBWin}>✓ WIN</button>}
          </div>
          <div className="flex flex-col items-center gap-1">
            <div className="flex items-center gap-1">
              {editingB && isAdmin ? (
                <input autoFocus className="bg-transparent border-b text-xs font-bold uppercase tracking-widest outline-none text-center" style={{ borderColor: 'var(--red)', color: 'var(--red)' }} value={nameB} onChange={e => setNameB(e.target.value)} onBlur={commitB} onKeyDown={e => e.key === 'Enter' && commitB()} />
              ) : (
                <div className="text-xs font-black uppercase tracking-widest cursor-pointer text-center leading-tight" style={{ color: 'var(--red)' }} onClick={() => isAdmin && setEditingB(true)}>{teamBName}</div>
              )}
              {!hideBreakIndicator && !teamAHasBreak && (
                <span className="mono font-black text-xs flex items-center justify-center" style={{ width: 18, height: 18, border: '1.5px solid var(--gold)', color: 'var(--gold)', background: 'rgba(255,215,0,0.1)', flexShrink: 0 }}>B</span>
              )}
            </div>
            <div style={{ position: 'relative', width: avW, height: avH, overflow: 'hidden', border: `2px solid ${lastWinner === 'B' ? 'var(--green)' : 'var(--red)'}` }}>
              <img src={avatarB} alt={teamBName} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: avatarBPos, display: 'block' }} />
              {lastWinner === 'B' && (
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,255,65,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span className="mono font-black tracking-widest" style={{ fontSize: '0.75rem', color: '#fff', textShadow: '0 1px 3px #000', textAlign: 'center', lineHeight: 1.2 }}>🏆{'\n'}WINNER</span>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* ── MOBILE layout (new stacked design) ── */}
      <div className={`${stackedLayout ? 'flex' : 'flex lg:hidden'} items-start px-4 py-4 gap-4`}>

        {/* TEAM A */}
        <div className="flex-1 flex flex-col items-center gap-2 min-w-0">
          <div className="flex items-center gap-1">
            {!hideBreakIndicator && teamAHasBreak && (
              <span className="mono font-black text-xs flex items-center justify-center" style={{ width: 18, height: 18, border: '1.5px solid var(--gold)', color: 'var(--gold)', background: 'rgba(255,215,0,0.1)', flexShrink: 0 }}>B</span>
            )}
            {editingA && isAdmin ? (
              <input autoFocus className="bg-transparent border-b border-[var(--cyan)] text-xs font-bold uppercase tracking-widest outline-none text-[var(--cyan)] w-full" value={nameA} onChange={e => setNameA(e.target.value)} onBlur={commitA} onKeyDown={e => e.key === 'Enter' && commitA()} />
            ) : (
              <div className="text-xs font-black uppercase tracking-widest neon-cyan cursor-pointer text-center leading-tight" onClick={() => isAdmin && setEditingA(true)}>{teamAName}</div>
            )}
          </div>
          <div style={{ position: 'relative', width: '100%', maxWidth: avW, aspectRatio: `${avW}/${avH}`, overflow: 'hidden', border: `2px solid ${lastWinner === 'A' ? 'var(--green)' : 'var(--cyan)'}` }}>
            <img src={avatarA} alt={teamAName} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: '70% center', display: 'block' }} />
            {lastWinner === 'A' && (
              <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,255,65,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span className="mono font-black tracking-widest" style={{ fontSize: '0.75rem', color: '#fff', textShadow: '0 1px 3px #000', textAlign: 'center', lineHeight: 1.2 }}>🏆{'\n'}WINNER</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3 w-full justify-center">
            <div className="flex flex-col items-center">
              <div className="flex items-center gap-1">
                {isAdmin && <button className="btn btn-ghost w-5 h-5 text-xs" onClick={() => updateGame({ teamAGames: teamAGames - 1 })}>−</button>}
                <span className="mono text-4xl font-bold neon-cyan leading-none">{teamAGames}</span>
                {isAdmin && <button className="btn btn-cyan w-5 h-5 text-xs" onClick={() => updateGame({ teamAGames: teamAGames + 1 })}>+</button>}
              </div>
              <span className="text-xs text-[var(--text)] uppercase tracking-wider">games</span>
            </div>
            {!hideBallCount && <div className="w-px h-8" style={{ background: 'var(--border)' }} />}
            {!hideBallCount && <div className="flex flex-col items-center">
              <div className="flex items-center gap-1">
                {isAdmin && <button className="btn btn-ghost w-5 h-5 text-xs" onClick={() => updateGame({ teamABalls: teamABalls - 1 })}>−</button>}
                <span className="mono text-4xl font-bold leading-none" style={{ color: 'var(--cyan)' }}>{teamABalls}</span>
                {isAdmin && <button className="btn btn-cyan w-5 h-5 text-xs" onClick={() => updateGame({ teamABalls: teamABalls + 1 })}>+</button>}
              </div>
              <span className="text-xs text-[var(--text)] uppercase tracking-wider">balls</span>
            </div>}
          </div>
          <TipButton playerName={teamAName} color="var(--cyan)" align="left" />
          {isAdmin && <button className="btn btn-cyan w-full py-1.5 text-xs font-black tracking-widest" onClick={onTeamAWin}>✓ WIN</button>}
        </div>

        {/* VS — centered on avatar */}
        <div className="flex-shrink-0 flex justify-center px-1" style={{ alignSelf: 'flex-start', marginTop: 'calc(1.5rem - 17px + 18%)' }}>
          <span className="mono font-black" style={{ fontSize: '2rem', color: 'var(--text)' }}>VS</span>
        </div>

        {/* TEAM B */}
        <div className="flex-1 flex flex-col items-center gap-2 min-w-0">
          <div className="flex items-center gap-1">
            {editingB && isAdmin ? (
              <input autoFocus className="bg-transparent border-b text-xs font-bold uppercase tracking-widest outline-none text-center" style={{ borderColor: 'var(--red)', color: 'var(--red)' }} value={nameB} onChange={e => setNameB(e.target.value)} onBlur={commitB} onKeyDown={e => e.key === 'Enter' && commitB()} />
            ) : (
              <div className="text-xs font-black uppercase tracking-widest cursor-pointer text-center leading-tight" style={{ color: 'var(--red)' }} onClick={() => isAdmin && setEditingB(true)}>{teamBName}</div>
            )}
            {!hideBreakIndicator && !teamAHasBreak && (
              <span className="mono font-black text-xs flex items-center justify-center" style={{ width: 18, height: 18, border: '1.5px solid var(--gold)', color: 'var(--gold)', background: 'rgba(255,215,0,0.1)', flexShrink: 0 }}>B</span>
            )}
          </div>
          <div style={{ position: 'relative', width: '100%', maxWidth: avW, aspectRatio: `${avW}/${avH}`, overflow: 'hidden', border: `2px solid ${lastWinner === 'B' ? 'var(--green)' : 'var(--red)'}` }}>
            <img src={avatarB} alt={teamBName} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: avatarBPos, display: 'block' }} />
            {lastWinner === 'B' && (
              <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,255,65,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span className="mono font-black tracking-widest" style={{ fontSize: '0.75rem', color: '#fff', textShadow: '0 1px 3px #000', textAlign: 'center', lineHeight: 1.2 }}>🏆{'\n'}WINNER</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3 w-full justify-center">
            {!hideBallCount && <div className="flex flex-col items-center">
              <div className="flex items-center gap-1">
                {isAdmin && <button className="btn btn-ghost w-5 h-5 text-xs" onClick={() => updateGame({ teamBBalls: teamBBalls - 1 })}>−</button>}
                <span className="mono text-4xl font-bold leading-none" style={{ color: 'var(--red)' }}>{teamBBalls}</span>
                {isAdmin && <button className="btn btn-red w-5 h-5 text-xs" onClick={() => updateGame({ teamBBalls: teamBBalls + 1 })}>+</button>}
              </div>
              <span className="text-xs text-[var(--text)] uppercase tracking-wider">balls</span>
            </div>}
            {!hideBallCount && <div className="w-px h-8" style={{ background: 'var(--border)' }} />}
            <div className="flex flex-col items-center">
              <div className="flex items-center gap-1">
                {isAdmin && <button className="btn btn-ghost w-5 h-5 text-xs" onClick={() => updateGame({ teamBGames: teamBGames - 1 })}>−</button>}
                <span className="mono text-4xl font-bold leading-none" style={{ color: 'var(--red)' }}>{teamBGames}</span>
                {isAdmin && <button className="btn btn-red w-5 h-5 text-xs" onClick={() => updateGame({ teamBGames: teamBGames + 1 })}>+</button>}
              </div>
              <span className="text-xs text-[var(--text)] uppercase tracking-wider">games</span>
            </div>
          </div>
          <TipButton playerName={teamBName} color="var(--red)" align="right" />
          {isAdmin && <button className="btn btn-red w-full py-1.5 text-xs font-black tracking-widest" onClick={onTeamBWin}>✓ WIN</button>}
        </div>

      </div>

      {/* Game ticker */}
      <TickerBar hideBallCount={hideBallCount} />
    </div>
    </>
  );
}

function DescriptionTicker() {
  const { game } = useGame();
  const text = game.gameDescription?.trim() || 'GameBird Live Billiards Betting';
  const repeated = `${text}     ◆     ${text}`;

  return (
    <div className="overflow-hidden border-b border-[var(--border)]" style={{ background: 'rgba(0,229,255,0.04)' }}>
      <div
        className="mono text-xs font-black whitespace-nowrap"
        style={{
          color: 'var(--cyan)',
          padding: '5px 0',
          display: 'inline-block',
          animation: 'ticker 20s linear infinite',
        }}
      >
        {repeated}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{repeated}
      </div>
    </div>
  );
}

function TickerBar({ hideBallCount }: { hideBallCount?: boolean }) {
  const { game } = useGame();
  const { teamAName, teamBName, teamAGames, teamBGames, teamABalls, teamBBalls, bookedBets, totalBookedAmount, currentGameNumber, lastWinner } = game;

  const items = [
    `GAME #${currentGameNumber}`,
    `${teamAName} ${teamAGames} — ${teamBGames} ${teamBName}`,
    ...(hideBallCount ? [] : [`BALLS — ${teamAName}: ${teamABalls}  ${teamBName}: ${teamBBalls}`]),
    `${bookedBets.length} MATCHED BETS`,
    `${totalBookedAmount * 2} COINS IN THE MATCH`,
    lastWinner ? `LAST WINNER: ${lastWinner === 'A' ? teamAName : teamBName}` : 'BETTING LIVE',
  ];

  const tickerText = items.join('   ◆   ');

  return (
    <div className="overflow-hidden border-t border-[var(--border)]" style={{ background: 'rgba(0,0,0,0.4)' }}>
      <div
        className="mono text-xs font-black whitespace-nowrap"
        style={{
          color: 'var(--gold)',
          padding: '5px 0',
          display: 'inline-block',
          animation: 'ticker 18s linear infinite',
        }}
      >
        {tickerText}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;{tickerText}
      </div>
      <style>{`
        @keyframes ticker {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}
