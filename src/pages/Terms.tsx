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
    title: 'What Game Bird Is',
    items: [
      'Game Bird is a private, invite-only platform for wagering virtual Sweep Coins on live billiards matches.',
      'Sweep Coins are virtual currency only. They hold no real-money value and cannot be withdrawn, sold, or exchanged for cash or any other asset.',
      'Access to Game Bird is granted exclusively by an administrator. Unauthorized access or sharing of credentials is prohibited.',
    ],
  },
  {
    title: 'Eligibility',
    items: [
      'You must be 18 years of age or older to participate.',
      'By using Game Bird, you confirm that you meet the eligibility requirements and that participation is permitted under the laws of your jurisdiction.',
      'Accounts are created and managed by an admin. Players may not create their own accounts.',
    ],
  },
  {
    title: 'Sweep Coins',
    items: [
      'Sweep Coins are the virtual currency used exclusively within Game Bird for placing bets on live matches.',
      'Sweep Coins have no monetary value, are non-transferable between accounts, and are non-refundable.',
      'All coin issuance, adjustments, and account balances are managed by the administrator.',
      'Unused Sweep Coins do not expire and will remain in your account until used.',
    ],
  },
  {
    title: 'Betting Rules',
    items: [
      'All bets are processed on a first-in, first-out (FIFO) basis at 1:1 odds.',
      'Once a bet is matched (Booked), it is final and cannot be cancelled or modified.',
      'Unmatched bets may be cancelled at any time before they are booked, and the Sweep Coins are immediately returned to your balance.',
      'Placing a bet constitutes acceptance of these rules. No exceptions will be made after a bet is booked.',
    ],
  },
  {
    title: 'Fair Play',
    items: [
      'Collusion, manipulation of game outcomes, or any form of abuse of the betting system is strictly prohibited and will result in account suspension.',
      'Admin decisions on game outcomes, dispute resolution, and coin balances are final.',
      'All matched bets are recorded in a permanent admin-accessible log used for verification and dispute resolution.',
    ],
  },
  {
    title: 'Availability & Liability',
    items: [
      'Game Bird is provided as-is with no guarantee of uptime, accuracy, or uninterrupted access.',
      'The administrator reserves the right to suspend, modify, or terminate any account at any time.',
      'Game Bird and its operators are not liable for any losses arising from technical issues, outages, or disputes.',
    ],
  },
  {
    title: 'Privacy',
    items: [
      'No personal data is sold or shared with third parties.',
      'Activity logs and bet history are retained for dispute resolution purposes and accessible only by administrators.',
      'By using Game Bird, you consent to the collection of activity data for the purpose of maintaining fairness and resolving disputes.',
    ],
  },
];

export default function Terms() {
  return (
    <div className="flex flex-col" style={{ minHeight: '100dvh', position: 'relative' }}>
      {/* Background */}
      <div style={{ position: 'fixed', inset: 0, backgroundImage: 'url(https://elements-resized.envatousercontent.com/elements-video-cover-images/746d8539-4d7c-49fc-8f52-a0c6e1d62aaf/video_preview/video_preview_0000.jpg?w=1600&cf_fit=cover&q=85&format=auto&s=77c66e2e42400d7bfc2506ca928762348ca4656ca90db0a23bdc6f8c901d4484)', backgroundSize: 'cover', backgroundPosition: 'center', zIndex: 0 }} />
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
              Terms of<br />
              <span style={{ color: 'var(--gold)' }}>Use</span>
            </h1>
            <p className="text-sm max-w-md leading-relaxed" style={{ color: 'var(--text)' }}>
              By accessing or using Game Bird, you agree to the following terms. Please read them carefully.
            </p>
            <p className="mono text-xs" style={{ color: 'var(--text-dim)' }}>Last updated: June 2025</p>
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
              Contact your Game Bird administrator for any questions about these terms or your account.
            </p>
            <div className="flex gap-3 mt-1">
              <Link to="/9ball-arena" className="btn btn-cyan px-8 py-3 text-sm" style={{ textDecoration: 'none' }}>
                ▶ ENTER 9 BALL ARENA
              </Link>
              <Link to="/privacy" className="btn btn-ghost px-8 py-3 text-sm" style={{ textDecoration: 'none' }}>
                PRIVACY
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
