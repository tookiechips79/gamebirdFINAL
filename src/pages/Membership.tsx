import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Header from '@/components/layout/Header';
import { useUser } from '@/contexts/UserContext';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';

const STRIPE_PK = 'pk_live_51TnXwG2NXDuVAc2E7qERpBjCkigfCjg5mzCjZHacgYss5V1sCpeF61ySb3b7OJ0tQa9uCNccirJmvF8OwP0wo5q300W6IU6TUt';
const stripePromise = loadStripe(STRIPE_PK);

const SERVER_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:3001'
  : 'https://gamebird-app-production.up.railway.app';

type Mode = 'subscription' | 'reload';
const RELOAD_AMOUNTS = [10, 20, 50, 100, 200, 500, 1000];

function CheckoutForm({ mode, reloadAmt, onSuccess }: {
  mode: Mode; reloadAmt: number; onSuccess: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setProcessing(true);
    setError('');

    const { error: submitErr } = await elements.submit();
    if (submitErr) { setError(submitErr.message || 'Error'); setProcessing(false); return; }

    const { error: confirmErr } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: `${window.location.origin}/membership/success` },
      redirect: 'if_required',
    });

    if (confirmErr) {
      setError(confirmErr.message || 'Payment failed');
      setProcessing(false);
    } else {
      onSuccess();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <PaymentElement options={{ layout: 'tabs' }} />
      {error && <div className="text-xs mono font-black text-center" style={{ color: 'var(--red)' }}>{error}</div>}
      <button
        type="submit"
        disabled={processing || !stripe}
        className={`btn w-full py-3 text-sm font-black tracking-widest ${mode === 'subscription' ? 'btn-glow' : ''}`}
        style={{
          border: `1px solid ${mode === 'subscription' ? 'var(--cyan)' : 'var(--gold)'}`,
          color: mode === 'subscription' ? 'var(--cyan)' : 'var(--gold)',
          background: mode === 'subscription' ? 'rgba(0,229,255,0.08)' : 'rgba(255,215,0,0.08)',
          opacity: (processing || !stripe) ? 0.5 : 1,
        }}
      >
        {processing ? '⟳  PROCESSING...' : mode === 'subscription' ? '★  SUBSCRIBE NOW — $20/mo' : `◈  PAY $${reloadAmt}`}
      </button>
    </form>
  );
}

