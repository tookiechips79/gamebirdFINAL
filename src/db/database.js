import pg from 'pg';
import bcrypt from 'bcryptjs';
const { Pool } = pg;

const BCRYPT_ROUNDS = 10;
// bcrypt hashes always start with $2a$/$2b$/$2y$ — used to tell a hash apart from
// a plaintext value left over from before hashing was introduced.
const isBcryptHash = (v) => typeof v === 'string' && /^\$2[aby]\$/.test(v);

async function hashCredential(value) {
  if (!value) return null;
  return bcrypt.hash(value, BCRYPT_ROUNDS);
}

// Compares a plaintext guess against a stored value that may be a bcrypt hash
// (new accounts) or legacy plaintext (accounts created before hashing shipped).
async function credentialMatches(plain, stored) {
  if (!stored) return false;
  if (isBcryptHash(stored)) return bcrypt.compare(plain, stored);
  return plain === stored;
}

let pool = null;

function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    });
  }
  return pool;
}

// ─────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────
export async function initializeDatabase() {
  const db = getPool();
  await db.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      password TEXT,
      pin TEXT,
      is_admin BOOLEAN DEFAULT FALSE,
      wins INTEGER DEFAULT 0,
      losses INTEGER DEFAULT 0,
      tips_given INTEGER DEFAULT 0,
      tips_received INTEGER DEFAULT 0,
      membership_status TEXT DEFAULT 'free',
      subscription_date BIGINT,
      created_at BIGINT DEFAULT EXTRACT(EPOCH FROM NOW()) * 1000,
      is_deleted BOOLEAN DEFAULT FALSE
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      amount INTEGER NOT NULL,
      description TEXT DEFAULT '',
      timestamp BIGINT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS game_history (
      game_id TEXT PRIMARY KEY,
      arena_id TEXT NOT NULL DEFAULT 'default',
      game_number INTEGER NOT NULL,
      timestamp BIGINT NOT NULL,
      team_a_name TEXT,
      team_b_name TEXT,
      team_a_score INTEGER DEFAULT 0,
      team_b_score INTEGER DEFAULT 0,
      team_a_balls INTEGER DEFAULT 0,
      team_b_balls INTEGER DEFAULT 0,
      winning_team TEXT,
      bets JSONB DEFAULT '{}',
      total_amount INTEGER DEFAULT 0,
      duration INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS bet_receipts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      user_name TEXT,
      arena_id TEXT DEFAULT 'default',
      game_number INTEGER,
      team_side TEXT,
      team_name TEXT,
      opponent_name TEXT,
      winning_team TEXT,
      team_a_name TEXT,
      team_b_name TEXT,
      team_a_score INTEGER DEFAULT 0,
      team_b_score INTEGER DEFAULT 0,
      bet_amount INTEGER DEFAULT 0,
      won BOOLEAN DEFAULT FALSE,
      duration INTEGER DEFAULT 0,
      timestamp BIGINT,
      transaction_type TEXT DEFAULT 'bet'
    );

    CREATE TABLE IF NOT EXISTS coin_drift_log (
      id TEXT PRIMARY KEY,
      timestamp BIGINT NOT NULL,
      expected INTEGER NOT NULL,
      actual INTEGER NOT NULL,
      drift INTEGER NOT NULL,
      trigger TEXT NOT NULL,
      acknowledged BOOLEAN DEFAULT FALSE
    );

    CREATE TABLE IF NOT EXISTS admin_audit_log (
      id TEXT PRIMARY KEY,
      timestamp BIGINT NOT NULL,
      type TEXT NOT NULL,
      description TEXT NOT NULL,
      amount INTEGER DEFAULT 0,
      user_name TEXT,
      from_user_name TEXT,
      to_user_name TEXT,
      balance_before INTEGER,
      balance_after INTEGER
    );

    CREATE TABLE IF NOT EXISTS game_balance_snapshots (
      id TEXT PRIMARY KEY,
      game_number INTEGER NOT NULL,
      timestamp BIGINT NOT NULL,
      winning_team TEXT NOT NULL,
      total_before INTEGER NOT NULL,
      total_after INTEGER NOT NULL,
      players JSONB NOT NULL DEFAULT '[]'
    );
  `);
  // Add is_deleted column to existing DBs that don't have it yet
  await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE`);
  // Add pin column and relax password NOT NULL for existing DBs (credential login support)
  await db.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS pin TEXT`);
  await db.query(`ALTER TABLE users ALTER COLUMN password DROP NOT NULL`);
  console.log('✅ [DB] All tables initialized');
}

// ─────────────────────────────────────────────
// USERS
// ─────────────────────────────────────────────
export async function createOrUpdateUser(name, password, initialCredits = 0, isAdmin = false, pin = null, explicitId = null) {
  const db = getPool();
  const id = explicitId || `user_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  try {
    const [passwordHash, pinHash] = await Promise.all([hashCredential(password), hashCredential(pin)]);
    const result = await db.query(
      `INSERT INTO users (id, name, password, pin, is_admin) VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (name) DO NOTHING RETURNING *`,
      [id, name, passwordHash, pinHash, isAdmin]
    );
    if (!result.rows[0]) return null; // already exists
    const user = result.rows[0];
    if (initialCredits > 0) {
      await addTransaction(user.id, 'admin_add', initialCredits, 'Initial credits');
    }
    return { id: user.id, name: user.name, credits: initialCredits, wins: 0, losses: 0, isAdmin };
  } catch (err) {
    console.error('[DB] createOrUpdateUser error:', err.message);
    return null;
  }
}

