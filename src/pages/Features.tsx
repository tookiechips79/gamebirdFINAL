import React from 'react';
import { Link } from 'react-router-dom';
import Header from '@/components/layout/Header';

function Check() {
  return <span style={{ color: 'var(--cyan)', flexShrink: 0 }}>✓</span>;
}
function Lock() {
  return <span style={{ color: 'var(--red)', flexShrink: 0 }}>✗</span>;
}

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

export default function Features() {
  return (
    <div className="flex flex-col" style={{ minHeight: '100dvh', position: 'relative' }}>
      <div style={{ position: 'fixed', inset: 0, backgroundImage: 'url(https://s.yimg.com/lo/mysterio/api/C0891783FAF0BE061B39422F9EA4E18AAD6D5CAF91D040A7194D31001D9D3DAD/subgraphmysterio/resizefit_w960_h640;quality_80;format_webp/https:%2F%2Fmedia.zenfs.com%2Fen%2Fwealth_gang_aol_363%2F07393f370291c4b1d8fe3e3085c7b3c2)', backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat', zIndex: 0 }} />
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,4,18,0.35)', zIndex: 1 }} />
      <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', minHeight: '100dvh', ['--panel' as string]: 'rgba(8,8,24,0.55)' }}>
      <Header />

      <main className="flex-1 w-full max-w-2xl mx-auto px-3 py-6 flex flex-col gap-10">

        {/* Hero */}
        <div className="hud-panel bracket px-6 py-8 text-center flex flex-col items-center gap-3">
          <div className="mono text-sm tracking-[0.4em] text-[var(--text)] uppercase">Platform Guide</div>
          <h1
            className="font-black uppercase tracking-widest leading-none"
            style={{ fontSize: 'clamp(2rem,8vw,3.5rem)', color: 'var(--cyan)', textShadow: '0 0 16px rgba(0,229,255,0.2)' }}
          >
            How Game Bird Works
          </h1>
          <p className="text-sm max-w-lg" style={{ color: 'var(--text)', lineHeight: 1.6 }}>
            A comprehensive guide to understanding our betting platform — from getting started to winning sweep coins.
          </p>
        </div>

        {/* Platform Overview */}
        <div>
          <Section title="Platform Overview" />
          <div className="hud-panel bracket overflow-hidden mb-3">
            <div className="px-4 py-3 border-b border-[var(--border)]">
              <p className="text-sm" style={{ color: 'var(--text)', lineHeight: 1.6 }}>
                Game Bird is a real-time betting platform where users can place bets on live billiards games, challenge each other head-to-head through the Postbox escrow system, and win sweep coins — all without posting cash or trusting handshakes.
              </p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-[var(--border)]">
              {[
                { icon: '◈', label: 'Real-time Scoreboard', desc: 'Live scores, stats, and game status', color: 'var(--cyan)' },
                { icon: '⊕', label: 'Live Betting', desc: 'Bet on current and upcoming games', color: 'var(--gold)' },
                { icon: '◉', label: 'Real Coins', desc: 'Win coins cashable to your wallet', color: 'var(--green)' },
                { icon: '⚖', label: 'Postbox', desc: 'Head-to-head escrow challenges with a neutral judge', color: 'var(--gold)' },
              ].map(item => (
                <div key={item.label} className="px-4 py-5 flex flex-col items-center gap-2 text-center">
                  <span style={{ color: item.color, textShadow: `0 0 4px ${item.color}`, fontSize: '1.5rem' }}>{item.icon}</span>
                  <div className="font-black text-sm uppercase tracking-wide" style={{ color: item.color }}>{item.label}</div>
                  <div className="text-sm text-[var(--text)] leading-snug">{item.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Getting Started */}
        <div>
          <Section title="Getting Started" />
          <div className="grid grid-cols-2 gap-3">
            {[
              { step: '01', title: 'Create Account', desc: 'Sign up with your details. All new accounts start with 0 credits and inactive membership.', color: 'var(--cyan)' },
              { step: '02', title: 'Access the Scorebox', desc: 'Browse the scoreboard and view all live game activity without membership.', color: 'var(--cyan)' },
              { step: '03', title: 'Subscribe', desc: 'Purchase a $20/month subscription to activate your membership & gain access to the betting queue.', color: 'var(--gold)' },
              { step: '04', title: 'Load Coins', desc: 'Load your account with Sweep Coins and start placing bets. Win coins and cash out your winnings.', color: 'var(--green)' },
            ].map(item => (
              <div key={item.step} className="hud-panel px-4 py-4 flex flex-col gap-2">
                <div className="mono text-sm font-black" style={{ color: item.color, opacity: 0.5 }}>{item.step}</div>
                <div className="font-black text-sm uppercase tracking-wide" style={{ color: item.color }}>{item.title}</div>
                <p className="text-sm text-[var(--text)] leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Core Features */}
        <div>
          <Section title="Core Features" />
          <div className="grid grid-cols-1 gap-3">
            {[
              {
                title: 'POSTBOX — Escrow Challenge System',
                icon: '⚖',
                color: 'var(--gold)',
                items: [
                  'Two players can place a head-to-head bet on any game — in the pool hall or across the internet',
                  'Coins lock into escrow the moment both sides accept, so nobody has to post cash or trust a handshake',
                  'A neutral judge receives a unique link and records the outcome with one tap — no arguing, no chasing',
                  'Winnings are credited instantly and automatically the moment the judge records the final verdict',
                  'Full win/loss record and history tracked per player',
                  'Works anywhere — in person, cross-city, or online',
                ],
              },
              {
                title: 'Real-time Scoreboard',
                icon: '◈',
                color: 'var(--cyan)',
                items: [
                  'Live game scores and statistics',
                  'Current and next game information',
                  'Player names and game status',
                  'Accessible to all users (free and premium)',
                ],
              },
              {
                title: 'Betting Queue',
                icon: '⊕',
                color: 'var(--gold)',
                items: [
                  'Place bets on the current game or lock in your position for the next game before it starts',
                  'Choose your denomination — 10, 50, or 100 Sweep Coins per bet',
                  'Bets are matched automatically against opposing side wagers in real time',
                  'Once matched, your bet is booked and locked — no cancellations, no disputes',
                  'Separate queues for current and next game keep the action organized and always moving',
                  'Unmatched bets are held in queue and auto-booked the moment a matching bet comes in',
                  'All booked bets are visible to every player for full transparency',
                  'Winnings are calculated and credited instantly when the game result is submitted by admins or agents',
                ],
              },
              {
                title: 'Bet Tracking & Transparency',
                icon: '◉',
                color: 'var(--green)',
                items: [
                  'Complete bet receipts for every transaction',
                  'Immutable bet ledger ensuring full transparency',
                  'Complete game and transaction history for record keeping',
                ],
              },
              {
                title: 'P2P Coin Transfer',
                icon: '⇄',
                color: 'var(--green)',
                items: [
                  'Send coins directly to any player by username',
                  'Instant transfer — no fees, no delays',
                  'Both sender and recipient get a full transaction record',
                  'Every transfer is logged for transparency',
                  'Access from your wallet under the P2P TRANSFER tab',
                ],
              },
              {
                title: 'Financial System',
                icon: '◈',
                color: 'var(--gold)',
                items: [
                  'Peer-to-peer Sweep Coins wagering',
                  'Real Sweep Coins winnings and cashouts',
                  'Transaction history tracking',
                  'Secure payment processing',
                  '100% liquid betting pool — all funds instantly cashable at any time',
                ],
              },
            ].map(feat => (
              <div key={feat.title} className="hud-panel bracket overflow-hidden">
                <div className="px-4 py-2.5 border-b border-[var(--border)] flex items-center gap-2"
                  style={{ background: `color-mix(in srgb, ${feat.color} 6%, transparent)` }}>
                  <span style={{ color: feat.color }}>{feat.icon}</span>
                  <span className="font-black text-sm uppercase tracking-widest" style={{ color: feat.color }}>{feat.title}</span>
                </div>
                <div className="px-4 py-3 flex flex-col gap-2">
                  {feat.items.map(item => (
                    <div key={item} className="flex items-start gap-2 text-sm">
                      <Check />
                      <span style={{ color: 'var(--text)' }}>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Membership Tiers */}
        <div>
          <Section title="Membership Tiers" />
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
                <Link to="/arena" className="btn btn-cyan w-full py-2 text-xs" style={{ textDecoration: 'none' }}>
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

        {/* How Betting Works */}
        <div>
          <Section title="How Betting Works" />
          <div className="flex flex-col gap-3">
            {[
              {
                step: '1',
                title: 'Select Your Bet Amount',
                body: 'Choose from 10, 50, or 100 Sweep Coins. Each denomination has its own betting button.',
                extra: (
                  <div className="flex gap-2 mt-2">
                    {['10 SC', '50 SC', '100 SC'].map(v => (
                      <span key={v} className="mono text-sm px-2 py-1 font-black" style={{ border: '1px solid var(--cyan)', color: 'var(--cyan)' }}>{v}</span>
                    ))}
                  </div>
                ),
              },
              {
                step: '2',
                title: 'Choose Your Player',
                body: 'Click the betting button for either Player A or Player B. In-game betting is allowed — you can place bets on the current live game at any time, or queue a bet for the next upcoming game.',
                extra: (
                  <div className="mt-2 px-3 py-2 text-sm" style={{ background: 'rgba(0,229,255,0.05)', border: '1px solid var(--border)', color: 'var(--text)' }}>
                    <span style={{ color: 'var(--cyan)' }}>Current Game (In-Game):</span> Bet on the live game in progress &nbsp;·&nbsp; <span style={{ color: 'var(--gold)' }}>Next Game:</span> Queue a bet for the upcoming game
                  </div>
                ),
              },
              {
                step: '3',
                title: 'Priority-Based Automatic Matching',
                body: 'Your bet enters a queue and is automatically matched using a fair FIFO system — your bet is paired with the first available bet of the same amount on the opposing side.',
                extra: (
                  <div className="mt-2 px-3 py-2 flex flex-col gap-1 text-sm" style={{ background: 'rgba(0,229,255,0.05)', border: '1px solid var(--border)' }}>
                    {[
                      'Bets are matched in FIRST-IN, FIRST-OUT (FIFO) order',
                      'Your bet matches with the first open bet of the same amount on the opposing player',
                      'If no matching bet exists, your bet waits in the queue',
                      'Once matched, both bets are locked in and marked as Booked',
                    ].map(t => (
                      <div key={t} className="flex items-start gap-1.5" style={{ color: 'var(--text)' }}>
                        <span style={{ color: 'var(--green)', flexShrink: 0 }}>✓</span> {t}
                      </div>
                    ))}
                  </div>
                ),
              },
              {
                step: '4',
                title: 'Win or Lose',
                body: 'When the game ends, winning bets automatically receive their winnings. Losing bets are deducted from your account.',
                extra: (
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <div className="px-3 py-2 text-sm" style={{ border: '1px solid var(--green)', background: 'rgba(0,255,65,0.05)' }}>
                      <div className="font-black mb-0.5" style={{ color: 'var(--green)' }}>WIN</div>
                      <div style={{ color: 'var(--text)' }}>Receive your bet amount + winnings</div>
                    </div>
                    <div className="px-3 py-2 text-sm" style={{ border: '1px solid var(--red)', background: 'rgba(255,0,64,0.05)' }}>
                      <div className="font-black mb-0.5" style={{ color: 'var(--red)' }}>LOSE</div>
                      <div style={{ color: 'var(--text)' }}>Bet amount deducted from account</div>
                    </div>
                  </div>
                ),
              },
            ].map(item => (
              <div key={item.step} className="hud-panel px-4 py-4">
                <div className="flex items-start gap-4">
                  <div className="mono font-black text-xl flex-shrink-0 w-8 h-8 flex items-center justify-center"
                    style={{ border: '1.5px solid var(--cyan)', color: 'var(--cyan)', textShadow: '0 0 3px rgba(0,229,255,0.5)' }}>
                    {item.step}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-black uppercase tracking-wide mb-1" style={{ color: 'var(--cyan)' }}>{item.title}</div>
                    <p className="text-sm text-[var(--text)] leading-relaxed">{item.body}</p>
                    {item.extra}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="hud-panel bracket px-6 py-8 text-center flex flex-col items-center gap-4"
          style={{ border: '1px solid var(--gold)', boxShadow: '0 0 30px rgba(255,215,0,0.08)' }}>
          <div className="text-xl font-black uppercase tracking-widest" style={{ color: 'var(--gold)', textShadow: '0 0 3px rgba(255,215,0,0.15)' }}>
            Ready to Start Betting?
          </div>
          <p className="text-sm max-w-md" style={{ color: 'var(--text)', lineHeight: 1.6 }}>
            Join users already winning real coins on Game Bird. Enter the arena and start your betting journey today.
          </p>
          <div className="flex gap-3 mt-1">
            <Link to="/9ball-arena" className="btn btn-cyan px-8 py-3 text-sm" style={{ textDecoration: 'none' }}>
              ▶ ENTER 9 BALL ARENA
            </Link>
          </div>
        </div>

      </main>
      </div>
    </div>
  );
}
