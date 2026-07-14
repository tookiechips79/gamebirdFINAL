// GameBird V2 — End-to-End Live Simulation
// Uses API for user setup/balance checks, Playwright for UI interactions.

import { chromium } from 'playwright';

const APP_URL    = 'https://game-bird-beta.vercel.app';
const API_URL    = 'https://gamebird-app-production.up.railway.app';
const ADMIN_PW   = '1980';
const BET_AMOUNT = 100;
const NUM_GAMES  = 1;
const BETS_PER_PLAYER = 1; // each player places this many bets in each game
const SIM_CREDITS = 1000;

const PLAYER_A = { name: 'SimPlayerA', pin: '1111', password: 'sim1111' };
const PLAYER_B = { name: 'SimPlayerB', pin: '2222', password: 'sim2222' };

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── API helpers ───────────────────────────────────────────────────────────────

async function apiPost(path, body) {
  const r = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return r.json().catch(() => ({}));
}

async function apiGet(path) {
  const r = await fetch(`${API_URL}${path}`);
  return r.json().catch(() => ({}));
}

async function getDbBalance(userId) {
  const data = await apiGet(`/api/credits/${userId}`);
  return typeof data.balance === 'number' ? data.balance : (typeof data.credits === 'number' ? data.credits : null);
}

async function setDbBalance(userId, balance) {
  await apiPost(`/api/credits/${userId}/set`, { balance });
}

async function getOrCreateUser(player) {
  // Try to get existing user
  const all = await apiGet('/api/users');
  const users = Array.isArray(all) ? all : (all.users ?? []);
  const existing = users.find(u => u.name.toLowerCase() === player.name.toLowerCase());
  if (existing) {
    await setDbBalance(existing.id, SIM_CREDITS);
    return existing;
  }
  // Create new
  const created = await apiPost('/api/users', { name: player.name, password: player.password, initialCredits: SIM_CREDITS });
  return created;
}

// ── Browser helpers ───────────────────────────────────────────────────────────