export async function getUserById(userId) {
  const db = getPool();
  const r = await db.query('SELECT * FROM users WHERE id = $1', [userId]);
  return r.rows[0] || null;
}

export async function authenticateUser(name, password) {
  const db = getPool();
  const r = await db.query('SELECT * FROM users WHERE name = $1', [name]);
  const user = r.rows[0];
  if (!user) return null;
  return (await credentialMatches(password, user.password)) ? user : null;
}

export async function authenticateUserByPin(name, pin) {
  const db = getPool();
  const r = await db.query('SELECT * FROM users WHERE name = $1', [name]);
  const user = r.rows[0];
  if (!user) return null;
  return (await credentialMatches(pin, user.pin)) ? user : null;
}

export async function getUserByName(name) {
  const db = getPool();
  const r = await db.query('SELECT * FROM users WHERE name = $1 AND is_deleted = FALSE', [name]);
  return r.rows[0] || null;
}

export async function setUserPin(userId, pin) {
  const db = getPool();
  const hash = await hashCredential(pin);
  await db.query('UPDATE users SET pin = $1 WHERE id = $2', [hash, userId]);
}

export async function setUserPassword(userId, password) {
  const db = getPool();
  const hash = await hashCredential(password);
  await db.query('UPDATE users SET password = $1 WHERE id = $2', [hash, userId]);
}

// Exported so server.js can verify a currentCredential against a stored pin/password
// (which may be bcrypt-hashed or legacy plaintext) without duplicating the compare logic.
export { credentialMatches };

export async function getAllUsers() {
  const db = getPool();
  const r = await db.query('SELECT * FROM users WHERE is_deleted = FALSE ORDER BY created_at ASC');
  return r.rows;
}

export async function upsertUserFromSocket(id, name, isAdmin = false) {
  const db = getPool();
  try {
    // Never re-add a deleted user
    const deletedCheck = await db.query('SELECT id FROM users WHERE (id = $1 OR name = $2) AND is_deleted = TRUE', [id, name]);
    if (deletedCheck.rows.length > 0) return;

    // If same name exists under a different ID, update that row to use the new ID
    const existing = await db.query('SELECT id FROM users WHERE name = $1 AND is_deleted = FALSE', [name]);
    if (existing.rows.length > 0 && existing.rows[0].id !== id) {
      await db.query('UPDATE users SET id = $1, is_admin = $2 WHERE name = $3', [id, isAdmin, name]);
    } else {
      await db.query(
        `INSERT INTO users (id, name, password, is_admin) VALUES ($1, $2, '__socket__', $3)
         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`,
        [id, name, isAdmin]
      );
    }
  } catch (err) {
    console.error('[DB] upsertUserFromSocket error:', err.message);
  }
}

export async function updateUserStats(userId, wins, losses) {
  const db = getPool();
  await db.query('UPDATE users SET wins = $1, losses = $2 WHERE id = $3', [wins, losses, userId]);
}

export async function updateUserMembership(userId, status) {
  const db = getPool();
  await db.query('UPDATE users SET membership_status = $1 WHERE id = $2', [status, userId]);
}

export async function setUserAdminStatus(userId, isAdmin) {
  const db = getPool();
  await db.query('UPDATE users SET is_admin = $1 WHERE id = $2', [isAdmin, userId]);
}

export async function deleteUser(userId) {
  const db = getPool();
  // Soft delete — marks as deleted so syncs never re-add this user
  await db.query('UPDATE users SET is_deleted = TRUE WHERE id = $1', [userId]);
}

