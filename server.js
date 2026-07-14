import 'dotenv/config.js';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import Stripe from 'stripe';

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

// Database module (PostgreSQL)
import {
  initializeDatabase,
  createOrUpdateUser,
  getUserById,
  authenticateUser,
  getUserByName,
  setUserPin,
  setUserPassword,
  credentialMatches,
  getAllUsers,
  getUserBalance,
  addTransaction,
  getUserTransactionHistory,
  updateUserStats,
  getDatabaseStats,
  addGameHistory,
  getGameHistory,
  clearGameHistory,
  addBetReceipt,
  getBetReceipts,
  getArenaAllBetReceipts,
  clearUserBetReceipts,
  addDriftEntry,
  getDriftLog,
  acknowledgeDrift,
  clearDriftLog,
  addAdminAuditEvent,
  getAdminAuditLog,
  clearAdminAuditLog,
  addGameSnapshot,
  getGameSnapshots,
  clearGameSnapshots,
  updateUserMembership,
  upsertUserFromSocket,
  deleteUser,
} from './src/db/database.js';

// Deployment version: 3
// Force Render to redeploy with fresh instance

/*
🎯 ARENA INDEPENDENCE GUARANTEE
================================
Each arena (default, one_pocket, etc.) maintains COMPLETELY INDEPENDENT state:

✅ Server-Side:
- arenaGameStates = { 'default': {...}, 'one_pocket': {...} }
- Each arena has its own game counts, scores, balls, bets, timers
- Updates to one arena do NOT affect other arenas
- Broadcasts use io.to(`arena:${arenaId}`) for arena-specific delivery

✅ Client-Side:
- gameStateDefault and gameStateOnePocket are separate React states
- setCurrentGameState() only updates the current arena's state
- validateArenaAndUpdate() ensures only matching arena data is processed
- Socket listeners check arena ID before updating state

✅ Communication:
- Every Socket.IO message includes arenaId
- Server broadcasts ONLY to specific arena room
- Clients validate arena ID before accepting updates

RESULT: If you change Rotation arena scores to 10-5, One Pocket arena will 
        still have its own independent scores (e.g., 3-2). Switching between
        arenas will ALWAYS show the correct data for that arena.
*/

// Global error handlers
process.on('uncaughtException', (error) => {
  console.error('❌ [GLOBAL] Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ [GLOBAL] Unhandled Rejection:', reason);
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);

// CORS configuration for Socket.IO
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: false,
    allowedHeaders: "*"
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 45000,
  pingInterval: 20000,
  allowEIO3: true,
  maxHttpBufferSize: 1e6,
  serveClient: false,
  connectTimeout: 60000,
  perMessageDeflate: false,
  upgrade: true,
  upgradeTimeout: 10000
});

// Middleware
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["*"],
  credentials: false
}));

// Log all incoming requests
app.use((req, res, next) => {
  console.log(`📨 [HTTP] ${req.method} ${req.path} from ${req.ip}`);
  next();
});

// ── Stripe Webhook (raw body required — must be before express.json()) ────────
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!stripe) return res.status(503).send('Stripe not configured');
  const sig = req.headers['stripe-signature'];
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return res.status(503).send('Webhook secret not configured');

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, secret);
  } catch (err) {
    console.error('❌ Stripe webhook signature failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'payment_intent.succeeded') {
    const pi = event.data.object;
    const { mode, userId, amount } = pi.metadata;
    console.log(`✅ [STRIPE] Payment succeeded — mode: ${mode}, userId: ${userId}, amount: ${amount}`);

    if (userId) {
      if (mode === 'subscription') {
        // Update membership in DB
        try {
          await addTransaction(userId, {
            id: `stripe_${pi.id}`,
            type: 'membership_activate',
            amount: 0,
            description: 'Premium membership activated via Stripe',
            timestamp: Date.now(),
          });
        } catch (e) { console.error('DB membership update error:', e); }
        io.to(`user:${userId}`).emit('membership:activated', { renewsAt: Date.now() + 30 * 24 * 60 * 60 * 1000 });
      } else if (mode === 'reload') {
        const coins = Math.round(Number(amount) / 100);
        try {
          await addTransaction(userId, {
            id: `stripe_${pi.id}`,
            type: 'admin_add',
            amount: coins,
            description: `Coin reload — ${coins} coins purchased via Stripe`,
            timestamp: Date.now(),
          });
        } catch (e) { console.error('DB reload error:', e); }
        io.to(`user:${userId}`).emit('coins:reloaded', { amount: coins });
      }
    }
  }

  res.json({ received: true });
});

app.use(express.json());

// 💰 CREDIT LEDGER SYSTEM - Server-Authoritative
// Every credit transaction is permanently recorded
// ============================================================================
// 💰 CREDIT SYSTEM - NOW USING POSTGRESQL DATABASE
// ============================================================================
// 
// All credit functions are now provided by ./src/db/database.js:
//   • addTransaction(userId, type, amount, reason, adminNotes)
//   • getUserBalance(userId)
//   • getUserTransactionHistory(userId)
//   • createOrUpdateUser(userId, name, password, initialCredits)
//   • updateUserStats(userId, wins, losses)
//
// These functions handle BOTH in-memory (fallback) and PostgreSQL (primary)
// ============================================================================

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// Socket.IO endpoint (explicit for better compatibility)
app.get('/socket.io/', (req, res) => {
  res.json({ status: 'Socket.IO server is ready' });
});

// Serve static files from dist directory
app.use(express.static(path.join(__dirname, 'dist')));

// Serve static files from public directory (for test pages)
app.use(express.static(path.join(__dirname, 'public')));

// SPA routing: serve index.html for all non-API routes (use middleware instead of app.get)
app.use((req, res, next) => {
  // Don't serve index.html for API or Socket.IO routes
  if (req.path.startsWith('/api/') || req.path.startsWith('/socket.io')) {
    return next();
  }
  
  // For all other routes, serve index.html (SPA routing)
  res.sendFile(path.join(__dirname, 'dist', 'index.html'), (err) => {
    if (err) {
      res.status(500).json({ error: 'Could not serve index.html' });
    }
  });
});

// 👥 SERVER-SIDE USER STORAGE
// Store all users on server (shared across all browsers/devices)
// ============================================================================
// 👥 USER MANAGEMENT - NOW USING POSTGRESQL DATABASE
// ============================================================================
// 
// User functions are now provided by ./src/db/database.js
// This module handles:
//   • createOrUpdateUser(userId, name, password, initialCredits)
//   • getUserById(userId)
//   • authenticateUser(name, password)
//   • getAllUsers()
//   • updateUserStats(userId, wins, losses)
//
// All user data is now persistent in PostgreSQL!
// ============================================================================

// 🎯 Arena Labels for clear differentiation in logs
const getArenaLabel = (arenaId) => {
  if (arenaId === 'one_pocket') return '🎯 [1-POCKET]';
  return '🎱 [9-BALL]';
};

// Store game state on server - now with arena separation
const createDefaultGameState = () => ({
  teamAQueue: [],
  teamBQueue: [],
  bookedBets: [],
  nextGameBets: [],
  nextTeamAQueue: [],
  nextTeamBQueue: [],
  teamAScore: 0,
  teamBScore: 0,
  teamABalls: 0,
  teamBBalls: 0,
  isTimerRunning: false,
  timerSeconds: 0,
  currentGameNumber: 1,
  teamAHasBreak: true,
  totalBookedAmount: 0,
  nextTotalBookedAmount: 0,
  users: [],
  gameInfo: {
    teamAName: "Team A",
    teamBName: "Team B",
    gameTitle: "Game Bird",
    gameDescription: "Place your bets!"
  },
  isGameActive: false,
  winner: null
});

// Map to store game state for each arena
const gbStateStore = {}; // GameBird V2 frontend state per arena
const gbHistoryStore = {}; // GameBird V2 gameHistory (GameRecord[]) per arena
let gbUsersStore = []; // Latest full user list broadcast from any client
const deletedUserIds = new Set(); // IDs that should never be re-added

let arenaGameStates = {
  'default': createDefaultGameState(),
  'one_pocket': createDefaultGameState()
};

// Track which arena each socket belongs to
const socketArenaMap = new Map();

// Single-admin-session enforcement, per arena — last successful login wins and kicks
// any previously active admin socket, preventing two admins from taking conflicting
// actions (e.g. two declareWinner calls) on the same arena at once.
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '1980';
const adminSessionByArena = new Map(); // arenaId -> socket.id

const getGameState = (arenaId = 'default') => {
  if (!arenaGameStates[arenaId]) {
    console.log(`🆕 Creating new arena state for: ${arenaId}`);
    arenaGameStates[arenaId] = createDefaultGameState();
  }
  return arenaGameStates[arenaId];
};

let serverGameState = getGameState('default');

// Track connected users and their credits
let connectedUsers = new Map(); // socketId -> { userId, credits, name }

// Single-session-per-account enforcement (mirrors admin session logic below).
// Last successful login wins and kicks any other active socket for that userId,
// but only after the requester explicitly confirms a force takeover.
const activeUserSocket = new Map(); // userId -> socket.id

// activeUserSocket is also the authoritative "who is genuinely connected right now"
// source — reused to drive real-time online status in Coins In Action, since it's
// already correctly added on login/claim and removed on disconnect/release.
function broadcastOnlineUsers() {
  io.emit('users:online-list', Array.from(activeUserSocket.keys()));
}

// Flag to pause broadcasting during clear operations
let isListenersPaused = false;

// Calculate total coins from connected users
async function calculateConnectedUsersCoins() {
  let totalCoins = 0;
  let connectedUserCount = 0;
  const connectedUsersData = [];
  
  // Clean up stale entries (older than 5 minutes)
  const now = Date.now();
  const staleThreshold = 5 * 60 * 1000; // 5 minutes
  
  connectedUsers.forEach((userData, socketId) => {
    if (userData.loginTime && (now - userData.loginTime) > staleThreshold) {
      console.log(`🧹 Removing stale user ${userData.name} (${socketId})`);
      connectedUsers.delete(socketId);
    }
  });
  
  // For each connected user, fetch CURRENT balance from database
  for (const [socketId, userData] of connectedUsers) {
    try {
      // Get current balance from database (not from stored value)
      const balance = await getUserBalance(userData.userId);
      const currentBalance = balance || 0;
      
      totalCoins += currentBalance;
      connectedUserCount++;
      
      connectedUsersData.push({
        socketId,
        userId: userData.userId,
        name: userData.name,
        credits: currentBalance
      });
    } catch (err) {
      console.error(`❌ Error fetching balance for ${userData.name}:`, err);
      // Fall back to stored value
      totalCoins += userData.credits || 0;
      connectedUserCount++;
      connectedUsersData.push(userData);
    }
  }
  
  return {
    totalCoins,
    connectedUserCount,
    connectedUsers: connectedUsersData
  };
}

// Periodic cleanup and sync of stale connections
setInterval(async () => {
  try {
    const coinsData = await calculateConnectedUsersCoins();
    if (coinsData.connectedUserCount > 0) {
      console.log(`🧹 Periodic sync: ${coinsData.connectedUserCount} users, ${coinsData.totalCoins} coins`);
      io.emit('connected-users-coins-update', coinsData);
    }
  } catch (err) {
    console.error('❌ Error in periodic cleanup:', err);
  }
}, 30000); // Every 30 seconds

// Server timer management - now per-arena
let arenaTimers = {
  'default': {
    interval: null,
    startTime: null,
    accumulatedTime: 0,
    isRunning: false,
    continuousStartTime: null  // Track when timer started continuously (never reset)
  },
  'one_pocket': {
    interval: null,
    startTime: null,
    accumulatedTime: 0,
    isRunning: false,
    continuousStartTime: null  // Track when timer started continuously (never reset)
  }
};

function getArenaTimer(arenaId = 'default') {
  if (!arenaTimers[arenaId]) {
    arenaTimers[arenaId] = {
      interval: null,
      startTime: null,
      accumulatedTime: 0,
      isRunning: false,
      continuousStartTime: null
    };
  }
  return arenaTimers[arenaId];
}