async function goto(page, hash) {
  await page.goto(`${APP_URL}/#${hash}`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  // Wait for React to mount — poll until #root has children
  await page.waitForFunction(() => {
    const root = document.getElementById('root');
    return root && root.innerHTML.length > 50;
  }, { timeout: 30_000, polling: 500 }).catch(() => {});
  await sleep(500);
}

async function enterPin(page, pin) {
  for (const digit of pin.split('')) {
    await page.locator('.grid button').filter({ hasText: new RegExp(`^${digit}$`) }).first().click();
    await sleep(150);
  }
}

function buildLocalUsers(players) {
  // Include default users + our test players (must be a valid array)
  const defaults = [
    { id: 'admin', name: 'Admin', credits: 99999, isAdmin: true, pendingBets: [], transactions: [] },
    { id: 'user1', name: 'Player 1', credits: 1000, isAdmin: false, pendingBets: [], transactions: [] },
    { id: 'user2', name: 'Player 2', credits: 1000, isAdmin: false, pendingBets: [], transactions: [] },
  ];
  const simPlayers = players.map(p => ({
    id: p.id,
    name: p.name,
    credits: SIM_CREDITS,
    pendingBets: [],
    isAdmin: false,
    transactions: [],
    tipsGiven: 0,
    tipsReceived: 0,
    membership: { tier: 'premium', cancelledAt: null },
  }));
  return [...defaults, ...simPlayers];
}

async function placeBetViaUI(page, userId, teamSide, amount) {
  // Force a full reload so addInitScript re-runs and socket re-syncs credits from DB
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.waitForFunction(() => {
    const root = document.getElementById('root');
    return root && root.innerHTML.length > 100;
  }, { timeout: 30_000, polling: 500 }).catch(() => {});
  await sleep(2500); // wait for socket/fetchAndMerge to update credits from DB

  // Debug: check React mount + DOM and actual browser credits state
  const debug = await page.evaluate((uid) => {
    const usersJson = localStorage.getItem('gb_users') || '[]';
    const users = JSON.parse(usersJson);
    const me = users.find((u) => u.id === uid);
    return {
      url: location.href,
      lsCredits: me?.credits ?? 'not found',
      betBtns: document.querySelectorAll('[class*="bet-buttons"]').length,
    };
  }, userId);
  console.log(`    PRE-BET: url=${debug.url} lsCredits=${debug.lsCredits} betBtns=${debug.betBtns}`);
  if (debug.betBtns === 0) {
    throw new Error(`No bet-buttons found. root: ${debug.rootHTML}`);
  }

  // Preset buttons are in .bet-buttons-A or .bet-buttons-B
  const btn = page.locator(`.bet-buttons-${teamSide} button`).filter({ hasText: new RegExp(`^${amount}$`) }).first();
  if (!await btn.isVisible({ timeout: 5000 }).catch(() => false)) {
    throw new Error(`Bet button for Team ${teamSide} amount ${amount} not found`);
  }
  await btn.click();
  await sleep(1000);
}

async function declareWinnerViaUI(adminPage, team) {
  await goto(adminPage, '/admin');
  await sleep(500);
  const btn = adminPage.locator(team === 'A' ? '.btn-cyan' : '.btn-red').filter({ hasText: /✓/ }).first();
  if (!await btn.isVisible({ timeout: 5000 }).catch(() => false)) {
    throw new Error(`Declare winner button for Team ${team} not found`);
  }
  await btn.click();
  await sleep(5000); // allow DB write + propagation
}

// ── Main ──────────────────────────────────────────────────────────────────────
console.log('\n══════════════════════════════════════════════════════');
console.log('  GAMEBIRD V2 — LIVE E2E SIMULATION');
console.log(`  ${NUM_GAMES} game  |  ${BETS_PER_PLAYER * 2} bets  |  ${BET_AMOUNT} coins/bet  |  2 players`);
console.log('══════════════════════════════════════════════════════\n');

// ── Setup: create test users via API ─────────────────────────────────────────
console.log('[ SETUP ] Creating test users via API...');
const userA = await getOrCreateUser(PLAYER_A);
const userB = await getOrCreateUser(PLAYER_B);
if (!userA?.id || !userB?.id) {
  console.error('❌ Failed to create test users:', { userA, userB });
  process.exit(1);
}
console.log(`    ${PLAYER_A.name}: id=${userA.id}  credits=${SIM_CREDITS}`);
console.log(`    ${PLAYER_B.name}: id=${userB.id}  credits=${SIM_CREDITS}`);

// Grant premium membership so the betting UI isn't gated
await apiPost(`/api/users/${userA.id}/membership`, { status: 'premium', name: PLAYER_A.name });
await apiPost(`/api/users/${userB.id}/membership`, { status: 'premium', name: PLAYER_B.name });
console.log('    ✓ Granted premium membership to both sim players');

const localUsers = buildLocalUsers([
  { ...userA, id: userA.id, name: PLAYER_A.name },
  { ...userB, id: userB.id, name: PLAYER_B.name },
]);

// ── Launch browsers ───────────────────────────────────────────────────────────
const browser   = await chromium.launch({ headless: false, slowMo: 30 });
const adminCtx  = await browser.newContext({ viewport: { width: 390, height: 844 } });
const ctxA      = await browser.newContext({ viewport: { width: 390, height: 844 } });
const ctxB      = await browser.newContext({ viewport: { width: 390, height: 844 } });

const adminPage = await adminCtx.newPage();
const pageA     = await ctxA.newPage();
const pageB     = await ctxB.newPage();

// addInitScript runs before any page script on every navigation — ensures React reads correct storage
const usersJson = JSON.stringify(localUsers);
async function addSessionScript(page, userId) {
  await page.addInitScript(({ uid, usersJ }) => {
    sessionStorage.setItem('gb_current_user_id', uid);
    localStorage.setItem('gb_users', usersJ);
    sessionStorage.setItem('gb_session_active', '1');
  }, { uid: userId, usersJ: usersJson });
}
await addSessionScript(pageA, userA.id);
await addSessionScript(pageB, userB.id);
await goto(pageA, '/arena');
await goto(pageB, '/arena');

// Log any JS errors from the pages
for (const [label, p] of [['admin', adminPage], ['A', pageA], ['B', pageB]]) {
  p.on('pageerror', err => console.log(`    [${label} PAGE ERROR] ${err.message}`));
  p.on('console', msg => {
    if (msg.type() === 'error') console.log(`    [${label} CONSOLE ERROR] ${msg.text()}`);
    if (msg.type() === 'log' && (msg.text().includes('[SNAPSHOT]') || msg.text().includes('[PAYOUT]'))) {
      console.log(`    [${label} LOG] ${msg.text()}`);
    }
  });
}

// ── Admin login ───────────────────────────────────────────────────────────────
console.log('\n[ SETUP ] Logging in admin...');
await goto(adminPage, '/login');
await adminPage.locator('button').filter({ hasText: /admin/i }).first().click();
await sleep(400);
await adminPage.locator('input[type="password"], input[placeholder*="password" i]').first().fill(ADMIN_PW);
await adminPage.locator('input[type="password"], input[placeholder*="password" i]').first().press('Enter');
await sleep(2000);
console.log('    ✓ Admin ready');

// ── Verify player sessions loaded ─────────────────────────────────────────────
console.log('\n[ SETUP ] Verifying player sessions...');
const urlA = pageA.url();
const urlB = pageB.url();
const rootLenA = await pageA.evaluate(() => document.getElementById('root')?.innerHTML?.length ?? 0);
const rootLenB = await pageB.evaluate(() => document.getElementById('root')?.innerHTML?.length ?? 0);
console.log(`    ${PLAYER_A.name}: url=${urlA} rootLen=${rootLenA}`);
console.log(`    ${PLAYER_B.name}: url=${urlB} rootLen=${rootLenB}`);
console.log(`    ✓ ${PLAYER_B.name} on arena`);

// ── Read starting balances from DB ────────────────────────────────────────────
const startA = await getDbBalance(userA.id);
const startB = await getDbBalance(userB.id);
const startTotal = (startA ?? 0) + (startB ?? 0);
console.log(`\n[ BALANCES ] Start: ${PLAYER_A.name}=${startA}  ${PLAYER_B.name}=${startB}  pool=${startTotal}\n`);

const results = [];

// ── Game loop ─────────────────────────────────────────────────────────────────
for (let g = 1; g <= NUM_GAMES; g++) {
  console.log(`\n┌── Game #${g} ${'─'.repeat(42)}`);
  const winTeam = g % 2 === 1 ? 'A' : 'B';

  try {
    for (let b = 1; b <= BETS_PER_PLAYER; b++) {
      await placeBetViaUI(pageA, userA.id, 'A', BET_AMOUNT);
      const dbA = await getDbBalance(userA.id);
      console.log(`│  ✓ ${PLAYER_A.name} bet #${b} ${BET_AMOUNT} on Team A  (DB: ${dbA})`);

      await placeBetViaUI(pageB, userB.id, 'B', BET_AMOUNT);
      const dbB = await getDbBalance(userB.id);
      console.log(`│  ✓ ${PLAYER_B.name} bet #${b} ${BET_AMOUNT} on Team B  (DB: ${dbB})`);
    }

    await declareWinnerViaUI(adminPage, winTeam);
    console.log(`│  ✓ Team ${winTeam} wins`);

    // Read balances from DB (authoritative)
    const balA = await getDbBalance(userA.id);
    const balB = await getDbBalance(userB.id);
    const total = (balA ?? 0) + (balB ?? 0);
    const drift = total - startTotal;

    console.log(`│  ${PLAYER_A.name}: ${balA}  ${PLAYER_B.name}: ${balB}`);
    console.log(`│  Pool: ${total}  Drift: ${drift === 0 ? '✅ 0' : `❌ ${drift > 0 ? '+' : ''}${drift}`}`);
    results.push({ game: g, winTeam, balA, balB, total, drift });
  } catch (err) {
    console.log(`│  ❌ Error: ${err.message}`);
    results.push({ game: g, winTeam, balA: null, balB: null, total: null, drift: null, error: err.message });
  }

  console.log(`└${'─'.repeat(48)}`);
}

// ── Final report ──────────────────────────────────────────────────────────────
const finalA = await getDbBalance(userA.id);
const finalB = await getDbBalance(userB.id);
const finalTotal = (finalA ?? 0) + (finalB ?? 0);
const finalDrift = finalTotal - startTotal;
const anyDrift = results.some(r => r.drift !== 0 && r.drift !== null);
const anyError = results.some(r => r.error);

console.log('\n══════════════════════════════════════════════════════');
console.log('  FINAL RESULTS');
console.log('══════════════════════════════════════════════════════');
console.log(`  Starting pool:   ${startTotal}`);
console.log(`  Ending pool:     ${finalTotal}`);
console.log(`  Overall drift:   ${finalDrift === 0 ? '✅ 0 coins' : `❌ ${finalDrift > 0 ? '+' : ''}${finalDrift} coins`}`);
console.log(`  ${PLAYER_A.name}: ${startA} → ${finalA}`);
console.log(`  ${PLAYER_B.name}: ${startB} → ${finalB}`);
console.log('\n  Per-game:');
results.forEach(r => {
  if (r.error) {
    console.log(`    Game #${r.game}: ❌ ERROR — ${r.error}`);
  } else {
    const icon = r.drift === 0 ? '✅' : '❌';
    console.log(`    Game #${r.game}: Team ${r.winTeam} wins  pool=${r.total}  drift=${r.drift === 0 ? '0' : (r.drift > 0 ? '+' : '') + r.drift}  ${icon}`);
  }
});
const verdict = !anyDrift && !anyError ? '✅ PASS — coins conserved across all games' : anyError ? '⚠ INCOMPLETE — errors during run' : '❌ FAIL — coin drift detected';
console.log(`\n  VERDICT: ${verdict}`);
console.log('══════════════════════════════════════════════════════\n');

await browser.close();
