import React from 'react';
import Header from '@/components/layout/Header';

export default function Contact() {
  return (
    <div className="flex flex-col" style={{ minHeight: '100dvh', background: 'var(--bg)' }}>
      <Header />
      <main className="flex-1 w-full max-w-2xl mx-auto px-4 py-8 flex flex-col gap-6">

        {/* Title */}
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black uppercase tracking-widest" style={{ color: 'var(--cyan)', textShadow: '0 0 8px rgba(0,229,255,0.15)' }}>
              Contact
            </h1>
            <div className="flex-1 border-t border-[var(--border)]" />
          </div>
          <p className="mono text-xs" style={{ color: 'var(--text)' }}>GET IN TOUCH WITH GAME BIRD</p>
        </div>

        {/* Contact cards */}
        <div className="flex flex-col gap-4">
          <div className="hud-panel overflow-hidden">
            <div className="px-4 py-2.5 border-b border-[var(--border)]" style={{ background: 'rgba(0,229,255,0.03)' }}>
              <span className="text-xs font-black uppercase tracking-widest" style={{ color: 'var(--cyan)' }}>Email</span>
            </div>
            <div className="px-4 py-4">
              <a href="mailto:admin@gamebird.bet" className="text-lg font-black mono" style={{ color: 'var(--text)', textDecoration: 'none' }}>
                admin@gamebird.bet
              </a>
            </div>
          </div>

          <div className="hud-panel overflow-hidden">
            <div className="px-4 py-2.5 border-b border-[var(--border)]" style={{ background: 'rgba(255,215,0,0.03)' }}>
              <span className="text-xs font-black uppercase tracking-widest" style={{ color: 'var(--gold)' }}>Phone</span>
            </div>
            <div className="px-4 py-4">
              <a href="tel:+17026630500" className="text-lg font-black mono" style={{ color: 'var(--text)', textDecoration: 'none' }}>
                +1 (702) 663-0500
              </a>
            </div>
          </div>
        </div>

        {/* Footer note */}
        <div className="text-center pb-4">
          <p className="mono text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>© {new Date().getFullYear()} Game Bird. All rights reserved.</p>
        </div>

      </main>
    </div>
  );
}
