import React, { useState } from 'react';
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

const faqItems = [
  {
    id: 'betting',
    category: 'Betting System',
    question: 'How do I place a bet?',
    answer: 'To place a bet, select a player (Player A or Player B) and click the bet button for your desired denomination (10, 50, or 100 Sweep Coins). Your bet is instantly added to the queue — no confirmation needed. You can place multiple bets on the same player or alternate between players. As long as a bet hasn\'t been matched yet, you can delete it from the queue at any time.',
  },
  {
    id: 'denominations',
    category: 'Betting System',
    question: 'What are the available bet denominations?',
    answer: 'You can bet in three denominations: 10, 50, or 100 Sweep Coins. Tap any amount button in the betting queue to instantly place that bet. These standard amounts provide flexibility for different betting preferences and strategies during the game.',
  },
  {
    id: 'booked',
    category: 'Betting System',
    question: "What does 'Booked Bets' mean?",
    answer: "Booked Bets are bets that have been successfully matched with an opposing bet of the same amount. When you place a bet on Player A or Player B, it enters the betting queue. Once a matching bet is found on the opposing player, both bets are paired and marked as Booked — shown with a ✓ BOOKED label in the queue. This creates a balanced 1:1 betting pair for that game.",
  },
  {
    id: 'queue-priority',
    category: 'Betting System',
    question: 'How does the betting queue work with priority?',
    answer: 'The betting queue operates on a strict FIRST-IN, FIRST-OUT (FIFO) priority system. When you place a bet, it\'s added to the back of your player\'s queue. The first bet placed is the first one in line to be matched. This ensures complete fairness — all bets are processed in the exact order they were placed, creating a transparent and predictable betting environment.',
  },
  {
    id: 'auto-matching',
    category: 'Betting System',
    question: 'How does automatic bet matching work?',
    answer: "Automatic matching happens instantly when there's a compatible bet on the opposing player. When you place a bet on Player A, the system checks Player B's queue for the first available matching bet (same amount). If one exists, both bets are immediately matched and marked as 'Booked'. If no matching bet exists, your bet waits in the queue.",
  },
  {
    id: 'matching-order',
    category: 'Betting System',
    question: 'Which bets get matched first?',
    answer: "Bets are matched in strict order-based priority. Your bet will match with the FIRST OPEN BET in the opposing player's queue of the same amount. The matching respects both player priority AND bet amount to ensure fairness.",
  },
  {
    id: 'bet-queue-example',
    category: 'Betting System',
    question: 'Can you explain a betting queue example?',
    answer: "Sure! Let's say Player A queue has: [100, 50, 10] and Player B queue has: [50, 100]. When you place a new 100-coin bet on Player B: (1) The system finds the first open 100-coin bet on Player A, (2) Those two bets instantly match and are marked 'Booked', (3) Your bet is now locked in as matched. If you placed a 25-coin bet instead, it wouldn't match anything — it would sit in the queue waiting.",
  },
  {
    id: 'coins',
    category: 'Account & Credits',
    question: 'How do I reload my Sweep Coins?',
    answer: "You can reload your Sweep Coins by clicking the Get Coins tab in the navigation. Choose a quick amount or enter a custom value, then submit — your balance updates immediately. Admins can also load coins directly to any account on your behalf.",
  },
  {
    id: 'membership',
    category: 'Account & Credits',
    question: 'What is the membership system?',
    answer: 'The membership system offers premium features and benefits. When you purchase a membership, you get enhanced access to betting features and exclusive updates. Your membership status is displayed in your account profile, and you can manage or cancel your membership at any time.',
  },
  {
    id: 'cancel-membership',
    category: 'Account & Credits',
    question: 'Can I cancel my membership?',
    answer: 'Yes, you can cancel your membership at any time from your account settings. When you cancel, your membership will remain active until the end of your current billing period. After that, your account will return to standard status.',
  },
  {
    id: 'what-are-sweep-coins',
    category: 'Account & Credits',
    question: 'What are Sweep Coins?',
    answer: 'Sweep Coins are the virtual currency used in Game Bird for placing bets. They represent your betting value and are used exclusively for wagering on games. Sweep Coins are independent from real money and are managed within the app for gaming purposes only.',
  },
  {
    id: 'earn-sweep-coins',
    category: 'Account & Credits',
    question: 'How can I earn Sweep Coins?',
    answer: 'You can earn Sweep Coins through several ways: by winning matched bets (when your player wins), by receiving promotional bonuses, through membership rewards, or by reloading them in the app. Winning bets increases your balance — check your dashboard to see all your transactions and earnings.',
  },
  {
    id: 'sweep-coins-balance',
    category: 'Account & Credits',
    question: 'Where can I see my Sweep Coins balance?',
    answer: 'Your current Sweep Coins balance is displayed prominently in the wallet widget at the top of the Arena. It updates in real-time as you place bets or complete transactions. Click on your wallet to view detailed transaction history.',
  },
  {
    id: 'reload-amounts',
    category: 'Account & Credits',
    question: 'What reload amounts are available for Sweep Coins?',
    answer: 'Game Bird offers flexible reload options. Quick amounts available are 10, 20, 50, 100, 200, and 500 Sweep Coins. You can also enter a custom amount. Your balance updates immediately once an admin completes the reload.',
  },
  {
    id: 'sweep-coins-reset',
    category: 'Account & Credits',
    question: 'Do Sweep Coins expire or reset?',
    answer: 'Sweep Coins do not expire — they remain in your account indefinitely until you use them for betting. Your balance persists across gaming sessions, so you can accumulate and use your Sweep Coins whenever you want.',
  },
  {
    id: 'scoreboard',
    category: 'Game Features',
    question: 'What information does the Scoreboard show?',
    answer: 'The Scoreboard displays real-time game information including: current game number, player scores (games won), balls remaining for each player, timer status, break status (which player has the break), and live game updates. It provides a complete view of the current match state.',
  },
  {
    id: 'history',
    category: 'Records & Transparency',
    question: 'How can I view my bet history?',
    answer: 'Your bet history and transactions are accessible directly from your wallet — open the wallet and use the BETS or TXN tabs to view your activity. Receipts for every matched bet are also available under the RECEIPTS tab.',
  },
  {
    id: 'receipts',
    category: 'Records & Transparency',
    question: 'What are Bet Receipts?',
    answer: 'Bet Receipts are confirmations issued for every matched bet. Each receipt contains details such as the bet amount, player selection, game number, and win/loss result. These receipts are accessible from your wallet widget and serve as proof of your betting activity.',
  },
  {
    id: 'fair',
    category: 'Fair Play & Rules',
    question: 'How do you ensure fair play?',
    answer: 'Game Bird implements multiple safeguards: immutable bet ledger for transparency, complete transaction history, real-time scoreboard updates, and secure admin controls. All betting activity is recorded and verifiable, ensuring complete fairness and accountability.',
  },
  {
    id: 'odds',
    category: 'Fair Play & Rules',
    question: 'What odds are used?',
    answer: 'The betting system uses straightforward 1:1 odds where matched bets create balanced pairs. When your bet is matched with an opposing player bet of the same amount, both bets are booked at 1:1 — ensuring fairness for all participants.',
  },
  {
    id: 'postbox-what',
    category: 'Postbox',
    question: 'What is Postbox?',
    answer: 'Postbox is how side bets get settled the RIGHT way. Two players agree on a wager, lock coins into escrow, appoint a neutral judge, and the winner gets paid automatically the moment the judge records the outcome. No cash changing hands, no "I\'ll pay you later." Set it, lock it, collect it.',
  },
  {
    id: 'postbox-how',
    category: 'Postbox',
    question: 'How does a Postbox challenge work?',
    answer: 'One player sends a challenge — picking their opponent, naming the two players in action, setting the coin amount, and choosing whether the bet covers a single game or the full match. The opponent sees the challenge in their Postbox and either accepts or declines. Once accepted, both players\' coins lock in escrow automatically. A unique judge link is generated — share it with your agreed-upon judge. When the match is done, the judge opens the link, selects the winner, and the coins release instantly.',
  },
  {
    id: 'postbox-judge',
    category: 'Postbox',
    question: 'Who can be a judge?',
    answer: 'Anyone you and your opponent agree on and trust — a friend, a rail bird, the room operator, or even a player involved in the match. They don\'t need a Game Bird account. As long as both sides trust them to call it straight, they\'re your judge. Just share the unique judge link and they can record the outcome from any device.',
  },
  {
    id: 'postbox-escrow',
    category: 'Postbox',
    question: 'What happens to the coins while a challenge is active?',
    answer: 'The moment both sides accept, the coins are deducted from both players and held in escrow. Neither player can access them until the judge records the outcome. Once the winner is declared, the full pot is credited to them instantly.',
  },
  {
    id: 'postbox-premium',
    category: 'Postbox',
    question: 'Do I need a membership to use Postbox?',
    answer: 'Yes — Postbox is a Premium feature. You need an active $20/month membership to send and receive challenges. Free accounts can view the arena and scoreboard but cannot access Postbox.',
  },
  {
    id: 'pwa',
    category: 'Technical',
    question: 'Can I use Game Bird on mobile?',
    answer: 'Yes! Game Bird is fully responsive and works on phones, tablets, and desktops. You can also install it as a Progressive Web App (PWA) on your device for a native app-like experience. Look for the install prompt in your browser to add it to your home screen.',
  },
  {
    id: 'support',
    category: 'Support',
    question: 'Where can I get help?',
    answer: 'For support, check this FAQ page first for answers to common questions. If you need additional assistance, visit the About page for more information about Game Bird or contact the admin directly through the platform.',
  },
];

