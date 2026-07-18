import React from 'react';
import { Link } from 'react-router-dom';
import Header from '@/components/layout/Header';

function Section({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3 mb-6">
      <h2 className="text-2xl font-black uppercase tracking-widest" style={{ color: 'var(--cyan)', textShadow: '0 0 8px rgba(0,229,255,0.15)', whiteSpace: 'nowrap' }}>
        {title}
      </h2>
      <div className="flex-1 border-t border-[var(--border)]" />
    </div>
  );
}

const benefits = [
  {
    icon: '◈',
    color: 'var(--cyan)',
    title: 'Guaranteed Payouts',
    desc: 'Never worry about getting paid on your winning bets. Our platform ensures all payouts are processed automatically and securely.',
  },
  {
    icon: '◉',
    color: 'var(--green)',
    title: 'Real-Time Updates',
    desc: 'Get instant updates on match progress, scores, and betting queues. Stay connected to the action with live synchronization across all devices.',
  },
  {
    icon: '⊞',
    color: 'var(--cyan)',
    title: 'Mobile & Desktop Access',
    desc: 'Access the platform from any device — phone, tablet, or computer. Responsive design ensures an optimal experience everywhere.',
  },
  {
    icon: '◈',
    color: 'var(--gold)',
    title: 'Digital Currency System',
    desc: 'Use our secure digital Sweep Coins system for all transactions. Easy to manage, track, and transfer between users.',
  },
  {
    icon: '⊕',
    color: 'var(--cyan)',
    title: 'User-Friendly Interface',
    desc: 'Intuitive design makes betting simple and enjoyable. Clear visual indicators, easy navigation, and helpful tooltips guide you through every step.',
  },
  {
    icon: '↑',
    color: 'var(--green)',
    title: 'Live Betting Opportunities',
    desc: 'Bet on matches as they happen! Our in-game betting feature allows you to place wagers during live matches, maximizing your opportunities.',
  },
  {
    icon: '⊘',
    color: 'var(--red)',
    title: 'Secure & Private',
    desc: 'Your data and transactions are protected with enterprise-grade security. Private betting history and secure account management.',
  },
  {
    icon: '★',
    color: 'var(--gold)',
    title: 'Fair Play Guaranteed',
    desc: 'Transparent betting system with clear rules and fair odds. No hidden fees, no manipulation — just honest, exciting betting.',
  },
];

const platformFeatures = [
  { icon: '◈', color: 'var(--cyan)', title: 'Live Scoreboard', desc: 'Real-time score tracking with game timer, match statistics, and live sync across all devices.' },
  { icon: '⊕', color: 'var(--gold)', title: 'Betting Queue', desc: 'Place bets on current or upcoming games. Bets are matched automatically and booked instantly — winnings credited the moment results are submitted by admins or agents.' },
  { icon: '⚖', color: 'var(--gold)', title: 'Postbox — Escrow Challenges', desc: 'Challenge any player head-to-head, in the pool hall or online. Coins lock into escrow on both sides, a neutral judge records the outcome via a unique link, and the winner gets paid instantly — no posting cash, no chasing.' },
  { icon: '⇄', color: 'var(--cyan)', title: 'P2P Coin Transfer', desc: 'Send coins directly to any player by username. Instant, fee-free transfers with a full transaction record on both sides.' },
  { icon: '◈', color: 'var(--green)', title: 'Transaction History', desc: 'Complete record of all bets, wins, transfers, challenges, and credit transactions.' },
  { icon: '★', color: 'var(--gold)', title: 'Admin Controls', desc: 'Comprehensive admin tools for managing games, users, and payouts in real time.' },
];

