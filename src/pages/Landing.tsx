import React from 'react';
import { Link, Navigate } from 'react-router-dom';
import Header from '@/components/layout/Header';
import { useGame } from '@/contexts/GameContext';
import { useUser } from '@/contexts/UserContext';

function MemberCounter({ max }: { max: number }) {
  const [current, setCurrent] = React.useState<number>(0);

  React.useEffect(() => {
    const serverUrl = window.location.hostname === 'localhost'
      ? 'http://localhost:3001'
      : 'https://gamebird-app-production.up.railway.app';
    fetch(`${serverUrl}/api/users`)
      .then(r => r.json())
      .then(data => {
        const users = Array.isArray(data) ? data : (data?.users ?? []);
        const count = users.filter((u: any) => !u.isAdmin).length;
        setCurrent(count);
      })
      .catch(() => {});
  }, []);
  const pct = Math.min(current / max, 1);
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const filled = circumference * pct;
  const remaining = circumference - filled;

  return (
    <div className="hud-panel bracket px-6 py-5 flex flex-col items-center gap-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }}>
      <div className="text-3xl font-black uppercase tracking-widest text-center" style={{ color: 'var(--cyan)', textShadow: '0 0 12px rgba(0,229,255,0.6)' }}>
        RSVP
      </div>
      <span className="mono text-xs font-black tracking-[0.3em] uppercase" style={{ color: 'var(--gold)' }}>
        Exclusive Access
      </span>

      {/* Pie / donut */}
      <svg width="140" height="140" viewBox="0 0 140 140">
        {/* Glow filter */}
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        {/* Track */}
        <circle cx="70" cy="70" r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="14" />
        {/* Filled arc — cyan */}
        <circle
          cx="70" cy="70" r={radius}
          fill="none"
          stroke="var(--cyan)"
          strokeWidth="14"
          strokeDasharray={`${filled} ${remaining}`}
          strokeLinecap="round"
          strokeDashoffset={circumference * 0.25}
          filter="url(#glow)"
          style={{ transition: 'stroke-dasharray 0.8s ease' }}
        />
        {/* Remaining arc — red */}
        <circle
          cx="70" cy="70" r={radius}
          fill="none"
          stroke="rgba(255,0,64,0.35)"
          strokeWidth="14"
          strokeDasharray={`${remaining} ${filled}`}
          strokeDashoffset={circumference * 0.25 - filled}
        />
        {/* Center percentage */}
        <text x="70" y="65" textAnchor="middle" dominantBaseline="middle"
          style={{ fill: 'var(--cyan)', fontFamily: 'Share Tech Mono, monospace', fontSize: 22, fontWeight: 900 }}>
          {Math.round(pct * 100)}%
        </text>
        <text x="70" y="85" textAnchor="middle" dominantBaseline="middle"
          style={{ fill: 'rgba(224,232,255,0.5)', fontFamily: 'Share Tech Mono, monospace', fontSize: 10 }}>
          FULL
        </text>
      </svg>

      {/* Left / Right counters — grid guarantees the divider sits at the true center
          regardless of how wide the numbers on each side are */}
      <div className="grid items-center w-full" style={{ gridTemplateColumns: '1fr auto 1fr' }}>
        <div className="flex flex-col items-center gap-0.5 justify-self-center">
          <span className="mono font-black leading-none" style={{ fontSize: '2.2rem', color: 'var(--cyan)', textShadow: '0 0 12px rgba(0,229,255,0.6)' }}>{current}</span>
          <span className="mono text-xs tracking-widest uppercase" style={{ color: 'var(--text-dim)' }}>Members</span>
        </div>
        <div className="w-px h-12 justify-self-center" style={{ background: 'var(--border)' }} />
        <div className="flex flex-col items-center gap-0.5 justify-self-center">
          <span className="mono font-black leading-none" style={{ fontSize: '2.2rem', color: 'var(--gold)', textShadow: '0 0 12px rgba(255,215,0,0.5)' }}>{max}</span>
          <span className="mono text-xs tracking-widest uppercase" style={{ color: 'var(--text-dim)' }}>Max Capacity</span>
        </div>
      </div>

      {/* RSVP note */}
      <p className="text-sm leading-relaxed text-center" style={{ color: 'var(--text)', maxWidth: '36rem' }}>
        For our first match, GameBird will be accepting only <span style={{ color: 'var(--gold)', fontWeight: 700 }}>500 exclusive members</span>. Members who sign up will be guaranteed a seat for the opening match — your membership starts the date of the first match. This RSVP gets you a seat and full betting privileges, guaranteeing you full access to an exclusive event you won't want to miss.
      </p>
    </div>
  );
}