// ─────────────────────────────────────────────
// TRANSACTIONS / CREDITS
// ─────────────────────────────────────────────
export async function addTransaction(userId, type, amount, description = '') {
  const db = getPool();
  const id = `tx_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  try {
    await db.query(
      'INSERT INTO transactions (id, user_id, type, amount, description, timestamp) VALUES ($1, $2, $3, $4, $5, $6)',
      [id, userId, type, amount, description, Date.now()]
    );
    return { id, userId, type, amount, description, timestamp: Date.now() };
  } catch (err) {
    console.error('[DB] addTransaction error:', err.message);
    return null;
  }
}

export async function getUserBalance(userId) {
  const db = getPool();
  const r = await db.query(
    'SELECT COALESCE(SUM(amount), 0) as balance FROM transactions WHERE user_id = $1',
    [userId]
  );
  return parseInt(r.rows[0]?.balance ?? 0);
}

export async function getUserTransactionHistory(userId) {
  const db = getPool();
  const r = await db.query(
    'SELECT * FROM transactions WHERE user_id = $1 ORDER BY timestamp DESC LIMIT 200',
    [userId]
  );
  return r.rows;
}

export function getDatabaseStats() {
  return { connected: !!pool };
}

// ─────────────────────────────────────────────
// GAME HISTORY
// ─────────────────────────────────────────────
export async function addGameHistory(record) {
  const db = getPool();
  const id = record.id || `game_${Date.now()}`;
  try {
    const r = await db.query(
      `INSERT INTO game_history
         (game_id, arena_id, game_number, timestamp, team_a_name, team_b_name,
          team_a_score, team_b_score, team_a_balls, team_b_balls,
          winning_team, bets, total_amount, duration)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       ON CONFLICT (game_id) DO NOTHING RETURNING *`,
      [
        id,
        record.arenaId || 'default',
        record.gameNumber,
        record.timestamp || Date.now(),
        record.teamAName,
        record.teamBName,
        record.teamAScore || 0,
        record.teamBScore || 0,
        record.teamABalls || 0,
        record.teamBBalls || 0,
        record.winningTeam,
        JSON.stringify(record.bets || {}),
        record.totalAmount || 0,
        record.duration || 0,
      ]
    );
    return r.rows[0] ? mapGameRow(r.rows[0]) : null;
  } catch (err) {
    console.error('[DB] addGameHistory error:', err.message);
    return null;
  }
}

export async function getGameHistory(arenaId = 'default', limit = 100) {
  const db = getPool();
  const r = await db.query(
    'SELECT * FROM game_history WHERE arena_id = $1 ORDER BY game_number DESC LIMIT $2',
    [arenaId, limit]
  );
  return r.rows.map(mapGameRow);
}

export async function clearGameHistory(arenaId = 'default') {
  const db = getPool();
  const r = await db.query('DELETE FROM game_history WHERE arena_id = $1', [arenaId]);
  return r.rowCount;
}

function mapGameRow(row) {
  return {
    game_id: row.game_id,
    id: row.game_id,
    arena_id: row.arena_id,
    arenaId: row.arena_id,
    game_number: row.game_number,
    gameNumber: row.game_number,
    timestamp: Number(row.timestamp),
    teamAName: row.team_a_name,
    teamBName: row.team_b_name,
    teamAScore: row.team_a_score,
    teamBScore: row.team_b_score,
    teamABalls: row.team_a_balls,
    teamBBalls: row.team_b_balls,
    winningTeam: row.winning_team,
    bets: typeof row.bets === 'string' ? JSON.parse(row.bets) : row.bets,
    totalAmount: row.total_amount,
    duration: row.duration,
  };
}

// ─────────────────────────────────────────────
// BET RECEIPTS
// ─────────────────────────────────────────────
export async function addBetReceipt(receipt) {
  const db = getPool();
  try {
    const r = await db.query(
      `INSERT INTO bet_receipts
         (id, user_id, user_name, arena_id, game_number, team_side, team_name,
          opponent_name, winning_team, team_a_name, team_b_name,
          team_a_score, team_b_score, bet_amount, won, duration, timestamp, transaction_type)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
       ON CONFLICT (id) DO NOTHING RETURNING *`,
      [
        receipt.id,
        receipt.userId,
        receipt.userName,
        receipt.arenaId || 'default',
        receipt.gameNumber,
        receipt.teamSide,
        receipt.teamName,
        receipt.opponentName,
        receipt.winningTeam,
        receipt.teamAName,
        receipt.teamBName,
        receipt.teamAScore || 0,
        receipt.teamBScore || 0,
        receipt.amount || 0,
        receipt.won || false,
        receipt.duration || 0,
        receipt.timestamp,
        receipt.transactionType || 'bet',
      ]
    );
    return r.rows[0] || null;
  } catch (err) {
    console.error('[DB] addBetReceipt error:', err.message);
    return null;
  }
}

export async function getBetReceipts(userId, arenaId = 'default', limit = 250) {
  const db = getPool();
  const r = await db.query(
    'SELECT * FROM bet_receipts WHERE user_id = $1 AND arena_id = $2 ORDER BY timestamp DESC LIMIT $3',
    [userId, arenaId, limit]
  );
  return r.rows;
}

export async function getArenaAllBetReceipts(arenaId = 'default', limit = 250) {
  const db = getPool();
  const r = await db.query(
    'SELECT * FROM bet_receipts WHERE arena_id = $1 ORDER BY timestamp DESC LIMIT $2',
    [arenaId, limit]
  );
  return r.rows;
}

export async function clearUserBetReceipts(userId) {
  const db = getPool();
  const r = await db.query('DELETE FROM bet_receipts WHERE user_id = $1', [userId]);
  return r.rowCount;
}

// ─────────────────────────────────────────────
// COIN DRIFT LOG
// ─────────────────────────────────────────────
export async function addDriftEntry(entry) {
  const db = getPool();
  try {
    await db.query(
      `INSERT INTO coin_drift_log (id, timestamp, expected, actual, drift, trigger, acknowledged)
       VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO NOTHING`,
      [entry.id, entry.timestamp, entry.expected, entry.actual, entry.drift, entry.trigger, entry.acknowledged ?? false]
    );
  } catch (err) {
    console.error('[DB] addDriftEntry error:', err.message);
  }
}

export async function getDriftLog() {
  const db = getPool();
  const r = await db.query('SELECT * FROM coin_drift_log ORDER BY timestamp DESC LIMIT 500');
  return r.rows.map(row => ({
    id: row.id,
    timestamp: Number(row.timestamp),
    expected: row.expected,
    actual: row.actual,
    drift: row.drift,
    trigger: row.trigger,
    acknowledged: row.acknowledged,
  }));
}

export async function acknowledgeDrift(id) {
  const db = getPool();
  await db.query('UPDATE coin_drift_log SET acknowledged = TRUE WHERE id = $1', [id]);
}

export async function clearDriftLog() {
  const db = getPool();
  await db.query('DELETE FROM coin_drift_log');
}

// ─────────────────────────────────────────────
// ADMIN AUDIT LOG
// ─────────────────────────────────────────────
export async function addAdminAuditEvent(event) {
  const db = getPool();
  try {
    await db.query(
      `INSERT INTO admin_audit_log
         (id, timestamp, type, description, amount, user_name, from_user_name, to_user_name, balance_before, balance_after)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT (id) DO NOTHING`,
      [
        event.id,
        event.timestamp,
        event.type,
        event.description,
        event.amount ?? 0,
        event.userName ?? null,
        event.fromUserName ?? null,
        event.toUserName ?? null,
        event.balanceBefore ?? null,
        event.balanceAfter ?? null,
      ]
    );
  } catch (err) {
    console.error('[DB] addAdminAuditEvent error:', err.message);
  }
}

export async function getAdminAuditLog() {
  const db = getPool();
  const r = await db.query('SELECT * FROM admin_audit_log ORDER BY timestamp DESC LIMIT 1000');
  return r.rows.map(row => ({
    id: row.id,
    timestamp: Number(row.timestamp),
    type: row.type,
    description: row.description,
    amount: row.amount,
    userName: row.user_name,
    fromUserName: row.from_user_name,
    toUserName: row.to_user_name,
    balanceBefore: row.balance_before,
    balanceAfter: row.balance_after,
  }));
}

export async function clearAdminAuditLog() {
  const db = getPool();
  await db.query('DELETE FROM admin_audit_log');
}

// ─────────────────────────────────────────────
// GAME BALANCE SNAPSHOTS
// ─────────────────────────────────────────────
export async function addGameSnapshot(snap) {
  const db = getPool();
  try {
    await db.query(
      `INSERT INTO game_balance_snapshots (id, game_number, timestamp, winning_team, total_before, total_after, players)
       VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO NOTHING`,
      [snap.id, snap.gameNumber, snap.timestamp, snap.winningTeam, snap.totalBefore, snap.totalAfter, JSON.stringify(snap.players)]
    );
  } catch (err) {
    console.error('[DB] addGameSnapshot error:', err.message);
  }
}

export async function getGameSnapshots() {
  const db = getPool();
  const r = await db.query('SELECT * FROM game_balance_snapshots ORDER BY game_number DESC LIMIT 500');
  return r.rows.map(row => ({
    id: row.id,
    gameNumber: row.game_number,
    timestamp: Number(row.timestamp),
    winningTeam: row.winning_team,
    totalBefore: row.total_before,
    totalAfter: row.total_after,
    players: typeof row.players === 'string' ? JSON.parse(row.players) : row.players,
  }));
}

export async function clearGameSnapshots() {
  const db = getPool();
  await db.query('DELETE FROM game_balance_snapshots');
}

export { getPool };