export default function About() {
  return (
    <div className="flex flex-col" style={{ minHeight: "100dvh", position: 'relative' }}>
      {/* Background image */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          backgroundImage: 'url(/111.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          zIndex: 0,
        }}
      />
      {/* Dark overlay */}
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,4,18,0.38)', zIndex: 1 }} />

      <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <Header />

        <main className="flex-1 w-full max-w-2xl mx-auto px-3 py-6 flex flex-col gap-10">

          {/* Hero */}
          <div className="hud-panel bracket px-6 py-10 text-center flex flex-col items-center gap-4"
            style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}>
            <div className="mono text-sm tracking-[0.4em] text-[var(--text)] uppercase">About Game Bird</div>
            <h1
              className="font-black uppercase tracking-widest leading-none"
              style={{ fontSize: 'clamp(2rem,9vw,4rem)', color: 'var(--cyan)', textShadow: '0 0 16px rgba(0,229,255,0.25)' }}
            >
              The Future of<br />
              <span style={{ color: 'var(--gold)', textShadow: '0 0 5px rgba(255,215,0,0.15)' }}>Pool Betting</span>
            </h1>
            <p className="text-sm max-w-lg leading-relaxed" style={{ color: 'var(--text)' }}>
              Experience the most advanced, secure, and user-friendly pool betting platform.
              Bet on Tournament and Action matches from your venue or from anywhere on your device.
              Enjoy guaranteed payouts, real-time updates, and a gamified experience that elevates the excitement of competitive pool.
            </p>
            <div className="flex flex-wrap justify-center gap-2 mt-1">
              {[
                { label: 'Secure & Trusted', color: 'var(--cyan)' },
                { label: 'Real-Time Updates', color: 'var(--green)' },
                { label: 'Guaranteed Payouts', color: 'var(--gold)' },
              ].map(b => (
                <span key={b.label} className="mono text-sm px-3 py-1 font-black uppercase tracking-widest"
                  style={{ border: `1px solid ${b.color}`, color: b.color, textShadow: `0 0 8px ${b.color}` }}>
                  {b.label}
                </span>
              ))}
            </div>
          </div>

          {/* What We Offer */}
          <div>
            <Section title="What We Offer" />
            <div className="grid grid-cols-1 gap-3">
              {[
                {
                  icon: '◉',
                  color: 'var(--cyan)',
                  title: 'Flexible Betting',
                  desc: 'Bet on pool matches either in person at the venue or from the convenience of your computer. No more worrying about getting paid on your bets — we guarantee all payouts.',
                },
                {
                  icon: '⊕',
                  color: 'var(--gold)',
                  title: 'In-Game Betting',
                  desc: 'Place bets in the middle of games! Our real-time system allows you to bet on live matches as they unfold, adding excitement to every shot.',
                },
                {
                  icon: '◈',
                  color: 'var(--green)',
                  title: 'Instant Access',
                  desc: 'Anyone can bet on any side and can quit at any time. No long-term commitments, no complicated signup processes — just pure betting excitement.',
                },
              ].map(item => (
                <div key={item.title} className="hud-panel px-4 py-4 flex items-start gap-4"
                  style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}>
                  <span style={{ color: item.color, textShadow: `0 0 5px ${item.color}`, fontSize: '1.5rem', flexShrink: 0, lineHeight: 1 }}>
                    {item.icon}
                  </span>
                  <div>
                    <div className="font-black uppercase tracking-wide mb-1" style={{ color: item.color }}>{item.title}</div>
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--text)' }}>{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Key Benefits */}
          <div>
            <Section title="Key Benefits" />
            <div className="grid grid-cols-1 gap-3">
              {benefits.map(b => (
                <div key={b.title} className="hud-panel px-4 py-3 flex items-start gap-4"
                  style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}>
                  <span style={{ color: b.color, textShadow: `0 0 4px ${b.color}`, fontSize: '1.25rem', flexShrink: 0, lineHeight: 1.3 }}>
                    {b.icon}
                  </span>
                  <div>
                    <div className="font-black uppercase tracking-wide text-sm mb-0.5" style={{ color: b.color }}>{b.title}</div>
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--text)' }}>{b.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* How It Works */}
          <div>
            <Section title="How It Works" />
            <div className="grid grid-cols-2 gap-3">
              {[
                { step: '1', title: 'Sign Up', desc: 'Create your account in seconds. Choose between free access or premium membership.', color: 'var(--cyan)' },
                { step: '2', title: 'Get Credits', desc: 'Load your account with Sweep Coins. Admin can reload credits for any user.', color: 'var(--gold)' },
                { step: '3', title: 'Place Bets', desc: 'Bet on current or next games. Watch your bets get matched in real-time.', color: 'var(--cyan)' },
                { step: '4', title: 'Win & Collect', desc: 'Automatic payouts for winning bets. Track your history and earnings.', color: 'var(--green)' },
              ].map(item => (
                <div key={item.step} className="hud-panel px-4 py-4 flex flex-col gap-2"
                  style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}>
                  <div className="mono font-black text-2xl" style={{ color: item.color, textShadow: `0 0 5px ${item.color}`, opacity: 0.6 }}>
                    {item.step.padStart(2, '0')}
                  </div>
                  <div className="font-black uppercase tracking-wide text-sm" style={{ color: item.color }}>{item.title}</div>
                  <p className="text-sm text-[var(--text)] leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Platform Features */}
          <div>
            <Section title="Platform Features" />
            <div className="grid grid-cols-2 gap-3">
              {platformFeatures.map(f => (
                <div key={f.title} className="hud-panel px-4 py-3 flex items-start gap-3"
                  style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}>
                  <span style={{ color: f.color, fontSize: '1.1rem', flexShrink: 0, lineHeight: 1.4 }}>{f.icon}</span>
                  <div>
                    <div className="font-black text-sm uppercase tracking-wide mb-0.5" style={{ color: f.color }}>{f.title}</div>
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--text)' }}>{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* CTA */}
          <div className="hud-panel bracket px-6 py-8 text-center flex flex-col items-center gap-4"
            style={{ border: '1px solid var(--gold)', boxShadow: '0 0 30px rgba(255,215,0,0.1)', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }}>
            <div className="text-xl font-black uppercase tracking-widest" style={{ color: 'var(--gold)', textShadow: '0 0 3px rgba(255,215,0,0.15)' }}>
              Ready to Start Betting?
            </div>
            <p className="text-sm max-w-md leading-relaxed" style={{ color: 'var(--text)' }}>
              Join the most advanced pool betting platform and experience the future of sports betting.
            </p>
            <div className="flex gap-3 mt-1">
              <Link to="/9ball-arena" className="btn btn-cyan px-8 py-3 text-sm" style={{ textDecoration: 'none' }}>
                ▶ ENTER 9 BALL ARENA
              </Link>
              <Link to="/features" className="btn btn-ghost px-8 py-3 text-sm" style={{ textDecoration: 'none' }}>
                VIEW FEATURES
              </Link>
            </div>
          </div>

        </main>
      </div>
    </div>
  );
}