export default function Landing() {
  const { game, gameHistory, isAdmin } = useGame();
  const { users, currentUser } = useUser();

  if (!currentUser && !isAdmin) return <Navigate to="/login" replace />;

  const players = users.filter(u => !u.isAdmin);
  const totalCoins = players.reduce((s, u) => s + u.credits, 0);
  const totalGames = gameHistory.length;
  const totalMatched = gameHistory.reduce((s, r) => s + r.totalAmount * 2, 0);
  const liveBets = game.teamAQueue.length + game.teamBQueue.length;
  const liveITM = game.totalBookedAmount * 2;

  return (
    <div className="flex flex-col" style={{ minHeight: "100dvh", position: 'relative' }}>
      {/* Background */}
      <div style={{
        position: 'fixed', inset: 0,
        backgroundImage: 'url(/pool-background.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        zIndex: 0,
      }} />
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,4,18,0.38)', zIndex: 1 }} />

      <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <Header />

        <main className="flex-1 w-full max-w-2xl mx-auto px-3 py-6 flex flex-col gap-6">

          {/* Hero */}
          <div className="hud-panel bracket px-6 py-10 flex flex-col items-center text-center gap-4"
            style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}>
            <div className="mono text-xs tracking-[0.4em] text-[var(--text)] uppercase">
              GameBird Arena
            </div>
            <h1
              className="font-black uppercase tracking-widest leading-none"
              style={{ fontSize: 'clamp(2.5rem,11vw,5rem)', color: 'var(--cyan)', textShadow: '0 0 16px rgba(0,229,255,0.25), ' }}
            >
              The Ultimate<br />
              <span style={{ color: 'var(--gold)', textShadow: '0 0 5px rgba(255,215,0,0.15)' }}>Betting</span>{' '}
              Experience
            </h1>
            <p className="text-sm max-w-lg leading-relaxed" style={{ color: 'var(--text)' }}>
              Join Game Bird for the most exciting peer-to-peer betting platform.
              View live scoreboards &amp; ACTION for free.
              Subscribe to place bets and win real coins!
            </p>
          </div>

          {/* Member Counter */}
          <MemberCounter max={500} />

          {/* Origin Story */}
          <div className="hud-panel bracket px-6 py-8 flex flex-col gap-5"
            style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}>
            <div className="flex items-center gap-3">
              <span className="mono text-xs font-black tracking-[0.3em] uppercase" style={{ color: 'var(--gold)' }}>The Inception</span>
              <div className="flex-1 border-t border-[var(--border)]" />
            </div>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text)', lineHeight: 1.8 }}>
              For as long as pool has been around, betting on it has always been part of the GAME — and the culture surrounding it has never been for the faint of heart.
              Wagering in a pool hall means approaching strangers, negotiating terms, and trusting someone you just met to honor the result.
              That trust breaks down more often than it should. Disputes happen. Tensions rise. Altercations follow.
              And for the spectators who want action but aren't part of the inner circle? They never even get a bet down.
            </p>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--gold)', fontWeight: 700, lineHeight: 1.8 }}>
              Game Bird was built specifically to solve this problem — and to provide a service the pool community has always wanted.
            </p>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text)', lineHeight: 1.8 }}>
              At Game Bird, every wager is placed digitally, matched in real time, and settled automatically when the game ends.
              No confrontations. No chasing anyone down. Bet when you want, walk away whenever you choose.
              And perhaps the greatest luxury — <span style={{ color: 'var(--cyan)', fontWeight: 700 }}>you don't even have to be there.</span>{' '}
              Follow a live match and have real money on the line from your couch, your car, anywhere in the world.
              The pool hall comes to you — <span style={{ color: 'var(--cyan)', fontWeight: 700 }}>never miss ACTION again.</span>
            </p>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text)', lineHeight: 1.8 }}>
              Game Bird's betting queue is the first of its kind — a transparent, organized format for wagering on billiards built for everyone.
              Whether you're a high-stakes player or a casual fan just looking to make a match more interesting,
              there is a place for you here. The excitement is real either way.
            </p>
          </div>

          {/* Why Game Bird */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-xl font-black uppercase tracking-widest" style={{ color: 'var(--cyan)', textShadow: '0 0 6px rgba(0,229,255,0.15)', whiteSpace: 'nowrap' }}>
                Why Choose Game Bird
              </h2>
              <div className="flex-1 border-t border-[var(--border)]" />
            </div>
            <div className="grid grid-cols-1 gap-4">
              {[
                { icon: '◈', color: 'var(--gold)', title: 'Instant Bet Matching', desc: "No waiting around. Game Bird's matching system pairs your bet with an opposing player the moment someone steps up on the other side. You pick your amount, pick your team, and the system handles the rest — fast, clean, and automatic." },
                { icon: '◉', color: 'var(--cyan)', title: 'Player vs. Player — Not the House', desc: "Every coin won comes directly from another player, not a casino margin. There's no rake, no hidden edge, no house advantage. Just you, your read on the game, and whoever's crazy enough to bet the other side." },
                { icon: '⊗', color: 'var(--red)', title: 'Live Action, Any Table', desc: 'Game Bird runs in real time alongside the match. Scores, ball counts, and active bets update live so everyone in the room — and anyone watching — sees the same picture at the same time. No confusion, no disputes.' },
                { icon: '⊘', color: 'var(--green)', title: 'Full Coin Ledger & Audit Trail', desc: 'Every bet placed, every coin moved, every tip sent — all of it is recorded. Players can see their own history. Admins have a complete audit log showing game-by-game balance changes and any adjustments made. Nothing disappears.' },
                { icon: '★', color: 'var(--gold)', title: 'Built for the Pool Hall', desc: "Game Bird was built by players who run games, not developers who've never held a cue. The interface is designed for a phone in your hand at a noisy table — big text, fast taps, no fuss. It just works." },
                { icon: '◎', color: 'var(--cyan)', title: 'Admin Controls Built In', desc: 'The room operator has full control — add players, adjust coins, tip out staff, declare winners, and monitor everything from a dedicated admin panel. Run your action your way without any outside interference.' },
              ].map(item => (
                <div key={item.title} className="hud-panel px-5 py-5 flex gap-4 items-start"
                  style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
                  <span style={{ color: item.color, textShadow: `0 0 6px ${item.color}`, fontSize: '1.6rem', flexShrink: 0, marginTop: 2 }}>{item.icon}</span>
                  <div className="flex flex-col gap-1">
                    <div className="font-black text-sm uppercase tracking-widest" style={{ color: item.color }}>{item.title}</div>
                    <div className="text-sm text-[var(--text)] leading-relaxed">{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Access tiers */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-xl font-black uppercase tracking-widest" style={{ color: 'var(--cyan)', textShadow: '0 0 6px rgba(0,229,255,0.15)', whiteSpace: 'nowrap' }}>
                Choose Your Access Level
              </h2>
              <div className="flex-1 border-t border-[var(--border)]" />
            </div>
            <p className="text-xs text-[var(--text)] mb-4">Start with a free account to explore, then upgrade to place bets and win real coins.</p>
            <div className="grid grid-cols-2 gap-3">
              {/* Free */}
              <div className="hud-panel bracket overflow-hidden" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
                <div className="px-4 py-3 border-b border-[var(--border)]" style={{ background: 'rgba(0,229,255,0.04)' }}>
                  <div className="font-black text-sm uppercase tracking-widest" style={{ color: 'var(--cyan)' }}>◎ Free Access</div>
                  <div className="mono text-xs text-[var(--text)] mt-0.5">$0 / month</div>
                </div>
                <div className="px-4 py-3 flex flex-col gap-2">
                  {[
                    [true, 'View live scoreboard'],
                    [true, 'Track game progress'],
                    [false, 'Place bets (requires sub)'],
                    [false, 'Watch betting queues'],
                    [false, 'Postbox challenges'],
                  ].map(([ok, label]) => (
                    <div key={label as string} className="flex items-center gap-2 text-xs">
                      <span style={{ color: ok ? 'var(--green)' : 'var(--red)', flexShrink: 0 }}>{ok ? '✓' : '✗'}</span>
                      <span style={{ color: 'var(--text)' }}>{label as string}</span>
                    </div>
                  ))}
                </div>
                <div className="px-4 py-2.5 border-t border-[var(--border)]">
                  <Link to="/9ball-arena" className="btn btn-cyan w-full py-2 text-xs" style={{ textDecoration: 'none' }}>
                    GET FREE ACCESS
                  </Link>
                </div>
              </div>
              {/* Premium */}
              <div className="hud-panel overflow-hidden" style={{ border: '1px solid var(--gold)', boxShadow: '0 0 20px rgba(255,215,0,0.12)', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
                <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: 'rgba(255,215,0,0.3)', background: 'rgba(255,215,0,0.06)' }}>
                  <div>
                    <div className="font-black text-sm uppercase tracking-widest" style={{ color: 'var(--gold)' }}>★ Premium</div>
                    <div className="mono text-xs text-[var(--text)] mt-0.5">$20 / month</div>
                  </div>
                  <span className="mono text-xs px-1.5 py-0.5 font-black" style={{ border: '1px solid var(--gold)', color: 'var(--gold)' }}>HOT</span>
                </div>
                <div className="px-4 py-3 flex flex-col gap-2">
                  {['Everything in Free', 'Place unlimited bets', 'Win real coins', 'Cash out winnings', 'Postbox challenges'].map(label => (
                    <div key={label} className="flex items-center gap-2 text-xs">
                      <span style={{ color: 'var(--green)', flexShrink: 0 }}>✓</span>
                      <span style={{ color: 'var(--text)' }}>{label}</span>
                    </div>
                  ))}
                </div>
                <div className="px-4 py-2.5 border-t" style={{ borderColor: 'rgba(255,215,0,0.3)' }}>
                  <Link to="/membership" className="btn btn-gold w-full py-2 text-xs" style={{ textDecoration: 'none' }}>
                    SIGN UP & SUBSCRIBE
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Live snapshot */}
          <div className="hud-panel bracket overflow-hidden" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
            <div className="px-4 py-2.5 border-b border-[var(--border)] flex items-center gap-2">
              <span className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ background: 'var(--green)', boxShadow: '0 0 6px var(--green)', animation: 'liveDot 1s ease-in-out infinite' }} />
              <span className="mono text-xs tracking-widest" style={{ color: 'var(--green)' }}>LIVE NOW — GAME #{game.currentGameNumber}</span>
            </div>
            <div className="grid grid-cols-2 divide-x divide-[var(--border)]">
              <div className="px-5 py-4 flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[var(--text)] uppercase tracking-widest">Live Bets</span>
                  <span className="mono text-xs font-bold" style={{ color: liveBets > 0 ? 'var(--gold)' : 'var(--text)' }}>{liveBets}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[var(--text)] uppercase tracking-widest">ITM</span>
                  <span className="mono text-xs font-bold" style={{ color: liveITM > 0 ? 'var(--gold)' : 'var(--text)' }}>{liveITM}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[var(--text)] uppercase tracking-widest">Users</span>
                  <span className="mono text-xs font-bold" style={{ color: 'var(--cyan)' }}>{players.length}</span>
                </div>
              </div>
              <div className="px-5 py-4 flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[var(--text)] uppercase tracking-widest">Games Played</span>
                  <span className="mono text-xs font-bold" style={{ color: 'var(--cyan)' }}>{totalGames}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[var(--text)] uppercase tracking-widest">All-time ITM</span>
                  <span className="mono text-xs font-bold" style={{ color: 'var(--gold)' }}>{totalMatched.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[var(--text)] uppercase tracking-widest">Coins In Play</span>
                  <span className="mono text-xs font-bold" style={{ color: 'var(--gold)' }}>{totalCoins.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Current matchup */}
          <div className="hud-panel bracket px-5 py-4" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
            <div className="mono text-xs tracking-widest text-[var(--text)] mb-3">CURRENT MATCHUP</div>
            <div className="flex items-center justify-between gap-4">
              {/* Team A */}
              <div className="flex flex-col items-center flex-1 gap-2">
                <div style={{ width: 120, height: 150, overflow: 'hidden', border: '2px solid var(--cyan)', flexShrink: 0 }}>
                  <img src="/james.jpeg" alt={game.teamAName} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: '70% center' }} />
                </div>
                <span className="font-black uppercase tracking-widest text-sm" style={{ color: 'var(--cyan)', textShadow: '0 0 10px var(--cyan)' }}>
                  {game.teamAName}
                </span>
                <span className="mono text-3xl font-black" style={{ color: 'var(--cyan)' }}>{game.teamAGames}</span>
              </div>
              {/* VS */}
              <div className="flex flex-col items-center gap-1">
                <span className="mono font-black" style={{ fontSize: '1.8rem', color: 'var(--text)' }}>VS</span>
              </div>
              {/* Team B */}
              <div className="flex flex-col items-center flex-1 gap-2">
                <div style={{ width: 120, height: 150, overflow: 'hidden', border: '2px solid var(--red)', flexShrink: 0 }}>
                  <img src="/ross.jpeg" alt={game.teamBName} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: '0% center' }} />
                </div>
                <span className="font-black uppercase tracking-widest text-sm" style={{ color: 'var(--red)', textShadow: '0 0 10px var(--red)' }}>
                  {game.teamBName}
                </span>
                <span className="mono text-3xl font-black" style={{ color: 'var(--red)' }}>{game.teamBGames}</span>
              </div>
            </div>
          </div>

          {/* Player leaderboard */}
          {/* Player standings hidden */}

          {/* CTA */}
          <div className="hud-panel bracket px-6 py-8 text-center flex flex-col items-center gap-4"
            style={{ border: '1px solid var(--gold)', boxShadow: '0 0 30px rgba(255,215,0,0.1)', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }}>
            <div className="text-xl font-black uppercase tracking-widest" style={{ color: 'var(--gold)', textShadow: '0 0 3px rgba(255,215,0,0.15)' }}>
              Ready to Get Started?
            </div>
            <p className="text-sm max-w-md leading-relaxed" style={{ color: 'var(--text)' }}>
              Join players already using Game Bird. Create your free account today and experience the future of pool action!
            </p>
            <div className="flex gap-3 mt-1">
              <Link to="/9ball-arena" className="btn btn-cyan px-8 py-3 text-sm" style={{ textDecoration: 'none' }}>
                ▶ ENTER 9 BALL ARENA
              </Link>
              <Link to="/features" className="btn btn-ghost px-8 py-3 text-sm" style={{ textDecoration: 'none' }}>
                LEARN MORE
              </Link>
            </div>
          </div>

          {/* Footer */}
          <footer className="hud-panel px-5 py-6" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }}>
            <div className="flex flex-col sm:flex-row items-start justify-between gap-6">
              <div>
                <div className="font-black text-lg uppercase tracking-widest" style={{ color: 'var(--cyan)', textShadow: '0 0 10px var(--cyan)' }}>
                  Game Bird
                </div>
                <div className="mono text-xs text-[var(--text)] mt-1">beta</div>
              </div>
              <div className="flex flex-col gap-1 text-xs">
                <div className="font-black uppercase tracking-widest mb-2" style={{ color: 'var(--gold)' }}>Links</div>
                <Link to="/about" style={{ color: 'var(--text)', textDecoration: 'none' }} className="hover:text-[var(--cyan)] transition-colors">About</Link>
                <Link to="/faq" style={{ color: 'var(--text)', textDecoration: 'none' }} className="hover:text-[var(--cyan)] transition-colors">FAQ</Link>
                <Link to="/terms" style={{ color: 'var(--text)', textDecoration: 'none' }} className="hover:text-[var(--cyan)] transition-colors">Terms of Use</Link>
                <Link to="/privacy" style={{ color: 'var(--text)', textDecoration: 'none' }} className="hover:text-[var(--cyan)] transition-colors">Privacy Policy</Link>
                <Link to="/disclaimer" style={{ color: 'var(--text)', textDecoration: 'none' }} className="hover:text-[var(--cyan)] transition-colors">Disclaimer</Link>
                <Link to="/contact" style={{ color: 'var(--text)', textDecoration: 'none' }} className="hover:text-[var(--cyan)] transition-colors">Contact</Link>
              </div>
            </div>
            <div className="border-t border-[var(--border)] mt-5 pt-4 text-center mono text-xs text-[var(--text)]">
              © {new Date().getFullYear()} Game Bird. All rights reserved.
            </div>
          </footer>


        </main>
      </div>
    </div>
  );
}