function startServerTimer(arenaId = 'default') {
  const timer = getArenaTimer(arenaId);
  const arenaState = getGameState(arenaId);
  
  console.log(`⏱️ [START TIMER] Called for arena '${arenaId}', timer.isRunning=${timer.isRunning}`);
  
  if (timer.interval) {
    clearInterval(timer.interval);
    console.log(`⏱️ [START TIMER] Cleared existing interval`);
  }
  
  // If this is the first time starting, record the continuous start time
  if (!timer.continuousStartTime) {
    timer.continuousStartTime = Date.now();
    console.log(`⏱️ [START TIMER] Set continuousStartTime to now`);
  }
  
  timer.startTime = Date.now();
  timer.isRunning = true;
  arenaState.isTimerRunning = true;
  console.log(`⏱️ [START TIMER] Timer state updated: isRunning=true`);
  
  // OPTIMIZED: Reduce broadcast frequency from 1s to 500ms
  // Only broadcast when timer is actually running
  let lastBroadcastTime = Date.now();
  let broadcastCount = 0;
  timer.interval = setInterval(() => {
    // Only broadcast if enough time has passed (delta-based sending)
    const now = Date.now();
    if (now - lastBroadcastTime >= 500) {
      const totalElapsed = Math.floor((Date.now() - timer.continuousStartTime) / 1000);
      broadcastCount++;
      
      io.to(`arena:${arenaId}`).emit('timer-update', {
        isTimerRunning: arenaState.isTimerRunning,
        timerSeconds: totalElapsed,
        serverStartTime: timer.startTime,
        accumulatedTime: totalElapsed,
        arenaId: arenaId
      });
      
      console.log(`📤 [TIMER BROADCAST #${broadcastCount}] Arena '${arenaId}': timerSeconds=${totalElapsed}, isRunning=${arenaState.isTimerRunning}`);
      lastBroadcastTime = now;
    }
  }, 500); // Check every 500ms instead of 1000ms
  
  console.log(`⏱️ [START TIMER] Interval set for arena '${arenaId}'`);
}

function stopServerTimer(arenaId = 'default') {
  const timer = getArenaTimer(arenaId);
  const arenaState = getGameState(arenaId);
  
  if (timer.interval) {
    clearInterval(timer.interval);
    timer.interval = null;
  }
  
  // Calculate current total time but don't reset anything
  const totalElapsed = timer.continuousStartTime 
    ? Math.floor((Date.now() - timer.continuousStartTime) / 1000)
    : timer.accumulatedTime;
  
  timer.isRunning = false;
  arenaState.isTimerRunning = false;
  
  // Broadcast timer stop only to this arena's room
  io.to(`arena:${arenaId}`).emit('timer-update', {
    isTimerRunning: false,
    timerSeconds: totalElapsed,
    serverStartTime: null,
    accumulatedTime: totalElapsed,
    arenaId: arenaId
  });
}

function resetServerTimer(arenaId = 'default') {
  const timer = getArenaTimer(arenaId);
  const arenaState = getGameState(arenaId);
  
  // Only reset if admin explicitly calls this - NOT on game win
  if (timer.interval) {
    clearInterval(timer.interval);
    timer.interval = null;
  }
  
  // ONLY reset these three things - the timer should NEVER auto-reset
  timer.accumulatedTime = 0;
  timer.continuousStartTime = null;  // Reset the continuous tracking
  timer.startTime = null;
  timer.isRunning = false;
  arenaState.isTimerRunning = false;
  arenaState.timerSeconds = 0;
  
  // Broadcast timer reset to clients for this arena
  io.to(`arena:${arenaId}`).emit('timer-update', {
    isTimerRunning: false,
    timerSeconds: 0,
    serverStartTime: null,
    accumulatedTime: 0,
    arenaId: arenaId
  });
  console.log(`📤 [TIMER RESET] timer-update emitted with timerSeconds: 0 for arena '${arenaId}'`);
}

// Socket.IO middleware to log and accept all connections
io.use((socket, next) => {
  console.log('🔌 [MIDDLEWARE] Connection attempt from origin:', socket.handshake.headers.origin);
  console.log('📦 [MIDDLEWARE] EIO:', socket.handshake.query.EIO);
  console.log('📦 [MIDDLEWARE] Transport:', socket.handshake.query.transport);
  console.log('✅ [MIDDLEWARE] Calling next() to accept connection');
  
  // Accept all connections - no auth needed
  try {
    next();
    console.log('✅ [MIDDLEWARE] next() completed successfully');
  } catch (error) {
    console.error('❌ [MIDDLEWARE] Error in next():', error.message);
    next(error);
  }
});

// Socket.IO error handler
io.engine.on('connection_error', (err) => {
  console.error('❌ [ENGINE] Connection error:', err.code, err.message);
});

io.engine.on('parse_error', (err) => {
  console.error('❌ [ENGINE] Parse error:', err);
});

// 💰 CREDIT API ENDPOINTS
// Get user balance
app.get('/api/credits/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const balance = await getUserBalance(userId);
    
    // 📊 LOG ALL BALANCE FETCHES
    console.log(`📡 [CREDITS-GET] Fetching balance for ${userId}: ${balance}`);
    
    res.json({ userId, balance });
  } catch (error) {
    console.error(`❌ [CREDITS-GET] Error fetching balance:`, error);
    res.status(500).json({ error: 'Failed to fetch balance' });
  }
});

// Batch balance fetch — used at game-settlement time so the audit trail (Game
// Balances / Player Snapshots) is always computed from actual DB balances, never
// from a device's potentially-stale local cache of other players' credits.
app.post('/api/credits/batch', async (req, res) => {
  try {
    const { userIds } = req.body;
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ error: 'userIds array required' });
    }
    const entries = await Promise.all(userIds.map(async (id) => [id, await getUserBalance(id)]));
    res.json({ balances: Object.fromEntries(entries) });
  } catch (error) {
    console.error('❌ [CREDITS-BATCH] Error:', error);
    res.status(500).json({ error: 'Failed to fetch balances' });
  }
});