export default function Membership() {
  const { currentUser, addCredits, updateMembership } = useUser();
  const navigate = useNavigate();

  const [mode, setMode] = useState<Mode>('subscription');
  const [reloadAmt, setReloadAmt] = useState(100);
  const [clientSecret, setClientSecret] = useState('');
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [loadError, setLoadError] = useState('');

  const initPayment = async () => {
    if (!currentUser) return;
    setLoading(true);
    setLoadError('');
    setClientSecret('');
    try {
      const res = await fetch(`${SERVER_URL}/api/stripe/create-payment-intent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, amount: reloadAmt, userId: currentUser.id }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setClientSecret(data.clientSecret);
    } catch (err: any) {
      setLoadError(err.message || 'Failed to initialize payment');
    } finally {
      setLoading(false);
    }
  };

  const handleSuccess = () => {
    if (!currentUser) return;
    if (mode === 'subscription') {
      updateMembership(currentUser.id, {
        tier: 'premium',
        startedAt: Date.now(),
        renewsAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
        cancelledAt: null,
      });
      setSuccessMsg('✓ Membership activated! Welcome to Premium.');
    } else {
      addCredits(currentUser.id, reloadAmt, 'admin_add', `Coin reload — ${reloadAmt} coins purchased`);
      setSuccessMsg(`✓ ${reloadAmt} coins added to your account!`);
    }
    setClientSecret('');
    setTimeout(() => { setSuccessMsg(''); navigate('/9ball-arena'); }, 2500);
  };

  const stripeOptions = clientSecret ? {
    clientSecret,
    appearance: {
      theme: 'night' as const,
      variables: {
        colorPrimary: '#00E5FF',
        colorBackground: '#0d0d20',
        colorText: '#e0e8ff',
        fontFamily: 'Barlow Condensed, sans-serif',
      },
    },
  } : null;

  return (
    <div className="flex flex-col" style={{ minHeight: '100dvh', position: 'relative' }}>
      <div style={{ position: 'fixed', inset: 0, backgroundImage: 'url(https://images.unsplash.com/photo-1582139329536-e7284fece509?fm=jpg&q=60&w=3000&auto=format&fit=crop)', backgroundSize: 'cover', backgroundPosition: 'center', zIndex: 0 }} />
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,4,18,0.38)', zIndex: 1 }} />

      <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <Header />

        <main className="flex-1 w-full max-w-2xl mx-auto px-3 py-6 flex flex-col gap-5">

          {/* Hero */}
          <div className="hud-panel bracket px-6 py-6 text-center flex flex-col items-center gap-2"
            style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}>
            <div className="mono text-xs tracking-[0.4em] text-[var(--text)] uppercase">Game Bird</div>
            <h1 className="font-black uppercase tracking-widest leading-none" style={{ fontSize: 'clamp(1.6rem,6vw,2.6rem)', color: 'var(--cyan)' }}>
              Become a Member
            </h1>
            <p className="text-sm max-w-md leading-relaxed" style={{ color: 'var(--text)' }}>
              Subscribe to access all betting features and reload your coins anytime.
            </p>
            {!currentUser && (
              <div className="mt-2 px-4 py-3 text-center" style={{ border: '1px solid var(--red)', background: 'rgba(255,0,64,0.08)' }}>
                <div className="text-xs mono text-[var(--red)] uppercase tracking-widest mb-2">No player selected</div>
                <Link to="/9ball-arena" className="btn btn-red px-4 py-1.5 text-xs font-black tracking-widest" style={{ textDecoration: 'none' }}>GO TO 9 BALL ARENA</Link>
              </div>
            )}
          </div>

          {/* Plan selector */}
          <div className="grid grid-cols-2 gap-3">
            <div className="hud-panel px-4 py-4 flex flex-col gap-3 cursor-pointer transition-all"
              style={{ background: 'rgba(0,0,0,0.50)', backdropFilter: 'blur(4px)', border: mode === 'subscription' ? '1px solid var(--cyan)' : '1px solid var(--border)' }}
              onClick={() => { setMode('subscription'); setClientSecret(''); }}>
              <div className="flex items-center justify-between">
                <span className="text-xs mono font-black uppercase tracking-widest" style={{ color: mode === 'subscription' ? 'var(--cyan)' : 'var(--text)' }}>Monthly Plan</span>
                {mode === 'subscription' && <span className="text-xs mono" style={{ color: 'var(--cyan)' }}>✓ SELECTED</span>}
              </div>
              <div className="mono font-black" style={{ fontSize: '1.8rem', color: 'var(--cyan)', lineHeight: 1 }}>$20<span className="text-sm font-normal text-[var(--text)]">/mo</span></div>
              <ul className="flex flex-col gap-1.5">
                {['Live betting on all matches', 'Complete betting history', 'Priority customer support', 'Required to place bets'].map(f => (
                  <li key={f} className="flex items-start gap-2">
                    <span className="text-xs mt-0.5" style={{ color: 'var(--green)' }}>✓</span>
                    <span className="text-xs" style={{ color: 'var(--text)' }}>{f}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="hud-panel px-4 py-4 flex flex-col gap-3 cursor-pointer transition-all"
              style={{ background: 'rgba(0,0,0,0.50)', backdropFilter: 'blur(4px)', border: mode === 'reload' ? '1px solid var(--gold)' : '1px solid var(--border)' }}
              onClick={() => { setMode('reload'); setClientSecret(''); }}>
              <div className="flex items-center justify-between">
                <span className="text-xs mono font-black uppercase tracking-widest" style={{ color: mode === 'reload' ? 'var(--gold)' : 'var(--text)' }}>Reload Coins</span>
                {mode === 'reload' && <span className="text-xs mono" style={{ color: 'var(--gold)' }}>✓ SELECTED</span>}
              </div>
              <div className="mono font-black" style={{ fontSize: '1.8rem', color: 'var(--gold)', lineHeight: 1 }}>${reloadAmt}<span className="text-sm font-normal text-[var(--text)]"> = {reloadAmt} coins</span></div>
              <div className="grid grid-cols-4 gap-1.5">
                {RELOAD_AMOUNTS.map(a => (
                  <button key={a} type="button" className="btn py-1 text-xs font-black"
                    style={{ border: `1px solid ${reloadAmt === a && mode === 'reload' ? 'var(--gold)' : 'var(--border)'}`, color: reloadAmt === a && mode === 'reload' ? 'var(--gold)' : 'var(--text)', background: reloadAmt === a && mode === 'reload' ? 'rgba(255,215,0,0.08)' : 'transparent' }}
                    onClick={e => { e.stopPropagation(); setReloadAmt(a); setMode('reload'); setClientSecret(''); }}
                  >${a}</button>
                ))}
              </div>
              <input type="number" min="1" placeholder="Custom amount..."
                className="flex-1 bg-transparent border border-[var(--border)] px-3 py-1.5 text-sm mono outline-none focus:border-[var(--gold)] placeholder:text-[var(--text-dim)]"
                style={{ color: 'var(--gold)' }}
                onClick={e => e.stopPropagation()}
                onChange={e => { const v = Number(e.target.value); if (v > 0) { setReloadAmt(v); setMode('reload'); setClientSecret(''); } }}
              />
              <div className="text-xs text-center" style={{ color: 'var(--text)' }}>$1 = 1 coin</div>
            </div>
          </div>

          {/* Payment panel */}
          <div className="hud-panel px-5 py-5 flex flex-col gap-4"
            style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}>
            <div className="text-xs mono tracking-[0.3em] uppercase" style={{ color: 'var(--cyan)' }}>Payment</div>

            {successMsg ? (
              <div className="text-center text-sm mono font-black py-4" style={{ color: 'var(--green)' }}>{successMsg}</div>
            ) : !clientSecret ? (
              <div className="flex flex-col gap-3">
                {loadError && <div className="text-xs mono text-center" style={{ color: 'var(--red)' }}>{loadError}</div>}
                <button
                  className={`btn w-full py-3 text-sm font-black tracking-widest ${mode === 'subscription' ? 'btn-glow' : ''}`}
                  style={{
                    border: `1px solid ${mode === 'subscription' ? 'var(--cyan)' : 'var(--gold)'}`,
                    color: mode === 'subscription' ? 'var(--cyan)' : 'var(--gold)',
                    background: mode === 'subscription' ? 'rgba(0,229,255,0.08)' : 'rgba(255,215,0,0.08)',
                    opacity: (!currentUser || loading) ? 0.5 : 1,
                  }}
                  disabled={!currentUser || loading}
                  onClick={initPayment}
                >
                  {loading ? '⟳  LOADING...' : mode === 'subscription' ? '★  SUBSCRIBE — $20/mo' : `◈  RELOAD ${reloadAmt} COINS — $${reloadAmt}`}
                </button>
                <button className="btn btn-ghost w-full py-2 text-xs font-black tracking-widest" onClick={() => navigate('/9ball-arena')}>CANCEL</button>
              </div>
            ) : (
              stripeOptions && (
                <Elements stripe={stripePromise} options={stripeOptions}>
                  <CheckoutForm mode={mode} reloadAmt={reloadAmt} onSuccess={handleSuccess} />
                </Elements>
              )
            )}

            <div className="text-xs text-center" style={{ color: 'var(--text-dim)' }}>
              🔒 Payments secured by Stripe · By proceeding you agree to our Terms of Service
            </div>
          </div>

          {/* Alternative payment */}
          <div className="hud-panel px-5 py-5" style={{ background: 'rgba(0,0,0,0.50)', backdropFilter: 'blur(4px)' }}>
            <div className="text-xs mono tracking-[0.3em] text-[var(--cyan)] uppercase mb-4">Alternative Payment Methods</div>
            <div className="hud-panel px-4 py-4 mb-4" style={{ background: 'rgba(0,0,0,0.35)', border: '1px solid var(--border)' }}>
              <div className="font-black uppercase tracking-wide text-sm mb-2" style={{ color: 'var(--cyan)' }}>📝 Payment Instructions</div>
              <p className="text-xs leading-relaxed mb-2" style={{ color: 'var(--text)' }}>When paying via QR code, include a note:</p>
              <div className="px-3 py-2" style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid var(--border)' }}>
                <div className="mono text-xs" style={{ color: 'var(--cyan)' }}><strong>Format:</strong> username-amount</div>
                <div className="mono text-xs mt-1" style={{ color: 'var(--cyan)' }}><strong>Example:</strong> john_doe-1000</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="hud-panel px-4 py-4 flex flex-col items-center gap-3" style={{ background: 'rgba(0,0,0,0.35)' }}>
                <div className="font-black uppercase tracking-widest text-sm" style={{ color: 'var(--cyan)' }}>Venmo</div>
                <div className="p-2 bg-white" style={{ borderRadius: 4 }}>
                  <img src="/venmo.png" alt="Venmo QR" style={{ width: 140, height: 140, objectFit: 'contain', display: 'block' }} />
                </div>
                <div className="text-xs mono text-center" style={{ color: 'var(--text)' }}>@gamebird2025</div>
              </div>
              <div className="hud-panel px-4 py-4 flex flex-col items-center gap-3" style={{ background: 'rgba(0,0,0,0.35)' }}>
                <div className="font-black uppercase tracking-widest text-sm" style={{ color: 'var(--cyan)' }}>Zelle</div>
                <div className="p-2 bg-white" style={{ borderRadius: 4 }}>
                  <img src="/zelle.png" alt="Zelle QR" style={{ width: 140, height: 140, objectFit: 'contain', display: 'block' }} />
                </div>
                <div className="text-xs mono text-center" style={{ color: 'var(--text)' }}>Tag: gamebird<br />gamebird2025@gmail.com</div>
              </div>
            </div>
          </div>

        </main>
      </div>
    </div>
  );
}
