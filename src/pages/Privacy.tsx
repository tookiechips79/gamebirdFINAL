import React from 'react';
import { Link } from 'react-router-dom';
import Header from '@/components/layout/Header';

function Section({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <h2 className="text-2xl font-black uppercase tracking-widest" style={{ color: 'var(--cyan)', whiteSpace: 'nowrap' }}>
        {title}
      </h2>
      <div className="flex-1 border-t border-[var(--border)]" />
    </div>
  );
}

const sections = [
  {
    title: 'What We Collect',
    items: [
      'Your display name — used to identify your account and shown in the betting queue and arena.',
      'Betting activity — bets placed, player selections, amounts, and win/loss results.',
      'Sweep Coin balance and transaction history — maintained for accuracy and dispute resolution.',
    ],
  },
  {
    title: 'What We Do Not Collect',
    items: [
      'No email address, phone number, or government-issued ID.',
      'No payment or financial information of any kind. Game Bird does not collect, process, or store credit card numbers, bank details, or any other financial data.',
      'Sweep Coins are virtual currency with no monetary value — no financial transaction is ever required to use the platform.',
      'No location data, browser cookies, device fingerprints, or third-party tracking.',
    ],
  },
  {
    title: 'How Your Data Is Used',
    items: [
      'To run your account and display your name in the arena and betting queue.',
      'To process bets, track coin balances, and issue bet receipts.',
      'To maintain a permanent log of all matched bets used by admins to verify results and resolve disputes.',
    ],
  },
  {
    title: 'Who Can See Your Data',
    items: [
      'Your display name and active bets are visible to all players in the arena during a session.',
      'Your full transaction history and coin balance are visible to you and to administrators.',
      'The complete bet log is accessible to administrators only.',
      'No data is shared with, sold to, or accessible by any third party.',
    ],
  },
  {
    title: 'Data Storage',
    items: [
      'All data is stored locally on the device running the Game Bird server.',
      'There is no external cloud database, analytics service, or remote data storage.',
      'If the server is reset, stored data may be cleared. Admins are responsible for maintaining backups.',
    ],
  },
  {
    title: 'Your Rights',
    items: [
      'You may request that your account and associated data be deleted at any time by contacting your Game Bird administrator.',
      'You may request a summary of your betting activity or transaction history from your administrator.',
      'Since Game Bird does not collect personal contact information, all requests must be made directly to your admin.',
    ],
  },
];

export default function Privacy() {
  return (
    <div className="flex flex-col" style={{ minHeight: '100dvh', position: 'relative' }}>
      {/* Background */}
      <div style={{ position: 'fixed', inset: 0, backgroundImage: 'url(https://assets.aclu.org/live/uploads/2024/03/gavel-data-privacy-blog.jpg)', backgroundSize: 'cover', backgroundPosition: 'center', zIndex: 0 }} />
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,4,18,0.38)', zIndex: 1 }} />

      <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', minHeight: '100dvh' }}>
        <Header />

        <main className="flex-1 w-full max-w-2xl mx-auto px-3 py-6 flex flex-col gap-8">

          {/* Hero */}
          <div className="hud-panel bracket px-6 py-8 text-center flex flex-col items-center gap-3"
            style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}>
            <div className="mono text-xs tracking-[0.4em] text-[var(--text)] uppercase">Legal</div>
            <h1 className="font-black uppercase tracking-widest leading-none"
              style={{ fontSize: 'clamp(1.8rem,7vw,3rem)', color: 'var(--cyan)' }}>
              Privacy<br />
              <span style={{ color: 'var(--gold)' }}>Policy</span>
            </h1>
            <p className="text-sm max-w-md leading-relaxed" style={{ color: 'var(--text)' }}>
              Game Bird is a private, invite-only platform. We collect only what is necessary to run the app — nothing more.
            </p>
            <p className="mono text-xs" style={{ color: 'var(--text-dim)' }}>Last updated: June 2025</p>
          </div>

          {/* No payment callout */}
          <div className="hud-panel px-5 py-4 flex items-start gap-3"
            style={{ background: 'rgba(0,255,65,0.06)', border: '1px solid rgba(0,255,65,0.2)', backdropFilter: 'blur(4px)' }}>
            <span className="text-xl flex-shrink-0" style={{ color: 'var(--green)' }}>✓</span>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text)' }}>
              <span className="font-black uppercase tracking-wide" style={{ color: 'var(--green)' }}>No payment data — ever.</span>{' '}
              Game Bird does not collect, process, or store any credit card, bank, or financial information.
              Sweep Coins are virtual currency with no real-money value.
            </p>
          </div>

          {/* Sections */}
          {sections.map(section => (
            <div key={section.title} className="hud-panel px-5 py-5"
              style={{ background: 'rgba(0,0,0,0.50)', backdropFilter: 'blur(4px)' }}>
              <Section title={section.title} />
              <ul className="flex flex-col gap-3">
                {section.items.map((item, i) => (
                  <li key={i} className="flex gap-3 text-sm leading-relaxed" style={{ color: 'var(--text)' }}>
                    <span className="flex-shrink-0 mono font-black" style={{ color: 'var(--cyan)' }}>—</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* Footer CTA */}
          <div className="hud-panel bracket px-6 py-8 text-center flex flex-col items-center gap-4"
            style={{ border: '1px solid var(--gold)', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }}>
            <div className="text-xl font-black uppercase tracking-widest" style={{ color: 'var(--gold)' }}>
              Questions?
            </div>
            <p className="text-sm max-w-md leading-relaxed" style={{ color: 'var(--text)' }}>
              Contact your Game Bird administrator for any questions about your data or this policy.
            </p>
            <div className="flex gap-3 mt-1 flex-wrap justify-center">
              <Link to="/9ball-arena" className="btn btn-cyan px-8 py-3 text-sm" style={{ textDecoration: 'none' }}>
                ▶ ENTER 9 BALL ARENA
              </Link>
              <Link to="/terms" className="btn btn-ghost px-8 py-3 text-sm" style={{ textDecoration: 'none' }}>
                TERMS
              </Link>
              <Link to="/faq" className="btn btn-ghost px-8 py-3 text-sm" style={{ textDecoration: 'none' }}>
                FAQ
              </Link>
            </div>
          </div>

        </main>
      </div>
    </div>
  );
}