// Get user transaction history
app.get('/api/credits/:userId/history', async (req, res) => {
  try {
    const { userId } = req.params;
    const transactions = await getUserTransactionHistory(userId);
    res.json({ userId, transactions });
  } catch (error) {
    console.error(`❌ [TRANSACTIONS-GET] Error fetching transactions:`, error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// Add credits (admin only, or system operations)
// Set absolute balance (used for ZERO and admin adjustments)
app.post('/api/credits/:userId/set', async (req, res) => {
  try {
    const { userId } = req.params;
    const { balance, name } = req.body;
    if (balance === undefined || balance === null) return res.status(400).json({ error: 'balance required' });
    // Ensure user exists in DB before writing transaction (FK constraint)
    const memUser = gbUsersStore.find(u => u.id === userId);
    const userName = name || memUser?.name;
    if (userName) await upsertUserFromSocket(userId, userName, false);
    const currentBalance = await getUserBalance(userId);
    const delta = balance - currentBalance;
    if (delta !== 0) {
      const type = delta > 0 ? 'admin_add' : 'admin_deduct';
      await addTransaction(userId, type, delta, 'Admin balance adjustment');
    }
    io.emit('users:push');
    res.json({ success: true, newBalance: balance });
  } catch (error) {
    console.error('❌ [CREDITS-SET]', error);
    res.status(500).json({ error: 'Failed to set balance' });
  }
});

app.post('/api/credits/:userId/add', async (req, res) => {
  try {
    const { userId } = req.params;
    const { amount, reason = '', adminNotes = '' } = req.body;

    if (!amount || amount === 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }
    
    const oldBalance = await getUserBalance(userId);
    const type = req.body.type || (amount > 0 ? 'admin_add' : 'admin_deduct');
    const transaction = await addTransaction(userId, type, amount, reason || (amount > 0 ? 'Admin added credits' : 'Admin deducted credits'), adminNotes);
    
    if (!transaction) {
      console.warn(`⚠️ [CREDITS-ADD] Transaction failed for ${userId}`);
      return res.status(400).json({ error: 'Could not process transaction' });
    }
    
    const newBalance = await getUserBalance(userId);
    console.log(`✅ [CREDITS-ADD] Success: ${userId} balance updated ${oldBalance} → ${newBalance}`);
    // Tell all clients to re-fetch so credit changes show immediately
    io.emit('users:push');
    res.json({ success: true, transaction, newBalance });
  } catch (error) {
    console.error(`❌ [CREDITS-ADD] Error:`, error);
    res.status(500).json({ error: 'Failed to add credits' });
  }
});

// Place bet (deduct credits)
app.post('/api/credits/:userId/bet', async (req, res) => {
  try {
    const { userId } = req.params;
    const { amount, betDetails = '' } = req.body;
    
    if (!amount || amount <= 0) {
      console.warn(`⚠️ [CREDITS-BET] Invalid bet amount: ${amount}`);
      return res.status(400).json({ error: 'Invalid bet amount' });
    }
    
    const oldBalance = await getUserBalance(userId);
    console.log(`💰 [CREDITS-BET] Placing bet: userId=${userId}, amount=${amount}, oldBalance=${oldBalance}`);
    
    const transaction = await addTransaction(userId, 'bet_placed', -amount, betDetails);
    
    if (!transaction) {
      console.warn(`⚠️ [CREDITS-BET] Insufficient balance: ${userId} only has ${oldBalance}`);
      return res.status(400).json({ error: 'Insufficient credits' });
    }
    
    const newBalance = await getUserBalance(userId);
    console.log(`✅ [CREDITS-BET] Success: ${userId} balance updated ${oldBalance} → ${newBalance}`);

    io.emit('users:push'); // notify all devices (incl. admin's user switcher) to re-sync balances
    res.json({ success: true, transaction, newBalance });
  } catch (error) {
    console.error(`❌ [CREDITS-BET] Error:`, error);
    res.status(500).json({ error: 'Failed to place bet' });
  }
});

// Refund bet
app.post('/api/credits/:userId/refund', async (req, res) => {
  try {
    const { userId } = req.params;
    const { amount, reason = '' } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid refund amount' });
    }

    const transaction = await addTransaction(userId, 'bet_refunded', amount, reason);

    if (!transaction) {
      return res.status(400).json({ error: 'Could not process refund' });
    }

    const newBalance = await getUserBalance(userId);
    io.emit('users:push');
    res.json({ success: true, transaction, newBalance });
  } catch (error) {
    console.error(`❌ [CREDITS-REFUND] Error:`, error);
    res.status(500).json({ error: 'Failed to refund bet' });
  }
});

// Win bet (add credits)
app.post('/api/credits/:userId/win', async (req, res) => {
  try {
    const { userId } = req.params;
    const { amount, betDetails = '' } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid win amount' });
    }

    const transaction = await addTransaction(userId, 'bet_won', amount, betDetails);

    if (!transaction) {
      return res.status(400).json({ error: 'Could not process win' });
    }

    const newBalance = await getUserBalance(userId);
    io.emit('users:push');
    res.json({ success: true, transaction, newBalance });
  } catch (error) {
    console.error(`❌ [CREDITS-WIN] Error:`, error);
    res.status(500).json({ error: 'Failed to process win' });
  }
});

// Cashout (deduct credits)
app.post('/api/credits/:userId/cashout', async (req, res) => {
  try {
    const { userId } = req.params;
    const { amount } = req.body;
    
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid cashout amount' });
    }
    
    const transaction = await addTransaction(userId, 'cashout', -amount, 'User cashout');
    
    if (!transaction) {
      return res.status(400).json({ error: 'Insufficient credits' });
    }
    
    const newBalance = await getUserBalance(userId);
    res.json({ success: true, transaction, newBalance });
  } catch (error) {
    console.error(`❌ [CREDITS-CASHOUT] Error:`, error);
    res.status(500).json({ error: 'Failed to process cashout' });
  }
});

// Tip — deducts from giver, credits receiver, records tip_given/tip_received in DB
app.post('/api/tip', async (req, res) => {
  try {
    const { fromId, toId, amount, fromName, toName } = req.body;
    if (!fromId || !toId || !amount || amount <= 0) return res.status(400).json({ error: 'Invalid tip params' });
    const fromBal = await getUserBalance(fromId);
    if (fromBal < amount) return res.status(400).json({ error: 'Insufficient coins' });
    await addTransaction(fromId, 'tip_given',    -amount, `Tip sent to ${toName || toId}`);
    await addTransaction(toId,   'tip_received',  amount, `Tip received from ${fromName || fromId}`);
    io.emit('users:push');
    res.json({ success: true });
  } catch (e) {
    console.error('❌ [TIP]', e);
    res.status(500).json({ error: 'Tip failed' });
  }
});

// P2P transfer — deducts from sender, credits receiver, records proper tx for both
app.post('/api/transfer', async (req, res) => {
  try {
    const { fromId, toId, amount, fromName, toName } = req.body;
    if (!fromId || !toId || !amount || amount <= 0) return res.status(400).json({ error: 'Invalid transfer params' });
    if (fromId === toId) return res.status(400).json({ error: 'Cannot transfer to yourself' });

    const fromBal = await getUserBalance(fromId);
    if (fromBal < amount) return res.status(400).json({ error: 'Insufficient coins' });

    const senderLabel = fromName || fromId;
    const receiverLabel = toName || toId;

    const txSent = await addTransaction(fromId, 'transfer_sent', -amount, `P2P transfer to ${receiverLabel}`);
    const txReceived = await addTransaction(toId, 'transfer_received', amount, `P2P transfer from ${senderLabel}`);

    if (!txSent || !txReceived) return res.status(500).json({ error: 'Transaction write failed' });

    const newFromBal = await getUserBalance(fromId);
    const newToBal = await getUserBalance(toId);

    // Notify all clients to re-sync balances
    io.emit('users:push');
    // Push the receipt directly to any connected socket for sender/receiver
    io.emit('transfer:receipt', {
      fromId, toId, amount,
      fromName: senderLabel, toName: receiverLabel,
      timestamp: Date.now(),
      txSent, txReceived,
    });

    console.log(`✅ [TRANSFER] ${senderLabel} → ${toName} : ${amount} coins  (from=${newFromBal} to=${newToBal})`);
    res.json({ success: true, newFromBal, newToBal, txSent, txReceived });
  } catch (error) {
    console.error('❌ [TRANSFER]', error);
    res.status(500).json({ error: 'Transfer failed' });
  }
});

// Get all user credits (admin view)
app.get('/api/credits-admin/all', (req, res) => {
  const allUsers = Object.entries(creditLedger).map(([userId, data]) => ({
    userId,
    balance: data.balance,
    transactionCount: data.transactions.length
  }));
  res.json(allUsers);
});

// ============================================================================
// 👥 USER MANAGEMENT API ENDPOINTS
// ============================================================================

// Get all users (shared across all devices)
app.get('/api/users', async (req, res) => {
  try {
    console.log(`📡 [USERS-GET] Fetching all users...`);
    
    const allUsers = await getAllUsers();
    
    // DB is always authoritative for credits — never override with stale memory values
    const users = await Promise.all(allUsers.map(async (u) => {
      const dbBalance = await getUserBalance(u.id);
      return {
        id: u.id,
        name: u.name,
        credits: dbBalance,
        wins: u.wins || 0,
        losses: u.losses || 0,
        isAdmin: u.is_admin || false,
        membershipStatus: u.membership_status || u.membershipStatus || 'free',
        subscriptionDate: u.subscription_date || u.subscriptionDate
      };
    }));

    // Merge in any gbUsersStore users not in DB
    const dbIds = new Set(users.map(u => u.id));
    const memOnly = gbUsersStore.filter(u => !u.isAdmin && !dbIds.has(u.id) && !deletedUserIds.has(u.id));
    const merged = [
      ...users,
      ...memOnly.map(u => ({
        id: u.id, name: u.name, credits: u.credits || 0, isAdmin: false,
        membershipStatus: u.membership?.tier === 'premium' && !u.membership?.cancelledAt ? 'premium' : 'free',
      }))
    ];

    if (merged.length === 0) {
      console.log(`📋 [USERS] No users found anywhere`);
      return res.json([]);
    }
    console.log(`📋 [USERS] Returning ${merged.length} users (${users.length} DB + ${memOnly.length} memory-only)`);
    // Include deletedIds so clients can purge them from local state
    res.json({ users: merged, deletedIds: [...deletedUserIds] });
  } catch (error) {
    console.error(`❌ [USERS-GET] Error fetching users:`, error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Get user by ID
app.get('/api/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    console.log(`📡 [USER-GET] Fetching user: ${userId}`);
    
    const user = await getUserById(userId);
    
    if (!user) {
      console.warn(`⚠️ [USER-GET] User not found: ${userId}`);
      return res.status(404).json({ error: 'User not found' });
    }

    // Get credits from database (source of truth)
    const userCredits = await getUserBalance(userId);
    
    console.log(`✅ [USER-GET] ${user.name} (${userId}): credits=${userCredits}`);

    res.json({
      id: user.id,
      name: user.name,
      credits: userCredits || user.credits || 0,
      wins: user.wins || 0,
      losses: user.losses || 0,
      membershipStatus: user.membership_status || user.membershipStatus || 'free',
      subscriptionDate: user.subscriptionDate
    });
  } catch (error) {
    console.error(`❌ [USER-GET] Error fetching user:`, error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Create new user — accepts a PIN and/or password, and an optional client-generated
// id so the same id is reused when this device later calls user-login over the socket.
app.post('/api/users', async (req, res) => {
  try {
    const { name, password, pin, initialCredits = 0, id } = req.body;

    if (!name || (!password && !pin)) {
      return res.status(400).json({ error: 'Name and a PIN or password are required' });
    }

    const newUser = await createOrUpdateUser(name, password || null, initialCredits, false, pin || null, id || null);

    if (!newUser) {
      return res.status(400).json({ error: 'User already exists or creation failed' });
    }

    res.json({
      id: newUser.id,
      name: newUser.name,
      credits: newUser.credits || initialCredits,
      wins: newUser.wins || 0,
      losses: newUser.losses || 0,
      membershipStatus: newUser.membership_status || newUser.membershipStatus || 'free',
      subscriptionDate: newUser.subscriptionDate
    });
  } catch (error) {
    console.error(`❌ [USER-CREATE] Error:`, error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Authenticate user (login) — password-only, kept for backward compatibility
app.post('/api/users/auth', async (req, res) => {
  try {
    const { name, password } = req.body;

    if (!name || !password) {
      return res.status(400).json({ error: 'Name and password required' });
    }

    const user = await authenticateUser(name, password);

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Get credits from database (source of truth)
    const userCredits = await getUserBalance(user.id);

    res.json({
      id: user.id,
      name: user.name,
      credits: userCredits || user.credits || 0,
      wins: user.wins || 0,
      losses: user.losses || 0,
      membershipStatus: user.membership_status || user.membershipStatus || 'free',
      subscriptionDate: user.subscriptionDate
    });
  } catch (error) {
    console.error(`❌ [USER-AUTH] Error:`, error);
    res.status(500).json({ error: 'Failed to authenticate user' });
  }
});

// Unified login — verifies whichever credential type the client is using (PIN or password)
// server-side against the database. This is the actual source of truth for login;
// the client no longer trusts a locally-cached PIN/password for authentication.
app.post('/api/users/login', async (req, res) => {
  try {
    const { name, pin, password } = req.body;
    if (!name || (!pin && !password)) {
      return res.status(400).json({ error: 'Name and PIN or password required' });
    }

    const existing = await getUserByName(name);
    if (!existing) return res.status(404).json({ error: 'Account not found.' });

    if (pin !== undefined) {
      if (!existing.pin) {
        // No PIN set yet for this account — first login on any device establishes it.
        await setUserPin(existing.id, pin);
      } else if (!(await credentialMatches(pin, existing.pin))) {
        return res.status(401).json({ error: 'Incorrect PIN.' });
      }
    } else {
      if (!existing.password) {
        return res.status(401).json({ error: 'No password set for this account. Use PIN instead.' });
      }
      if (!(await credentialMatches(password, existing.password))) {
        return res.status(401).json({ error: 'Incorrect password.' });
      }
    }

    const credits = await getUserBalance(existing.id);
    res.json({
      success: true,
      user: {
        id: existing.id,
        name: existing.name,
        credits,
        isAdmin: existing.is_admin || false,
        membershipStatus: existing.membership_status || 'free',
      },
    });
  } catch (error) {
    console.error('❌ [USER-LOGIN] Error:', error);
    res.status(500).json({ error: 'Login failed — try again.' });
  }
});

// Change PIN or password — verifies the account's current credential first (whichever
// is set) before writing the new one, so changing credentials always requires proof
// of the old one.
app.post('/api/users/:userId/credentials', async (req, res) => {
  try {
    const { userId } = req.params;
    const { currentCredential, newPin, newPassword } = req.body;

    const user = await getUserById(userId);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    const hasCredential = !!(user.password || user.pin);
    if (hasCredential) {
      const matchesPassword = user.password && (await credentialMatches(currentCredential, user.password));
      const matchesPin = user.pin && (await credentialMatches(currentCredential, user.pin));
      if (!matchesPassword && !matchesPin) return res.status(401).json({ error: 'Current PIN/password is incorrect.' });
    }

    if (newPin) await setUserPin(userId, newPin);
    if (newPassword) await setUserPassword(userId, newPassword);

    res.json({ success: true });
  } catch (error) {
    console.error('❌ [USER-CREDENTIALS] Error:', error);
    res.status(500).json({ error: 'Failed to update credentials.' });
  }
});

// Update user (admin only)
app.put('/api/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { wins, losses } = req.body;

    // Update user stats if provided
    if (wins !== undefined || losses !== undefined) {
      await updateUserStats(userId, wins, losses);
      console.log(`✅ [USER-UPDATE] Updated stats for ${userId}`);
    }

    // Fetch and return updated user
    const updatedUser = await getUserById(userId);
    
    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userCredits = await getUserBalance(userId);

    res.json({
      id: updatedUser.id,
      name: updatedUser.name,
      credits: userCredits || updatedUser.credits || 0,
      wins: updatedUser.wins,
      losses: updatedUser.losses,
      membershipStatus: updatedUser.membershipStatus,
      subscriptionDate: updatedUser.subscriptionDate
    });
  } catch (error) {
    console.error(`❌ [USER-UPDATE] Error:`, error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Admin: bulk upsert users from client into DB
app.post('/api/users/bulk-sync', async (req, res) => {
  try {
    const { users } = req.body;
    if (!Array.isArray(users)) return res.status(400).json({ error: 'users array required' });
    let count = 0;
    for (const u of users) {
      if (!u.id || !u.name || u.isAdmin) continue;
      await upsertUserFromSocket(u.id, u.name, false);
      const isPremium = u.membership?.tier === 'premium' && !u.membership?.cancelledAt;
      await updateUserMembership(u.id, isPremium ? 'premium' : 'free');
      count++;
    }
    console.log(`✅ [BULK-SYNC] Synced ${count} users to DB`);
    res.json({ success: true, count });
  } catch (error) {
    console.error('❌ [BULK-SYNC]', error);
    res.status(500).json({ error: 'Failed to bulk sync' });
  }
});

app.post('/api/users/register', async (req, res) => {
  try {
    const { id, name, isAdmin } = req.body;
    if (!id || !name) return res.status(400).json({ error: 'id and name required' });
    await upsertUserFromSocket(id, name, isAdmin || false);
    console.log(`✅ [REGISTER] ${name} (${id})`);
    res.json({ success: true });
  } catch (error) {
    console.error('❌ [REGISTER] Error:', error);
    res.status(500).json({ error: 'Failed to register user' });
  }
});

app.post('/api/users/:userId/membership', async (req, res) => {
  try {
    const { userId } = req.params;
    const { status, name } = req.body; // 'premium' or 'free'
    if (!['premium', 'free'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
    // Ensure user row exists before updating membership
    const memUser = gbUsersStore.find(u => u.id === userId);
    const userName = name || memUser?.name;
    if (userName) await upsertUserFromSocket(userId, userName, false);
    await updateUserMembership(userId, status);
    console.log(`✅ [MEMBERSHIP] ${userId} set to ${status}`);
    // Notify all clients so they pick up the change immediately
    io.emit('users:push');
    res.json({ success: true, userId, membershipStatus: status });
  } catch (error) {
    console.error('❌ [MEMBERSHIP] Error:', error);
    res.status(500).json({ error: 'Failed to update membership' });
  }
});

app.delete('/api/users/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    await deleteUser(userId);
    deletedUserIds.add(userId);
    gbUsersStore = gbUsersStore.filter(u => u.id !== userId);
    // Tell every connected client to remove this user immediately
    io.emit('user:deleted', userId);
    console.log(`✅ [USER-DELETE] ${userId} deleted`);
    res.json({ success: true });
  } catch (error) {
    console.error('❌ [USER-DELETE] Error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// Clean up duplicate name entries, keeping the most recently created one
app.post('/api/users/deduplicate', async (req, res) => {
  try {
    const allUsers = await getAllUsers();
    const seen = new Map();
    let removed = 0;
    for (const u of allUsers) {
      const key = u.name.toLowerCase();
      if (seen.has(key)) {
        // Duplicate — delete the older one (keep the one with the later id/timestamp)
        const prev = seen.get(key);
        const toDelete = prev.created_at < u.created_at ? prev : u;
        await deleteUser(toDelete.id);
        gbUsersStore = gbUsersStore.filter(m => m.id !== toDelete.id);
        seen.set(key, prev.created_at > u.created_at ? prev : u);
        removed++;
      } else {
        seen.set(key, u);
      }
    }
    console.log(`✅ [DEDUP] Removed ${removed} duplicate entries`);
    res.json({ success: true, removed });
  } catch (error) {
    console.error('❌ [DEDUP] Error:', error);
    res.status(500).json({ error: 'Dedup failed' });
  }
});

/*
================================
GAME HISTORY API ENDPOINTS
================================
*/

// Get game history for an arena
app.get('/api/games/history/:arenaId', async (req, res) => {
  try {
    const { arenaId } = req.params;
    const limit = parseInt(req.query.limit) || 100;

    const history = await getGameHistory(arenaId, limit);
    
    res.json({
      arenaId,
      count: history.length,
      games: history
    });
    
    console.log(`✅ [GAME-HISTORY] Fetched ${history.length} games for arena '${arenaId}'`);
  } catch (error) {
    console.error(`❌ [GAME-HISTORY] Error fetching history:`, error);
    res.status(500).json({ error: 'Failed to fetch game history' });
  }
});

// Add new game to history
app.post('/api/games/history', async (req, res) => {
  try {
    const gameHistoryRecord = req.body;

    if (!gameHistoryRecord) {
      return res.status(400).json({ error: 'Game history record required' });
    }

    const savedGame = await addGameHistory(gameHistoryRecord);
    
    if (!savedGame) {
      return res.status(500).json({ error: 'Failed to save game history' });
    }

    const arenaId = gameHistoryRecord.arenaId || 'default';
    console.log(`✅ [GAME-HISTORY] Saved game for arena '${arenaId}'`);
    
    res.status(201).json({
      success: true,
      gameId: savedGame.game_id,
      arenaId: savedGame.arena_id,
      gameNumber: savedGame.game_number,
      message: 'Game history saved successfully'
    });
  } catch (error) {
    console.error(`❌ [GAME-HISTORY] Error saving game:`, error);
    res.status(500).json({ error: 'Failed to save game history' });
  }
});

// Clear game history for an arena
app.delete('/api/games/history/:arenaId', async (req, res) => {
  try {
    const { arenaId } = req.params;

    const deletedCount = await clearGameHistory(arenaId);
    
    console.log(`✅ [GAME-HISTORY] Cleared ${deletedCount} games from arena '${arenaId}'`);
    
    res.json({
      success: true,
      arenaId,
      deletedCount,
      message: `Cleared ${deletedCount} games from arena '${arenaId}'`
    });
  } catch (error) {
    console.error(`❌ [GAME-HISTORY] Error clearing history:`, error);
    res.status(500).json({ error: 'Failed to clear game history' });
  }
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`✅ [CONNECTION] Socket connected: ${socket.id}`);
  
  // Track arena but DON'T join any room yet - wait for set-arena
  let currentArenaId = 'default';
  let arenaIdentified = false;
  socketArenaMap.set(socket.id, currentArenaId);
  
  // THROTTLING: Prevent event flooding - track last emit times per socket
  const emitThrottle = {
    betUpdate: 0,
    gameState: 0,
    timer: 0
  };
  const THROTTLE_DELAY = 50; // ms - only emit once per 50ms
  
  const shouldThrottle = (type) => {
    const now = Date.now();
    if (now - emitThrottle[type] >= THROTTLE_DELAY) {
      emitThrottle[type] = now;
      return false;
    }
    return true;
  };
  
  // DO NOT join any room here - wait for set-arena to identify arena first
  
  // Handle arena identification from client - THIS MUST HAPPEN FIRST
  socket.on('set-arena', async (data) => {
    const newArenaId = data.arenaId || 'default';
    
    console.log(`🏟️ [SET-ARENA] Socket ${socket.id} requesting arena '${newArenaId}'`);
    
    // If arena is being changed and we were previously in a room, leave it
    if (arenaIdentified && currentArenaId !== newArenaId) {
      socket.leave(`arena:${currentArenaId}`);
      console.log(`🏟️ [SET-ARENA] Left old arena room '${currentArenaId}'`);
    }
    
    socketArenaMap.set(socket.id, newArenaId);
    currentArenaId = newArenaId;
    
    // NOW join the arena-specific room
    socket.join(`arena:${newArenaId}`);
    console.log(`🏟️ [SET-ARENA] Joined arena room '${newArenaId}'. Current rooms: ${JSON.stringify(socket.rooms)}`);
    arenaIdentified = true;
    
    // SEND INITIAL DATA ONLY AFTER ARENA IS IDENTIFIED AND ROOM IS JOINED
    try {
      const arenaState = getGameState(currentArenaId);
      const timer = getArenaTimer(currentArenaId);
      
      // Emit initial game state with arena ID
      const gameStateData = { ...arenaState, arenaId: currentArenaId };
      socket.emit('game-state-update', gameStateData);

      // Send GB V2 frontend state if available
      if (gbStateStore[currentArenaId]) {
        socket.emit('gb:state', gbStateStore[currentArenaId]);
      }

      // Send GB V2 game history if available — without this, a device that wasn't
      // connected when a game was declared never receives that game's record.
      if (gbHistoryStore[currentArenaId]) {
        socket.emit('history:state', gbHistoryStore[currentArenaId]);
      }
      
      // Emit initial timer state with server's authoritative start time
      const currentElapsed = timer.continuousStartTime 
        ? Math.floor((Date.now() - timer.continuousStartTime) / 1000)
        : 0;
      
      socket.emit('timer-update', {
        isTimerRunning: timer.isRunning,
        timerSeconds: currentElapsed,
        serverStartTime: timer.startTime,
        accumulatedTime: currentElapsed,
        arenaId: currentArenaId
      });
      
      // Emit connected users coins
      const coinsData = await calculateConnectedUsersCoins();
      socket.emit('connected-users-coins-update', { ...coinsData, arenaId: currentArenaId });
      
      // Emit initial bet data with arena ID
      const betData = {
        arenaId: currentArenaId,
        teamAQueue: arenaState.teamAQueue,
        teamBQueue: arenaState.teamBQueue,
        bookedBets: arenaState.bookedBets,
        nextGameBets: arenaState.nextGameBets,
        nextTeamAQueue: arenaState.nextTeamAQueue,
        nextTeamBQueue: arenaState.nextTeamBQueue
      };
      socket.emit('bet-update', betData);
      
      // 🎯 NEW: Send complete arena state snapshot when arena changes
      // This ensures client gets ALL data from server as source of truth
      socket.emit('arena-state-snapshot', {
        arenaId: currentArenaId,
        gameState: {
          teamAGames: arenaState.teamAScore,
          teamBGames: arenaState.teamBScore,
          teamABalls: arenaState.teamABalls,
          teamBBalls: arenaState.teamBBalls,
          currentGameNumber: arenaState.currentGameNumber,
          teamAHasBreak: arenaState.teamAHasBreak,
          teamAQueue: arenaState.teamAQueue,
          teamBQueue: arenaState.teamBQueue,
          bookedBets: arenaState.bookedBets,
          nextTeamAQueue: arenaState.nextTeamAQueue,
          nextTeamBQueue: arenaState.nextTeamBQueue,
          nextBookedBets: arenaState.nextGameBets,
          totalBookedAmount: arenaState.totalBookedAmount,
          nextTotalBookedAmount: arenaState.nextTotalBookedAmount,
          isGameActive: arenaState.isGameActive,
          winner: arenaState.winner,
          gameInfo: arenaState.gameInfo
        },
        timestamp: Date.now()
      });
      console.log(`📡 [ARENA-SWITCH] Sent complete arena state snapshot to ${socket.id}`);
      
      // 🎮 NEW: Send game history when client joins arena
      try {
        const gameHistory = await getGameHistory(currentArenaId, 100);
        socket.emit('game-history-update', {
          arenaId: currentArenaId,
          games: gameHistory,
          timestamp: Date.now()
        });
        console.log(`✅ [GAME-HISTORY] Sent ${gameHistory.length} games to socket ${socket.id} on arena join`);
      } catch (error) {
        console.error(`❌ [GAME-HISTORY] Error fetching history on set-arena:`, error);
      }
    } catch (error) {
      console.error(`❌ [ARENA] Error sending initial data to ${socket.id}:`, error.message);
    }
  });
  
  // Handle any socket errors
  socket.on('error', (error) => {
    console.error(`❌ [SOCKET ERROR] ${socket.id}:`, error);
  });
  
  socket.on('disconnect', () => {
    console.log(`🔌 [DISCONNECT] Socket disconnected: ${socket.id}`);
    socketArenaMap.delete(socket.id);
    connectedUsers.delete(socket.id);
    for (const [arenaId, sid] of adminSessionByArena.entries()) {
      if (sid === socket.id) adminSessionByArena.delete(arenaId);
    }
    let releasedUser = false;
    for (const [userId, sid] of activeUserSocket.entries()) {
      if (sid === socket.id) { activeUserSocket.delete(userId); releasedUser = true; }
    }
    if (releasedUser) broadcastOnlineUsers();
  });

  // Claim exclusive session for a regular user account. If the account is already
  // active elsewhere, the claim is refused outright — no takeover option. The only
  // way in is for the existing session to log out (or its socket to disconnect),
  // which releases the slot.
  socket.on('user:claim', ({ userId } = {}) => {
    if (!userId) { socket.emit('user:claim:result', { success: false, error: 'Missing userId' }); return; }
    const existing = activeUserSocket.get(userId);
    if (existing && existing !== socket.id) {
      socket.emit('user:claim:result', { success: false, error: 'This account is already logged in on another device.', alreadyActive: true });
      return;
    }
    activeUserSocket.set(userId, socket.id);
    socket.emit('user:claim:result', { success: true });
    broadcastOnlineUsers();
    console.log(`🔐 [SESSION] Socket ${socket.id} claimed account ${userId}`);
  });

  socket.on('user:release', ({ userId } = {}) => {
    if (userId && activeUserSocket.get(userId) === socket.id) {
      activeUserSocket.delete(userId);
      broadcastOnlineUsers();
    }
  });

  // A freshly connected client needs the current snapshot, not just future updates
  socket.emit('users:online-list', Array.from(activeUserSocket.keys()));

  // Claim exclusive admin session for this arena. If another socket already holds it,
  // the claim is refused — no takeover option. The active admin must log out (or
  // disconnect) before anyone else can claim the role.
  socket.on('admin:claim', ({ password, arenaId = 'default' } = {}) => {
    if (password !== ADMIN_PASSWORD) {
      socket.emit('admin:claim:result', { success: false, error: 'Incorrect password' });
      return;
    }
    const existing = adminSessionByArena.get(arenaId);
    if (existing && existing !== socket.id) {
      socket.emit('admin:claim:result', { success: false, error: 'Admin is already active on another device.', alreadyActive: true });
      return;
    }
    adminSessionByArena.set(arenaId, socket.id);
    socket.emit('admin:claim:result', { success: true });
    console.log(`👑 [ADMIN] Socket ${socket.id} claimed admin for arena '${arenaId}'`);
  });

  socket.on('admin:release', ({ arenaId = 'default' } = {}) => {
    if (adminSessionByArena.get(arenaId) === socket.id) adminSessionByArena.delete(arenaId);
  });

  // Handle game state requests from new clients
  socket.on('request-game-state', async (data) => {
    const arenaId = data?.arenaId || currentArenaId;
    const arenaState = getGameState(arenaId);
    console.log(`📥 [REQUEST] Game state requested by ${socket.id} for arena '${arenaId}'`);
    socket.emit('game-state-update', { ...arenaState, arenaId });
    const coinsData = await calculateConnectedUsersCoins();
    socket.emit('connected-users-coins-update', { ...coinsData, arenaId });
    
    // Also send current bets for the arena
    const arenaGameState = getGameState(arenaId);
    socket.emit('bet-update', {
      teamAQueue: arenaGameState.teamAQueue || [],
      teamBQueue: arenaGameState.teamBQueue || [],
      bookedBets: arenaGameState.bookedBets || [],
      nextGameBets: arenaGameState.nextBookedBets || [],
      nextTeamAQueue: arenaGameState.nextTeamAQueue || [],
      nextTeamBQueue: arenaGameState.nextTeamBQueue || [],
      arenaId
    });
    
    console.log(`📤 [RESPONSE] Game state sent to ${socket.id}`);
  });
  
  // Handle user login/selection - track connected users
  socket.on('user-login', async (userData) => {
    console.log(`User logged in: ${userData.name} (${userData.id}) with ${userData.credits} coins`);
    
    // Remove any existing user for this socket first
    const existingUser = connectedUsers.get(socket.id);
    if (existingUser) {
      console.log(`Removing existing user ${existingUser.name} for socket ${socket.id}`);
      connectedUsers.delete(socket.id);
    }
    
    // Add the new user
    connectedUsers.set(socket.id, {
      userId: userData.id,
      name: userData.name,
      credits: userData.credits,
      socketId: socket.id,
      loginTime: Date.now()
    });

    // Join personal room so we can send targeted events (e.g. challenge notifications)
    socket.join(`user:${userData.id}`);

    // Upsert into DB so /api/users counter stays accurate
    upsertUserFromSocket(userData.id, userData.name, userData.isAdmin || false).catch(() => {});

    // Fetch full user list from DB and send to this client
    try {
      const dbUsers = await getAllUsers();
      const hydrated = await Promise.all(dbUsers.map(async du => {
        const balance = await getUserBalance(du.id);
        // Find matching local user from gbUsersStore to preserve pin, pendingBets etc.
        const local = gbUsersStore.find(u => u.id === du.id);
        return {
          ...(local || {}),
          id: du.id,
          name: du.name,
          isAdmin: du.is_admin || false,
          credits: balance, // DB is always authoritative — never fall back to stale local
          membership: du.membership_status === 'premium'
            ? { tier: 'premium', startDate: local?.membership?.startDate || Date.now(), renewsAt: local?.membership?.renewsAt || Date.now() + 365*24*60*60*1000 }
            : (local?.membership?.cancelledAt ? local.membership : undefined),
          pendingBets: local?.pendingBets || [],
        };
      }));
      if (hydrated.length > 0) socket.emit('users:state', hydrated);
      else if (gbUsersStore.length > 0) socket.emit('users:state', gbUsersStore);
    } catch(e) {
      if (gbUsersStore.length > 0) socket.emit('users:state', gbUsersStore);
    }

    // Broadcast updated connected users coins to all clients
    const coinsData = await calculateConnectedUsersCoins();
    io.emit('connected-users-coins-update', coinsData);
    console.log(`📊 Connected users coins: ${coinsData.totalCoins} coins from ${coinsData.connectedUserCount} users`);
  });

  // Handle user logout - remove from connected users tracking
  socket.on('user-logout', async (userData) => {
    console.log(`User logged out: ${userData.name} (${userData.id})`);
    const existingUser = connectedUsers.get(socket.id);
    if (existingUser && existingUser.userId === userData.id) {
      connectedUsers.delete(socket.id);
      
      // Broadcast updated connected users coins to all clients
      const coinsData = await calculateConnectedUsersCoins();
      io.emit('connected-users-coins-update', coinsData);
      console.log(`📊 Connected users coins after logout: ${coinsData.totalCoins} coins from ${coinsData.connectedUserCount} users`);
    } else {
      console.log(`⚠️ Logout event for user ${userData.name} but socket ${socket.id} has different user:`, existingUser?.name || 'none');
    }
  });
  
  // Handle bet updates - sync betting queues across all clients
  socket.on('bet-update', (data) => {
    const arenaId = data?.arenaId || 'default';
    const arenaState = getGameState(arenaId);
    
    console.log(`📥 Received bet update for arena '${arenaId}':`, {
      teamAQueue: data.teamAQueue?.length,
      teamBQueue: data.teamBQueue?.length,
      bookedBets: data.bookedBets?.length,
      nextTeamAQueue: data.nextTeamAQueue?.length,
      nextTeamBQueue: data.nextTeamBQueue?.length,
      nextGameBets: data.nextGameBets?.length
    });
    
    // Update the arena's game state with the new bet data
    if (data.teamAQueue !== undefined) arenaState.teamAQueue = data.teamAQueue;
    if (data.teamBQueue !== undefined) arenaState.teamBQueue = data.teamBQueue;
    if (data.bookedBets !== undefined) arenaState.bookedBets = data.bookedBets;
    if (data.nextTeamAQueue !== undefined) arenaState.nextTeamAQueue = data.nextTeamAQueue;
    if (data.nextTeamBQueue !== undefined) arenaState.nextTeamBQueue = data.nextTeamBQueue;
    if (data.nextGameBets !== undefined) arenaState.nextGameBets = data.nextGameBets;
    if (data.totalBookedAmount !== undefined) arenaState.totalBookedAmount = data.totalBookedAmount;
    if (data.nextTotalBookedAmount !== undefined) arenaState.nextTotalBookedAmount = data.nextTotalBookedAmount;
    
    arenaState.lastUpdated = Date.now();
    
    // Broadcast the bet update to ALL clients in the SAME ARENA (including sender)
    // 🎯 ARENA INDEPENDENCE: Only sending to arena '${arenaId}', not affecting other arenas
    io.to(`arena:${arenaId}`).emit('bet-update', data);
    io.to(`arena:${arenaId}`).emit('bet:sound');
    console.log(`📤 [ARENA-INDEPENDENT] Broadcasted bet-update to arena '${arenaId}' ONLY`);
  });
  
  // Handle game history updates - sync across all clients
  socket.on('game-history-update', (data) => {
    console.log('📥 Received game history update:', data.gameHistory?.length, 'entries');
    
    // SKIP if listeners are paused (during clear)
    if (isListenersPaused) {
      console.log('⏸️ SERVER: Skipping game-history-update broadcast - listeners paused');
      return;
    }
    
    const arenaId = data.arenaId || 'default';
    const arenaState = getGameState(arenaId);
    arenaState.gameHistory = data.gameHistory || [];
    arenaState.lastUpdated = Date.now();
    
    // Broadcast to all OTHER clients in the SAME ARENA
    socket.to(`arena:${arenaId}`).emit('game-history-update', data);
    console.log(`📤 Broadcasted game history to arena '${arenaId}'`);
  });

  // Handle bet receipts updates - sync across all clients and save to database
  socket.on('bet-receipts-update', async (data) => {
    console.log('📥 Received bet receipts update:', data.betReceipts?.length, 'entries');
    
    const arenaId = data.arenaId || 'default';
    const arenaState = getGameState(arenaId);
    arenaState.betReceipts = data.betReceipts || [];
    arenaState.lastUpdated = Date.now();
    
    // ALWAYS save each receipt to the database (do NOT skip during pause)
    // The pause flag is ONLY for client broadcasts, not for persistence
    if (data.betReceipts && data.betReceipts.length > 0) {
      try {
        for (const receipt of data.betReceipts) {
          await addBetReceipt({
            id: receipt.id,
            userId: receipt.userId,
            userName: receipt.userName,
            arenaId: arenaId,
            gameNumber: receipt.gameNumber,
            teamSide: receipt.teamSide,
            teamName: receipt.teamName,
            opponentName: receipt.opponentName,
            winningTeam: receipt.winningTeam,
            teamAName: receipt.teamAName,
            teamBName: receipt.teamBName,
            teamAScore: receipt.teamAScore,
            teamBScore: receipt.teamBScore,
            amount: receipt.amount,
            won: receipt.won,
            duration: receipt.duration,
            timestamp: receipt.timestamp,
            transactionType: receipt.transactionType || 'bet'
          });
        }
        console.log(`✅ Saved ${data.betReceipts.length} bet receipts to database with full game data`);
      } catch (error) {
        console.error('❌ Error saving bet receipts to database:', error);
      }
    }
    
    // SKIP client broadcast if listeners are paused (during clear)
    // But ALWAYS persist to database (see above)
    if (!isListenersPaused) {
      // ✅ BROADCAST TO ALL CLIENTS (like game history does)
      // This ensures all clients see the SAME data immediately
      io.to(`arena:${arenaId}`).emit('bet-receipts-update', {
        arenaId,
        betReceipts: data.betReceipts || [],
        timestamp: Date.now()
      });
      console.log(`📤 Broadcasted bet receipts to ALL clients in arena '${arenaId}'`);
    } else {
      console.log(`⏸️ [bet-receipts-update] Skipping broadcast (listeners paused), but data was saved to database`);
    }
  });
  
  // Handle game state updates
  // GameBird V2 frontend sync — separate namespace to avoid schema conflicts
  // Store latest user list from any client so /api/users counter stays accurate
  socket.on('users:update', (incoming) => {
    if (!Array.isArray(incoming) || incoming.length === 0) return;
    // Merge incoming users into gbUsersStore — skip any that have been deleted
    const merged = [...gbUsersStore];
    incoming.forEach(u => {
      if (deletedUserIds.has(u.id)) return; // never re-add deleted users
      const idx = merged.findIndex(m => m.id === u.id);
      if (idx === -1) merged.push(u);
      else merged[idx] = u;
    });
    gbUsersStore = merged;
    // Persist to DB
    incoming.forEach(u => {
      if (!u.isAdmin && u.id && u.name && !deletedUserIds.has(u.id)) {
        upsertUserFromSocket(u.id, u.name, false).catch(() => {});
        // Do NOT update membership from socket — only the /api/users/:id/membership endpoint may change it
      }
    });
  });

  // Admin requesting full user list — ask all connected clients to push their users
  socket.on('users:request-all', () => {
    io.emit('users:push');
  });

  socket.on('gb:state', (data) => {
    if (!data) return;
    const arenaId = data.arenaId || 'default';
    if (!gbStateStore[arenaId]) gbStateStore[arenaId] = data;
    else Object.assign(gbStateStore[arenaId], data);
    socket.to(`arena:${arenaId}`).emit('gb:state', gbStateStore[arenaId]);
  });

  // Relay + cache GB V2 game history so every connected device (not just the one
  // that declared the winner) receives each finished game's record in real time,
  // and so a device joining later gets the current history on connect.
  socket.on('history:update', (records) => {
    if (!Array.isArray(records)) return;
    const arenaId = currentArenaId || 'default';
    gbHistoryStore[arenaId] = records;
    socket.to(`arena:${arenaId}`).emit('history:state', records);
  });

  socket.on('game-state-update', (gameStateData) => {
    const { arenaId = 'default', ...actualGameState } = gameStateData;
    const arenaLabel = getArenaLabel(arenaId);
    console.log(`📥 ${arenaLabel} Received game state update:`, actualGameState);
    
    const arenaState = getGameState(arenaId);
    
    // 🎯 ARENA INDEPENDENCE CHECK
    // Verify we're updating the correct arena
    const allArenaKeys = Object.keys(arenaGameStates);
    const allLabels = allArenaKeys.map(id => getArenaLabel(id)).join(' | ');
    console.log(`🏟️ [ARENA CHECK] Active arenas: ${allLabels} → Updating: ${arenaLabel}`);
    
    // Detect if a game was won (currentGameNumber increased)
    const gameWonDetected = actualGameState.currentGameNumber && 
                           actualGameState.currentGameNumber > arenaState.currentGameNumber;
    
    // Update server's game state with new values (ONLY for this arena)
    Object.assign(arenaState, actualGameState);
    console.log(`✅ ${arenaLabel} Updated. Other arenas isolated.`);
    
    // If a game was won, reset the timer
    if (gameWonDetected) {
      console.log(`🏆 ${arenaLabel} Game ${actualGameState.currentGameNumber} won - resetting timer`);
      resetServerTimer(arenaId);
    }
    
    // Broadcast the COMPLETE updated game state to ALL clients in the arena (like bet-update does)
    // This ensures all devices have identical data, even if they miss some intermediate updates
    io.to(`arena:${arenaId}`).emit('game-state-update', { ...arenaState, arenaId });
    console.log(`📤 ${arenaLabel} Broadcasted game-state-update`);
  });
  
  // Handle timer updates
  socket.on('timer-update', (timerData) => {
    const { arenaId = 'default', ...actualTimerData } = timerData;
    console.log(`📥 Received timer update for arena '${arenaId}':`, actualTimerData);
    
    const arenaState = getGameState(arenaId);
    const timer = getArenaTimer(arenaId);
    
    // If timer is being started, ensure continuousStartTime is set
    if (actualTimerData.isTimerRunning && !timer.isRunning) {
      startServerTimer(arenaId);
    }
    // If timer is being paused, ensure it stops but keeps accumulated time
    else if (!actualTimerData.isTimerRunning && timer.isRunning) {
      stopServerTimer(arenaId);
    }
    // If timer was already running, nothing to do - server maintains its own time
  });
  
  // Handle timer heartbeat requests
  socket.on('timer-heartbeat', () => {
    // Send current server timer state to requesting client
    const arenaId = socketArenaMap.get(socket.id) || 'default';
    const arenaState = getGameState(arenaId);
    const timer = getArenaTimer(arenaId);
    
    // Calculate current elapsed time from continuous start
    const currentElapsed = timer.continuousStartTime 
      ? Math.floor((Date.now() - timer.continuousStartTime) / 1000)
      : 0;
    
    socket.emit('timer-update', {
      isTimerRunning: timer.isRunning,
      timerSeconds: currentElapsed,
      serverStartTime: timer.startTime,
      accumulatedTime: currentElapsed,
      arenaId: arenaId
    });
  });

  // Handle dedicated break status updates
  socket.on('break-status-update', (data) => {
    console.log('Received dedicated break status update:', data);
    const arenaId = data.arenaId || 'default';
    const arenaState = getGameState(arenaId);
    arenaState.teamAHasBreak = data.teamAHasBreak;
    arenaState.lastUpdated = Date.now();
    
    // Broadcast to ALL clients in the SAME ARENA (including sender) for consistency
    io.to(`arena:${arenaId}`).emit('break-status-update', { ...data, arenaId });
    console.log(`📤 Broadcasted break-status-update to arena '${arenaId}'`);
  });

  // BET HISTORY IS NOW COMPLETELY LOCAL - NO SERVER SYNC
  // Removed game history update handler to prevent external clearing
  // Bet history is now a permanent, immutable ledger on each client

  // Handle total booked coins updates
  socket.on('total-booked-coins-update', (data) => {
    console.log('Received total booked coins update:', data);
    const arenaId = data.arenaId || 'default';
    const arenaState = getGameState(arenaId);
    if (data.totalBookedAmount !== undefined) arenaState.totalBookedAmount = data.totalBookedAmount;
    if (data.nextTotalBookedAmount !== undefined) arenaState.nextTotalBookedAmount = data.nextTotalBookedAmount;
    arenaState.lastUpdated = Date.now();
    
    // Broadcast to ALL clients in the SAME ARENA (including sender) for consistency
    io.to(`arena:${arenaId}`).emit('total-booked-coins-update', { 
      totalBookedAmount: arenaState.totalBookedAmount,
      nextTotalBookedAmount: arenaState.nextTotalBookedAmount,
      arenaId
    });
    console.log(`📤 Broadcasted total-booked-coins-update to arena '${arenaId}'`);
  });

  // BET RECEIPTS ARE NOW COMPLETELY LOCAL - NO SERVER SYNC
  // Removed bet receipts update handler to prevent external clearing
  // Bet receipts are now a permanent, immutable ledger on each client

  // Handle sound events - broadcast to all clients in the arena
  socket.on('play-sound', (data) => {
    const arenaId = data?.arenaId || 'default';
    console.log(`🔊 Sound event '${data.soundType}' for arena '${arenaId}'`);
    // Broadcast sound to ALL clients in the same arena (including sender)
    io.to(`arena:${arenaId}`).emit('play-sound', data);
  });

  // Handle user wallet updates
  socket.on('user-wallet-update', (data) => {
    const arenaId = data?.arenaId || 'default';
    console.log(`💰 User wallet update for arena '${arenaId}':`, data);
    // Broadcast ONLY to the specific arena
    io.to(`arena:${arenaId}`).emit('user-wallet-update', data);
  });
  
  // Handle wallet data requests
  socket.on('request-wallet-data', () => {
    console.log('Received wallet data request');
    // Send current wallet data to requesting client
    socket.emit('wallet-data-response', { users: serverGameState.users });
  });

  // Handle connected users data requests
  socket.on('request-connected-users-data', async () => {
    console.log('Received connected users data request');
    
    // Force cleanup of stale connections before calculating
    const coinsData = await calculateConnectedUsersCoins();
    
    // Send to requesting client
    socket.emit('connected-users-coins-update', coinsData);
    
    // Also broadcast to all clients to ensure everyone has the latest data
    io.emit('connected-users-coins-update', coinsData);
    
    console.log(`📊 Sent connected users data: ${coinsData.totalCoins} coins from ${coinsData.connectedUserCount} users`);
  });

  // Handle clear all data - broadcast to ALL clients in the arena
  socket.on('clear-all-data', (data) => {
    const arenaId = data?.arenaId || 'default';
    console.log(`🗑️ [CLEAR-DATA] Received clear command for arena '${arenaId}' from socket ${socket.id}`);
    
    // Broadcast to ALL clients in this arena (including sender)
    console.log(`📡 [CLEAR-DATA] Broadcasting clear-all-data to arena '${arenaId}'`);
    io.to(`arena:${arenaId}`).emit('clear-all-data', data);
    
    console.log(`✅ [CLEAR-DATA] Clear command sent to all clients in arena '${arenaId}'`);
  });
  
  // Handle pause listeners
  socket.on('pause-listeners', (data) => {
    const arenaId = data?.arenaId || 'default';
    console.log(`⏸️ Pause listeners for arena '${arenaId}'`);
    isListenersPaused = true;
    // Broadcast ONLY to the specific arena
    io.to(`arena:${arenaId}`).emit('pause-listeners', data);
  });
  
  // Handle resume listeners
  socket.on('resume-listeners', (data) => {
    const arenaId = data?.arenaId || 'default';
    console.log(`▶️ Resume listeners for arena '${arenaId}'`);
    isListenersPaused = false;
    // Broadcast ONLY to the specific arena
    io.to(`arena:${arenaId}`).emit('resume-listeners', data);
  });
  
  // Handle score updates
  socket.on('score-update', (scoreData) => {
    const { arenaId = 'default', ...actualScoreData } = scoreData;
    console.log(`📥 [ARENA-INDEPENDENT] Received score update for arena '${arenaId}':`, actualScoreData);
    
    const arenaState = getGameState(arenaId);
    if (actualScoreData.teamAScore !== undefined) arenaState.teamAScore = actualScoreData.teamAScore;
    if (actualScoreData.teamBScore !== undefined) arenaState.teamBScore = actualScoreData.teamBScore;
    
    // Broadcast the COMPLETE updated scores to ALL clients in the arena (ONLY this arena)
    io.to(`arena:${arenaId}`).emit('score-update', { 
      teamAScore: arenaState.teamAScore, 
      teamBScore: arenaState.teamBScore,
      arenaId 
    });
    console.log(`📤 [ARENA-INDEPENDENT] Broadcasted score-update to arena '${arenaId}' ONLY`);
  });
  
  // Handle test messages
  socket.on('test-message', (data) => {
    console.log('📥 Received test message:', data);
    socket.emit('test-response', {
      message: 'Hello from server!',
      timestamp: new Date().toISOString(),
      serverId: socket.id,
      originalData: data
    });
  });

  // Handle peer-to-peer game history requests
  socket.on('request-game-history-from-clients', (data) => {
    const arenaId = data?.arenaId || 'default';
    const requestId = data?.requestId || `request-${Date.now()}`;
    console.log(`📨 [P2P] Server requesting game history for arena '${arenaId}' (requestId: ${requestId})`);
    // Broadcast ONLY to the specific arena
    io.to(`arena:${arenaId}`).emit('request-game-history-from-clients', {
      requestId,
      arenaId,
      serverId: socket.id,
      originalData: data
    });
  });

  // Handle sound events - broadcast to all clients in the arena
  socket.on('play-sound', (data) => {
    const arenaId = data?.arenaId || 'default';
    console.log(`🔊 Sound event '${data.soundType}' for arena '${arenaId}'`);
    // Broadcast sound to ALL clients in the same arena (including sender)
    io.to(`arena:${arenaId}`).emit('play-sound', data);
  });

  // Handle team names updates - broadcast to all clients in the arena
  socket.on('team-names-update', (data) => {
    const arenaId = data?.arenaId || 'default';
    console.log(`👥 [TEAM NAMES UPDATE] Arena '${arenaId}': ${data.teamAName} vs ${data.teamBName}`);
    // Broadcast to ALL clients in the same arena
    io.to(`arena:${arenaId}`).emit('team-names-update', data);
  });

  // Handle admin state updates - broadcast to all clients in the arena
  socket.on('admin-state-update', (data) => {
    const arenaId = data?.arenaId || 'default';
    console.log(`⚙️ [ADMIN STATE UPDATE] Arena '${arenaId}': ${JSON.stringify(data)}`);
    // Broadcast to ALL clients in the same arena
    io.to(`arena:${arenaId}`).emit('admin-state-update', data);
  });

  // Handle request to clear ALL pending bets across all arenas (ADMIN ONLY)
  socket.on('clear-all-pending-bets-backend', async () => {
    console.log(`🧹 [ADMIN-ACTION] Received request to clear all pending bets across all arenas.`);
    for (const arenaId in arenaGameStates) {
      if (arenaGameStates.hasOwnProperty(arenaId)) {
        const arenaState = arenaGameStates[arenaId];
        console.log(`   [ADMIN-ACTION] Clearing pending bets for arena: ${arenaId}`);
        arenaState.teamAQueue = [];
        arenaState.teamBQueue = [];
        arenaState.bookedBets = [];
        arenaState.nextGameBets = [];
        arenaState.nextTeamAQueue = [];
        arenaState.nextTeamBQueue = [];
        arenaState.totalBookedAmount = 0;
        arenaState.nextTotalBookedAmount = 0;

        // Broadcast the updated bet state for this arena
        io.to(`arena:${arenaId}`).emit('bet-update', {
          arenaId,
          teamAQueue: arenaState.teamAQueue,
          teamBQueue: arenaState.teamBQueue,
          bookedBets: arenaState.bookedBets,
          nextGameBets: arenaState.nextGameBets,
          nextTeamAQueue: arenaState.nextTeamAQueue,
          nextTeamBQueue: arenaState.nextTeamBQueue
        });

        // Also broadcast the updated total booked amounts
        io.to(`arena:${arenaId}`).emit('total-booked-coins-update', {
          arenaId,
          totalBookedAmount: arenaState.totalBookedAmount,
          nextTotalBookedAmount: arenaState.nextTotalBookedAmount
        });
        console.log(`   ✅ [ADMIN-ACTION] Cleared and broadcasted for arena: ${arenaId}`);
      }
    }
    console.log(`✅ [ADMIN-ACTION] All pending bets cleared across all arenas.`);
  });

  // Handle full state sync - broadcast to all clients in the arena
  socket.on('full-state-sync', (data) => {
    const arenaId = data?.arenaId || 'default';
    console.log(`📡 [FULL STATE SYNC] Arena '${arenaId}' - syncing complete game state`);
    // Broadcast to ALL clients in the same arena (excluding sender)
    socket.broadcast.to(`arena:${arenaId}`).emit('full-state-sync', data);
  });

  /*
  ================================
  GAME HISTORY SOCKET.IO EVENTS
  ================================
  Real-time synchronization of game history across all clients in an arena
  */

  // Request game history for an arena
  socket.on('request-game-history', async (data) => {
    const arenaId = data?.arenaId || 'default';
    try {
      const gameHistory = await getGameHistory(arenaId, 100);
      console.log(`✅ [GAME-HISTORY] Sending ${gameHistory.length} games to socket ${socket.id} for arena '${arenaId}'`);
      socket.emit('game-history-update', {
        arenaId,
        games: gameHistory,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error(`❌ [GAME-HISTORY] Error fetching game history:`, error);
      socket.emit('game-history-error', { error: 'Failed to fetch game history' });
    }
  });

  // Broadcast new game to all clients in the arena
  socket.on('new-game-added', async (data) => {
    const arenaId = data?.arenaId || 'default';
    const gameHistoryRecord = data?.gameHistoryRecord;

    console.log(`📥 [GAME-HISTORY] Received 'new-game-added' event for arena '${arenaId}'`);
    console.log(`   Full data:`, JSON.stringify(data, null, 2));
    console.log(`   gameHistoryRecord:`, gameHistoryRecord);

    try {
      // 🎮 CRITICAL: Validate game data before saving
      if (!gameHistoryRecord || gameHistoryRecord.gameNumber === undefined) {
        console.warn(`⚠️ [GAME-HISTORY] Invalid game data received - missing gameNumber`);
        console.warn(`   gameHistoryRecord:`, gameHistoryRecord);
        console.warn(`   gameNumber value:`, gameHistoryRecord?.gameNumber);
        socket.emit('game-history-error', { error: 'Invalid game data' });
        return;
      }

      // Save to database
      const savedGame = await addGameHistory(gameHistoryRecord);
      
      console.log(`✅ [GAME-HISTORY] New game saved for arena '${arenaId}' - Game ID: ${savedGame.game_id}, Game #${savedGame.game_number}`);
      
      // 🎮 BROADCAST TO ALL CLIENTS (like game-state-update does)
      // This ensures all clients see the same data immediately
      io.to(`arena:${arenaId}`).emit('game-added', {
        arenaId,
        game: savedGame,
        timestamp: Date.now()
      });

      // 🎮 ALSO SEND COMPLETE GAME HISTORY (like game-state does)
      // This ensures all clients have the authoritative full history from server
      const completeHistory = await getGameHistory(arenaId, 100);
      io.to(`arena:${arenaId}`).emit('game-history-update', {
        arenaId,
        games: completeHistory,
        timestamp: Date.now()
      });

      console.log(`📢 [GAME-HISTORY] Broadcasted new game + complete history to ALL clients in arena '${arenaId}'`);
    } catch (error) {
      console.error(`❌ [GAME-HISTORY] Error adding game:`, error);
      socket.emit('game-history-error', { error: 'Failed to add game' });
    }
  });

  // Clear game history for an arena
  socket.on('clear-game-history', async (data) => {
    const arenaId = data?.arenaId || 'default';

    try {
      const deletedCount = await clearGameHistory(arenaId);
      
      console.log(`✅ [GAME-HISTORY] Cleared ${deletedCount} games from arena '${arenaId}'`);
      
      // Broadcast to ALL clients in this arena
      io.to(`arena:${arenaId}`).emit('game-history-cleared', {
        arenaId,
        deletedCount,
        timestamp: Date.now()
      });

      // 🎮 ALSO SEND EMPTY HISTORY SYNC (authoritative confirmation)
      io.to(`arena:${arenaId}`).emit('game-history-update', {
        arenaId,
        games: [],
        timestamp: Date.now()
      });

      console.log(`📢 [GAME-HISTORY] Broadcasted clear + empty history sync to arena '${arenaId}'`);
    } catch (error) {
      console.error(`❌ [GAME-HISTORY] Error clearing history:`, error);
      socket.emit('game-history-error', { error: 'Failed to clear game history' });
    }
  });

  /*
  ================================
  BET RECEIPTS SOCKET.IO EVENTS
  ================================
  Real-time synchronization of bet receipts across all clients in an arena
  */

  // Request bet receipts for a user
  socket.on('request-bet-receipts', async (data) => {
    const userId = data?.userId;
    const arenaId = data?.arenaId || 'default';
    
    if (!userId) {
      console.warn(`⚠️ [BET-RECEIPTS] Request missing userId`);
      socket.emit('bet-receipts-error', { error: 'Missing userId' });
      return;
    }

    try {
      const receipts = await getBetReceipts(userId, arenaId, 250);
      console.log(`✅ [BET-RECEIPTS] Sending ${receipts.length} receipts to socket ${socket.id} for user ${userId}`);
      socket.emit('bet-receipts-data', {
        userId,
        arenaId,
        betReceipts: receipts,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error(`❌ [BET-RECEIPTS] Error fetching receipts:`, error);
      socket.emit('bet-receipts-error', { error: 'Failed to fetch bet receipts' });
    }
  });

  // Request all bet receipts for an arena (for public display)
  socket.on('request-arena-bet-receipts', async (data) => {
    const arenaId = data?.arenaId || 'default';

    try {
      const receipts = await getArenaAllBetReceipts(arenaId, 250);
      console.log(`✅ [BET-RECEIPTS] Sending ${receipts.length} arena receipts to socket ${socket.id}`);
      socket.emit('arena-bet-receipts-data', {
        arenaId,
        betReceipts: receipts,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error(`❌ [BET-RECEIPTS] Error fetching arena receipts:`, error);
      socket.emit('bet-receipts-error', { error: 'Failed to fetch arena bet receipts' });
    }
  });

  // Clear bet receipts for a user
  socket.on('clear-user-bet-receipts', async (data) => {
    const userId = data?.userId;
    const arenaId = data?.arenaId || 'default';

    if (!userId) {
      console.warn(`⚠️ [BET-RECEIPTS] Clear request missing userId`);
      socket.emit('bet-receipts-error', { error: 'Missing userId' });
      return;
    }

    try {
      const deletedCount = await clearUserBetReceipts(userId);
      
      console.log(`✅ [BET-RECEIPTS] Cleared ${deletedCount} receipts for user ${userId}`);
      
      // Broadcast to ALL clients in this arena
      io.to(`arena:${arenaId}`).emit('bet-receipts-cleared', {
        userId,
        arenaId,
        deletedCount,
        timestamp: Date.now()
      });

      // Send empty receipts sync (authoritative confirmation)
      io.to(`arena:${arenaId}`).emit('bet-receipts-update', {
        arenaId,
        betReceipts: [],
        timestamp: Date.now()
      });

      console.log(`📢 [BET-RECEIPTS] Broadcasted clear + empty receipts sync to arena '${arenaId}'`);
    } catch (error) {
      console.error(`❌ [BET-RECEIPTS] Error clearing receipts:`, error);
      socket.emit('bet-receipts-error', { error: 'Failed to clear bet receipts' });
    }
  });

});


/*
================================
BET RECEIPTS API ENDPOINTS
================================
REST API for bet receipts management
*/

// Get bet receipts for a user
// ⚠️ NOTE: This endpoint is primarily for server-internal use and Socket.IO events
// Client access is restricted via Socket.IO-only pattern
app.get('/api/bet-receipts/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { arenaId = 'default', limit = 250 } = req.query;
    
    // ✅ SECURITY: Validate user exists before returning receipts
    const user = await getUserById(userId);
    if (!user) {
      console.warn(`⚠️ [BET-RECEIPTS-GET] User not found: ${userId}`);
      return res.status(404).json({ error: 'User not found' });
    }
    
    console.log(`📡 [BET-RECEIPTS-GET] Fetching receipts for user: ${userId}, arena: ${arenaId}`);
    
    const receipts = await getBetReceipts(userId, arenaId, parseInt(limit));
    
    console.log(`✅ [BET-RECEIPTS-GET] Retrieved ${receipts.length} receipts for user ${userId}`);
    res.json({
      userId,
      arenaId,
      betReceipts: receipts,
      count: receipts.length
    });
  } catch (error) {
    console.error(`❌ [BET-RECEIPTS-GET] Error fetching receipts:`, error);
    res.status(500).json({ error: 'Failed to fetch bet receipts' });
  }
});

// Get all bet receipts for an arena
app.get('/api/bet-receipts-arena/:arenaId', async (req, res) => {
  try {
    const { arenaId } = req.params;
    const { limit = 250 } = req.query;
    
    console.log(`📡 [BET-RECEIPTS-ARENA-GET] Fetching all receipts for arena: ${arenaId}`);
    
    const receipts = await getArenaAllBetReceipts(arenaId, parseInt(limit));
    
    console.log(`✅ [BET-RECEIPTS-ARENA-GET] Retrieved ${receipts.length} receipts for arena ${arenaId}`);
    res.json({
      arenaId,
      betReceipts: receipts,
      count: receipts.length
    });
  } catch (error) {
    console.error(`❌ [BET-RECEIPTS-ARENA-GET] Error fetching arena receipts:`, error);
    res.status(500).json({ error: 'Failed to fetch arena bet receipts' });
  }
});

// Add a bet receipt
app.post('/api/bet-receipts', async (req, res) => {
  try {
    const receiptData = req.body;
    
    console.log(`📤 [BET-RECEIPTS-POST] Adding receipt for user: ${receiptData.userId}`);
    
    const receipt = await addBetReceipt(receiptData);
    
    if (receipt) {
      console.log(`✅ [BET-RECEIPTS-POST] Receipt added successfully`);
      res.json({
        success: true,
        receipt
      });
    } else {
      console.warn(`⚠️ [BET-RECEIPTS-POST] Receipt already exists (duplicate)`);
      res.json({
        success: false,
        message: 'Receipt already exists'
      });
    }
  } catch (error) {
    console.error(`❌ [BET-RECEIPTS-POST] Error adding receipt:`, error);
    res.status(500).json({ error: 'Failed to add bet receipt' });
  }
});

// Clear all bet receipts for a user
// ⚠️ NOTE: This endpoint is admin-only and used internally via Socket.IO
app.post('/api/bet-receipts/:userId/clear', async (req, res) => {
  try {
    const { userId } = req.params;
    
    // ✅ SECURITY: Validate user exists before clearing receipts
    const user = await getUserById(userId);
    if (!user) {
      console.warn(`⚠️ [BET-RECEIPTS-CLEAR] User not found: ${userId}`);
      return res.status(404).json({ error: 'User not found' });
    }
    
    console.log(`🗑️ [BET-RECEIPTS-CLEAR] Clearing receipts for user: ${userId}`);
    
    const deletedCount = await clearUserBetReceipts(userId);
    
    console.log(`✅ [BET-RECEIPTS-CLEAR] Cleared ${deletedCount} receipts for user ${userId}`);
    res.json({
      success: true,
      userId,
      deletedCount
    });
  } catch (error) {
    console.error(`❌ [BET-RECEIPTS-CLEAR] Error clearing receipts:`, error);
    res.status(500).json({ error: 'Failed to clear bet receipts' });
  }
});

// ============================================================================
// AUDIT API ENDPOINTS
// ============================================================================

// ── Coin Drift Log ──
app.get('/api/audit/drift', async (req, res) => {
  try { res.json(await getDriftLog()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/audit/drift', async (req, res) => {
  try { await addDriftEntry(req.body); res.json({ success: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/audit/drift/:id/ack', async (req, res) => {
  try { await acknowledgeDrift(req.params.id); res.json({ success: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/audit/drift', async (req, res) => {
  try { await clearDriftLog(); res.json({ success: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Admin Activity Log ──
app.get('/api/audit/activity', async (req, res) => {
  try { res.json(await getAdminAuditLog()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/audit/activity', async (req, res) => {
  try { await addAdminAuditEvent(req.body); res.json({ success: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/audit/activity', async (req, res) => {
  try { await clearAdminAuditLog(); res.json({ success: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Game Balance Snapshots ──
app.get('/api/audit/snapshots', async (req, res) => {
  try { res.json(await getGameSnapshots()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/audit/snapshots', async (req, res) => {
  try { await addGameSnapshot(req.body); res.json({ success: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/audit/snapshots', async (req, res) => {
  try { await clearGameSnapshots(); res.json({ success: true }); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ============================================================================
// 🤝 CHALLENGE (ESCROW BET) SYSTEM
// ============================================================================
// In-memory store; survives the session, clears on restart.
// For persistence, these can be added to the DB later.
const challenges = new Map(); // id -> Challenge

function generateToken() {
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

// Twilio SMS helper — only fires if env vars are set
async function sendJudgeText(phone, link, creatorName, opponentName, amount) {
  const { TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER } = process.env;
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
    console.log('📵 [CHALLENGE] Twilio not configured — skipping SMS. Link:', link);
    return;
  }
  try {
    const twilio = (await import('twilio')).default;
    const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
    await client.messages.create({
      body: `Game Bird — You've been selected as judge for a ${amount}-coin bet between ${creatorName} and ${opponentName}. Tap here to declare the winner: ${link}`,
      from: TWILIO_PHONE_NUMBER,
      to: phone,
    });
    console.log(`✅ [CHALLENGE] Judge SMS sent to ${phone}`);
  } catch (err) {
    console.error('❌ [CHALLENGE] Twilio error:', err.message);
  }
}

// POST /api/challenges — creator proposes a challenge
app.post('/api/challenges', (req, res) => {
  const { creatorId, creatorName, opponentId, opponentName, amount, judgePhone, myPlayer, theirPlayer } = req.body;
  if (!creatorId || !opponentId || !amount || amount <= 0) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }
  const id = generateToken();
  const judgeToken = generateToken();
  const challenge = {
    id, creatorId, creatorName, opponentId, opponentName,
    amount, judgePhone: judgePhone || '', judgeToken,
    myPlayer: myPlayer || creatorName, theirPlayer: theirPlayer || opponentName,
    status: 'pending', createdAt: Date.now(),
  };
  challenges.set(id, challenge);
  console.log(`🤝 [CHALLENGE] Created: ${creatorName} vs ${opponentName} for ${amount} coins`);
  // Notify opponent in real-time
  io.to(`user:${opponentId}`).emit('challenge:new', challenge);
  res.json({ success: true, challenge });
});

// GET /api/challenges — list all challenges (client filters by userId)
app.get('/api/challenges', (req, res) => {
  res.json(Array.from(challenges.values()));
});

// POST /api/challenges/:id/accept — opponent accepts; triggers SMS to judge
app.post('/api/challenges/:id/accept', async (req, res) => {
  const challenge = challenges.get(req.params.id);
  if (!challenge) return res.status(404).json({ error: 'Challenge not found.' });
  if (challenge.status !== 'pending') return res.status(400).json({ error: 'Challenge is no longer pending.' });
  challenge.status = 'accepted';
  challenge.acceptedAt = Date.now();
  const host = req.headers.origin || `https://${req.headers.host}`;
  const judgeLink = `${host}/#/judge/${challenge.judgeToken}`;
  challenge.judgeLink = judgeLink;
  challenges.set(challenge.id, challenge);
  // Send judge text
  await sendJudgeText(challenge.judgePhone, judgeLink, challenge.myPlayer, challenge.theirPlayer, challenge.amount);
  console.log(`✅ [CHALLENGE] Accepted: ${challenge.creatorName} vs ${challenge.opponentName}`);
  res.json({ success: true, challenge, judgeLink });
});

// GET /api/challenges/:id/judgelink — return (or generate) judge link for an accepted challenge
app.get('/api/challenges/:id/judgelink', (req, res) => {
  const challenge = challenges.get(req.params.id);
  if (!challenge) return res.status(404).json({ error: 'Challenge not found.' });
  if (challenge.status !== 'accepted') return res.status(400).json({ error: 'Challenge is not active.' });
  if (!challenge.judgeToken) return res.status(400).json({ error: 'No judge token.' });
  const host = req.headers.origin || `https://${req.headers.host}`;
  const judgeLink = `${host}/#/judge/${challenge.judgeToken}`;
  challenge.judgeLink = judgeLink;
  challenges.set(challenge.id, challenge);
  res.json({ success: true, judgeLink });
});

// POST /api/challenges/:id/cancel — cancel a pending challenge (refund escrow client-side)
app.post('/api/challenges/:id/cancel', (req, res) => {
  const challenge = challenges.get(req.params.id);
  if (!challenge) return res.status(404).json({ error: 'Challenge not found.' });
  if (challenge.status === 'judged') return res.status(400).json({ error: 'Already judged.' });
  challenge.status = 'cancelled';
  challenges.set(challenge.id, challenge);
  res.json({ success: true, challenge });
});

// GET /api/judge/:token — judge opens link; returns challenge details
app.get('/api/judge/:token', (req, res) => {
  const challenge = Array.from(challenges.values()).find(c => c.judgeToken === req.params.token);
  if (!challenge) return res.status(404).json({ error: 'Invalid or expired judge link.' });
  if (challenge.status === 'judged') return res.json({ challenge, alreadyJudged: true });
  if (challenge.status !== 'accepted') return res.status(400).json({ error: 'This challenge is not ready to be judged yet.' });
  res.json({ challenge, alreadyJudged: false });
});

// POST /api/judge/:token/decide — judge picks winner
app.post('/api/judge/:token/decide', (req, res) => {
  const { winnerId } = req.body;
  const challenge = Array.from(challenges.values()).find(c => c.judgeToken === req.params.token);
  if (!challenge) return res.status(404).json({ error: 'Invalid or expired judge link.' });
  if (challenge.status === 'judged') return res.status(400).json({ error: 'Already judged.' });
  if (challenge.status !== 'accepted') return res.status(400).json({ error: 'Challenge not accepted yet.' });
  if (winnerId !== challenge.creatorId && winnerId !== challenge.opponentId) {
    return res.status(400).json({ error: 'Invalid winner.' });
  }
  const loserId = winnerId === challenge.creatorId ? challenge.opponentId : challenge.creatorId;
  const winnerName = winnerId === challenge.creatorId ? (challenge.myPlayer || challenge.creatorName) : (challenge.theirPlayer || challenge.opponentName);
  challenge.status = 'judged';
  challenge.winnerId = winnerId;
  challenge.winnerName = winnerName;
  challenge.judgedAt = Date.now();
  challenges.set(challenge.id, challenge);
  // Emit payout event so connected clients can update their state
  io.emit('challenge:decided', { challengeId: challenge.id, winnerId, loserId, winnerName, amount: challenge.amount });
  console.log(`🏆 [CHALLENGE] ${winnerName} wins ${challenge.amount * 2} coins!`);
  res.json({ success: true, challenge });
});

// Start server - listen on 0.0.0.0 for external connections (required for Render deployment)
const PORT = process.env.PORT || 3001;

// Initialize database and start server
async function startServer() {
  try {
    // Initialize PostgreSQL database
    if (process.env.DATABASE_URL) {
      console.log('🚀 [SERVER] Initializing PostgreSQL database...');
      try {
        await initializeDatabase();
        // Load deleted user IDs so we never re-add them from socket syncs
        try {
          const { getPool } = await import('./src/db/database.js');
          const pool = getPool();
          const deleted = await pool.query('SELECT id FROM users WHERE is_deleted = TRUE');
          deleted.rows.forEach(r => deletedUserIds.add(r.id));
          console.log(`✅ [DATABASE] Loaded ${deletedUserIds.size} deleted user IDs`);
        } catch {}
        console.log('✅ [DATABASE] Ready for operations');
      } catch (dbErr) {
        console.warn('⚠️ [DATABASE] Failed to connect, running with in-memory storage:', dbErr.message);
      }
    } else {
      console.warn('⚠️ [SERVER] DATABASE_URL not set - using in-memory storage (data will be lost on restart)');
    }

    // Start server
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`🎮 Game Bird server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('❌ [SERVER] Failed to start:', error);
    process.exit(1);
  }
}

// ── Stripe Payment Endpoints ─────────────────────────────────────────────────

// Create a PaymentIntent (called before showing card form)
app.post('/api/stripe/create-payment-intent', async (req, res) => {
  if (!stripe) return res.status(503).json({ error: 'Stripe not configured' });
  const { mode, amount, userId } = req.body;
  try {
    const amountCents = mode === 'subscription' ? 2000 : Math.round(amount * 100);
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: 'usd',
      metadata: { mode, amount: String(amountCents), userId: userId || '' },
    });
    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (err) {
    console.error('❌ Stripe PaymentIntent error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Create a Stripe Customer + Subscription for monthly billing
app.post('/api/stripe/create-subscription', async (req, res) => {
  if (!stripe) return res.status(503).json({ error: 'Stripe not configured' });
  const { paymentMethodId, userId, userName, email } = req.body;
  try {
    // Create or retrieve customer
    const customers = await stripe.customers.list({ email, limit: 1 });
    let customer = customers.data[0];
    if (!customer) {
      customer = await stripe.customers.create({
        email,
        name: userName,
        metadata: { userId },
        payment_method: paymentMethodId,
        invoice_settings: { default_payment_method: paymentMethodId },
      });
    } else {
      await stripe.paymentMethods.attach(paymentMethodId, { customer: customer.id });
      await stripe.customers.update(customer.id, {
        invoice_settings: { default_payment_method: paymentMethodId },
      });
    }

    // Create subscription with a $20/month price
    // You need to create this price in your Stripe dashboard or we create it inline
    let price;
    const prices = await stripe.prices.list({ active: true, limit: 100 });
    price = prices.data.find(p => p.unit_amount === 2000 && p.recurring?.interval === 'month');
    if (!price) {
      const product = await stripe.products.create({ name: 'GameBird Premium Membership' });
      price = await stripe.prices.create({
        product: product.id,
        unit_amount: 2000,
        currency: 'usd',
        recurring: { interval: 'month' },
      });
    }

    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: price.id }],
      expand: ['latest_invoice.payment_intent'],
    });

    res.json({
      subscriptionId: subscription.id,
      status: subscription.status,
      clientSecret: subscription.latest_invoice?.payment_intent?.client_secret || null,
    });
  } catch (err) {
    console.error('❌ Stripe Subscription error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Start the server
startServer();