const categories = Array.from(new Set(faqItems.map(item => item.category)));

export default function FAQ() {
  const [expanded, setExpanded] = useState<string[]>([]);

  const toggle = (id: string) =>
    setExpanded(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  return (
    <div className="flex flex-col" style={{ minHeight: '100dvh', position: 'relative' }}>
      {/* Background */}
      <div style={{ position: 'fixed', inset: 0, backgroundImage: 'url(https://www.thescroller.net/wp-content/uploads/2025/03/oldschoolcoolbilliards10.png)', backgroundSize: 'cover', backgroundPosition: 'center', zIndex: 0 }} />
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,4,18,0.35)', zIndex: 1 }} />

      <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <Header />

        <main className="flex-1 w-full max-w-2xl mx-auto px-3 py-6 flex flex-col gap-8">

          {/* Hero */}
          <div className="hud-panel bracket px-6 py-8 text-center flex flex-col items-center gap-3"
            style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}>
            <div className="mono text-xs tracking-[0.4em] text-[var(--text)] uppercase">Help Center</div>
            <h1 className="font-black uppercase tracking-widest leading-none"
              style={{ fontSize: 'clamp(1.8rem,7vw,3rem)', color: 'var(--cyan)' }}>
              Frequently Asked<br />
              <span style={{ color: 'var(--gold)' }}>Questions</span>
            </h1>
            <p className="text-sm max-w-md leading-relaxed" style={{ color: 'var(--text)' }}>
              Find answers to common questions about the Game Bird betting platform.
            </p>
          </div>

          {/* FAQ Categories */}
          {categories.map(category => (
            <div key={category}>
              <Section title={category} />
              <div className="flex flex-col gap-2">
                {faqItems.filter(item => item.category === category).map(item => {
                  const open = expanded.includes(item.id);
                  return (
                    <div
                      key={item.id}
                      className="hud-panel overflow-hidden"
                      style={{ background: 'rgba(0,0,0,0.50)', backdropFilter: 'blur(4px)', cursor: 'pointer' }}
                      onClick={() => toggle(item.id)}
                    >
                      <div className="flex items-center justify-between px-4 py-3 gap-3">
                        <span className="font-black uppercase tracking-wide text-sm" style={{ color: open ? 'var(--cyan)' : 'var(--text)' }}>
                          {item.question}
                        </span>
                        <span className="mono font-black flex-shrink-0 text-sm" style={{ color: 'var(--cyan)' }}>
                          {open ? '▲' : '▼'}
                        </span>
                      </div>
                      {open && (
                        <div className="px-4 pb-4 border-t border-[var(--border)]" style={{ paddingTop: 10 }}>
                          <p className="text-sm leading-relaxed" style={{ color: 'var(--text)' }}>
                            {item.answer}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* CTA */}
          <div className="hud-panel bracket px-6 py-8 text-center flex flex-col items-center gap-4"
            style={{ border: '1px solid var(--gold)', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }}>
            <div className="text-xl font-black uppercase tracking-widest" style={{ color: 'var(--gold)' }}>
              Still Have Questions?
            </div>
            <p className="text-sm max-w-md leading-relaxed" style={{ color: 'var(--text)' }}>
              Check out our other resources or head straight to the arena.
            </p>
            <div className="flex gap-3 mt-1 flex-wrap justify-center">
              <Link to="/9ball-arena" className="btn btn-cyan px-8 py-3 text-sm" style={{ textDecoration: 'none' }}>
                ▶ ENTER 9 BALL ARENA
              </Link>
              <Link to="/about" className="btn btn-ghost px-8 py-3 text-sm" style={{ textDecoration: 'none' }}>
                ABOUT US
              </Link>
              <Link to="/terms" className="btn btn-ghost px-8 py-3 text-sm" style={{ textDecoration: 'none' }}>
                TERMS
              </Link>
            </div>
          </div>

        </main>
      </div>
    </div>
  );
}
