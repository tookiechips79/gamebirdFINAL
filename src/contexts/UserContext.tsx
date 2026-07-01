import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { User, PendingBet, Transaction, TransactionType, Membership, MembershipTier, CoinAuditEntry, GameBalanceSnapshot, PlayerBalanceSnap, AdminAuditEvent, AdminAuditEventType, Challenge } from '@/types';
import { io, Socket } from 'socket.io-client';

function makeTx(type: TransactionType, amount: number, description: string): Transaction {
  return { id: `tx_${Date.now()}_${Math.random().toString(36).slice(2,7)}`, type, amount, description, timestamp: Date.now() };
}

function appendTx(user: User, tx: Transaction): User {
  return { ...user, transactions: [tx, ...(user.transactions ?? [])].slice(0, 500) };
}

interface UserContextType {
  users: User[];
  currentUser: User | null;
  currentUserId: string | null;
  setCurrentUser: (user: User | null) => void;
  claimUserSession: (userId: string) => Promise<{ success: boolean; error?: string; alreadyActive?: boolean }>;
  userKickedMessage: string | null;
  clearUserKickedMessage: () => void;
  addUser: (name: string, isAdmin?: boolean, initialCredits?: number, pin?: string, referredBy?: string) => User;
  setPin: (userId: string, pin: string) => void;
  renameUser: (userId: string, name: string) => void;
  deleteUser: (userId: string) => void;
  getUserById: (id: string) => User | undefined;
  deductCredits: (userId: string, amount: number, pendingBet: PendingBet) => boolean;
  addCredits: (userId: string, amount: number, type?: TransactionType, description?: string) => void;
  refundBet: (userId: string, betId: string, amount: number) => void;
  recordTip: (fromId: string, toId: string, amount: number) => void;
  transferCredits: (fromId: string, toUsername: string, amount: number) => { success: boolean; error?: string };
  clearPendingBetsForGame: (gameNumber: number, payouts: { userId: string; amount: number }[], allAffectedIds?: Set<string>) => void;
  updateMembership: (userId: string, membership: Membership | null) => void;
  requestAllUsers: () => void;
  mergeServerUsers: (serverUsers: any[], deletedIds?: string[]) => void;
  coinAuditLog: CoinAuditEntry[];
  acknowledgeAudit: (id: string) => void;
  clearAuditLog: () => void;
  gameSnapshots: GameBalanceSnapshot[];
  clearSnapshots: () => void;
  recordGameSnapshot: (snap: GameBalanceSnapshot) => void;
  playerSnaps: PlayerBalanceSnap[];
  recordPlayerSnap: (snap: PlayerBalanceSnap) => void;
  clearPlayerSnaps: () => void;
  adminAuditLog: AdminAuditEvent[];
  clearAdminAudit: () => void;
  challenges: Challenge[];
  createChallenge: (opponentUsername: string, amount: number, judgePhone: string, myPlayer: string, theirPlayer: string, betType?: 'game' | 'match') => Promise<{ success: boolean; error?: string; judgeLink?: string }>;
  acceptChallenge: (challengeId: string) => Promise<{ success: boolean; error?: string; judgeLink?: string }>;
  cancelChallenge: (challengeId: string) => Promise<{ success: boolean; error?: string }>;
  payoutChallenge: (challengeId: string, winnerId: string, winnerName: string) => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

const STORAGE_KEY = 'gb_users';
const AUDIT_KEY = 'gb_coin_audit';
const EXPECTED_KEY = 'gb_expected_total';
const SNAPSHOTS_KEY = 'gb_game_snapshots';
const PLAYER_SNAPS_KEY = 'gb_player_snaps';
const ADMIN_AUDIT_KEY = 'gb_admin_audit';
const CHALLENGES_KEY = 'gb_challenges';

const SERVER_URL = window.location.hostname === 'localhost'
  ? 'http://localhost:3001'
  : 'https://gamebird-app-production.up.railway.app';

async function serverGet<T>(path: string): Promise<T | null> {
  try {
    const r = await fetch(`${SERVER_URL}${path}`);
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

async function serverPost(path: string, body: unknown) {
  try { await fetch(`${SERVER_URL}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); } catch {}
}

// Retries a critical credit-affecting POST once on failure. If both attempts fail,
// invokes onFailure so the caller can surface a visible alert instead of a silent
// gap between local (optimistic) state and the DB.
async function postCritical(path: string, body: unknown, onFailure: (path: string, body: unknown, error: string) => void): Promise<boolean> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const r = await fetch(`${SERVER_URL}${path}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      if (r.ok) return true;
      if (attempt === 1) onFailure(path, body, `HTTP ${r.status}`);
    } catch (e: any) {
      if (attempt === 1) onFailure(path, body, e?.message ?? 'Network error');
    }
    if (attempt === 0) await new Promise(r => setTimeout(r, 600));
  }
  return false;
}

async function serverPut(path: string) {
  try { await fetch(`${SERVER_URL}${path}`, { method: 'PUT' }); } catch {}
}

async function serverDelete(path: string) {
  try { await fetch(`${SERVER_URL}${path}`, { method: 'DELETE' }); } catch {}
}

function loadAuditLog(): CoinAuditEntry[] {
  try { const s = localStorage.getItem(AUDIT_KEY); if (s) return JSON.parse(s); } catch {}
  return [];
}

function saveAuditLog(log: CoinAuditEntry[]) {
  try { localStorage.setItem(AUDIT_KEY, JSON.stringify(log)); } catch {}
}

function loadSnapshots(): GameBalanceSnapshot[] {
  try { const s = localStorage.getItem(SNAPSHOTS_KEY); if (s) return JSON.parse(s); } catch {}
  return [];
}

function saveSnapshots(snaps: GameBalanceSnapshot[]) {
  try { localStorage.setItem(SNAPSHOTS_KEY, JSON.stringify(snaps)); } catch {}
}

function loadPlayerSnaps(): PlayerBalanceSnap[] {
  try { const s = localStorage.getItem(PLAYER_SNAPS_KEY); if (s) return JSON.parse(s); } catch {}
  return [];
}
function savePlayerSnaps(snaps: PlayerBalanceSnap[]) {
  try { localStorage.setItem(PLAYER_SNAPS_KEY, JSON.stringify(snaps)); } catch {}
}

function loadAdminAudit(): AdminAuditEvent[] {
  try { const s = localStorage.getItem(ADMIN_AUDIT_KEY); if (s) return JSON.parse(s); } catch {}
  return [];
}

function loadChallenges(): Challenge[] {
  try { const s = localStorage.getItem(CHALLENGES_KEY); if (s) return JSON.parse(s); } catch {}
  return [];
}

function saveChallenges(c: Challenge[]) {
  try { localStorage.setItem(CHALLENGES_KEY, JSON.stringify(c)); } catch {}
}

function saveAdminAudit(log: AdminAuditEvent[]) {
  try { localStorage.setItem(ADMIN_AUDIT_KEY, JSON.stringify(log)); } catch {}
}

const defaultUsers: User[] = [
  { id: 'admin', name: 'Admin', credits: 99999, isAdmin: true, pendingBets: [] },
  { id: 'user1', name: 'Player 1', credits: 1000, pendingBets: [] },
  { id: 'user2', name: 'Player 2', credits: 1000, pendingBets: [] },
];

function loadUsers(): User[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return defaultUsers;
}

export function UserProvider({ children }: { children: ReactNode }) {
  const [users, setUsers] = useState<User[]>(loadUsers);
  const [currentUserId, setCurrentUserId] = useState<string | null>(() => {
    try {
      // sessionStorage is cleared on new tab/window — require fresh login
      const hasSession = sessionStorage.getItem('gb_session_active');
      if (!hasSession) return null;
      return localStorage.getItem('gb_current_user_id') || null;
    } catch { return null; }
  });
  const serverDeletedIdsRef = useRef<Set<string>>(new Set());
  const [userKickedMessage, setUserKickedMessage] = useState<string | null>(null);
  const clearUserKickedMessage = () => setUserKickedMessage(null);
  const [coinAuditLog, setCoinAuditLog] = useState<CoinAuditEntry[]>(loadAuditLog);
  const [gameSnapshots, setGameSnapshots] = useState<GameBalanceSnapshot[]>(loadSnapshots);
  const snapshotsRef = useRef(gameSnapshots);
  useEffect(() => { snapshotsRef.current = gameSnapshots; }, [gameSnapshots]);

  const [playerSnaps, setPlayerSnaps] = useState<PlayerBalanceSnap[]>(loadPlayerSnaps);
  const playerSnapsRef = useRef(playerSnaps);
  useEffect(() => { playerSnapsRef.current = playerSnaps; }, [playerSnaps]);

  const [adminAuditLog, setAdminAuditLog] = useState<AdminAuditEvent[]>(loadAdminAudit);
  const adminAuditRef = useRef(adminAuditLog);
  useEffect(() => { adminAuditRef.current = adminAuditLog; }, [adminAuditLog]);

  // On mount: pull all three audit logs from server and replace local state
  useEffect(() => {
    (async () => {
      const [drift, activity, snapshots] = await Promise.all([
        serverGet<CoinAuditEntry[]>('/api/audit/drift'),
        serverGet<AdminAuditEvent[]>('/api/audit/activity'),
        serverGet<GameBalanceSnapshot[]>('/api/audit/snapshots'),
      ]);
      if (drift) { saveAuditLog(drift); setCoinAuditLog(drift); }
      if (activity) { saveAdminAudit(activity); setAdminAuditLog(activity); adminAuditRef.current = activity; }
      if (snapshots) { saveSnapshots(snapshots); setGameSnapshots(snapshots); snapshotsRef.current = snapshots; }
    })();
  }, []);

  const logAdminEvent = (type: AdminAuditEventType, event: Omit<AdminAuditEvent, 'id' | 'timestamp' | 'type'>) => {
    const entry: AdminAuditEvent = { id: `ae_${Date.now()}_${Math.random().toString(36).slice(2,6)}`, timestamp: Date.now(), type, ...event };
    const next = [entry, ...adminAuditRef.current].slice(0, 1000);
    adminAuditRef.current = next;
    setAdminAuditLog(next);
    saveAdminAudit(next);
    serverPost('/api/audit/activity', entry);
  };

  const clearAdminAudit = () => {
    adminAuditRef.current = [];
    setAdminAuditLog([]);
    saveAdminAudit([]);
    serverDelete('/api/audit/activity');
  };

  // Surfaces a DB write that failed after retry — visible in Activity tab as ⚠ SYNC FAILED
  // instead of silently leaving local state ahead of the DB (the root cause of undetectable drift).
  const reportSyncFailure = (path: string, body: unknown, error: string) => {
    logAdminEvent('sync_failed', {
      description: `DB write failed (${error}): ${path} — ${JSON.stringify(body)}`,
      amount: 0,
    });
  };

  // ── Challenges ──
  const [challenges, setChallenges] = useState<Challenge[]>(loadChallenges);
  const challengesRef = useRef(challenges);
  useEffect(() => { challengesRef.current = challenges; }, [challenges]);

  const updateChallenges = (next: Challenge[]) => {
    setChallenges(next);
    challengesRef.current = next;
    saveChallenges(next);
  };

  // Sync challenges from server on mount
  useEffect(() => {
    serverGet<Challenge[]>('/api/challenges').then(data => {
      if (data && data.length > 0) updateChallenges(data);
    });
  }, []);

  const createChallenge = async (opponentUsername: string, amount: number, judgePhone: string, myPlayer: string, theirPlayer: string, betType: 'game' | 'match' = 'game'): Promise<{ success: boolean; error?: string; judgeLink?: string }> => {
    const current = usersRef.current.find(u => u.id === currentUserId);
    if (!current) return { success: false, error: 'No player selected.' };
    const opponent = usersRef.current.find(u => u.name.toLowerCase() === opponentUsername.toLowerCase().trim());
    if (!opponent) return { success: false, error: `Player "${opponentUsername}" not found.` };
    if (opponent.id === current.id) return { success: false, error: 'Cannot challenge yourself.' };
    if (amount <= 0 || !Number.isInteger(amount)) return { success: false, error: 'Amount must be a positive whole number.' };
    if (current.credits < amount) return { success: false, error: 'Insufficient coins.' };
    // Deduct escrow from creator immediately
    const txEscrow = makeTx('challenge_escrow', amount, `Escrow for challenge vs ${opponent.name}`);
    usersRef.current = usersRef.current.map(u => u.id === current.id ? appendTx({ ...u, credits: u.credits - amount }, txEscrow) : u);
    setUsersAndEmit(prev => prev.map(u => u.id === current.id ? appendTx({ ...u, credits: u.credits - amount }, txEscrow) : u));
    postCritical(`/api/credits/${current.id}/add`, { amount: -amount, type: 'challenge_escrow', reason: `Escrow for challenge vs ${opponent.name}` }, reportSyncFailure);
    try {
      const r = await fetch(`${SERVER_URL}/api/challenges`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ creatorId: current.id, creatorName: current.name, opponentId: opponent.id, opponentName: opponent.name, amount, judgePhone, myPlayer: myPlayer.trim() || current.name, theirPlayer: theirPlayer.trim() || opponent.name, betType }),
      });
      const data = await r.json();
      if (!data.success) throw new Error(data.error);
      updateChallenges([data.challenge, ...challengesRef.current]);
      return { success: true };
    } catch (e: any) {
      // Refund escrow if server call failed
      const txRefund = makeTx('challenge_refund', amount, `Escrow refund — challenge failed`);
      setUsersAndEmit(prev => prev.map(u => u.id === current.id ? appendTx({ ...u, credits: u.credits + amount }, txRefund) : u));
      postCritical(`/api/credits/${current.id}/add`, { amount, type: 'challenge_refund', reason: 'Escrow refund — challenge failed' }, reportSyncFailure);
      return { success: false, error: e.message ?? 'Server error.' };
    }
  };

  const acceptChallenge = async (challengeId: string): Promise<{ success: boolean; error?: string; judgeLink?: string }> => {
    const challenge = challengesRef.current.find(c => c.id === challengeId);
    if (!challenge) return { success: false, error: 'Challenge not found.' };
    const current = usersRef.current.find(u => u.id === currentUserId);
    if (!current) return { success: false, error: 'No player selected.' };
    if (current.credits < challenge.amount) return { success: false, error: 'Insufficient coins to accept.' };
    // Deduct escrow from opponent
    const txEscrow = makeTx('challenge_escrow', challenge.amount, `Escrow for challenge vs ${challenge.creatorName}`);
    setUsersAndEmit(prev => prev.map(u => u.id === current.id ? appendTx({ ...u, credits: u.credits - challenge.amount }, txEscrow) : u));
    postCritical(`/api/credits/${current.id}/add`, { amount: -challenge.amount, type: 'challenge_escrow', reason: `Escrow for challenge vs ${challenge.creatorName}` }, reportSyncFailure);
    try {
      const r = await fetch(`${SERVER_URL}/api/challenges/${challengeId}/accept`, { method: 'POST' });
      const data = await r.json();
      if (!data.success) throw new Error(data.error);
      const updatedChallenge = { ...data.challenge, judgeLink: data.judgeLink };
      updateChallenges(challengesRef.current.map(c => c.id === challengeId ? updatedChallenge : c));
      return { success: true, judgeLink: data.judgeLink };
    } catch (e: any) {
      const txRefund = makeTx('challenge_refund', challenge.amount, `Escrow refund — accept failed`);
      setUsersAndEmit(prev => prev.map(u => u.id === current.id ? appendTx({ ...u, credits: u.credits + challenge.amount }, txRefund) : u));
      postCritical(`/api/credits/${current.id}/add`, { amount: challenge.amount, type: 'challenge_refund', reason: 'Escrow refund — accept failed' }, reportSyncFailure);
      return { success: false, error: e.message ?? 'Server error.' };
    }
  };

  const cancelChallenge = async (challengeId: string): Promise<{ success: boolean; error?: string }> => {
    const challenge = challengesRef.current.find(c => c.id === challengeId);
    if (!challenge) return { success: false, error: 'Challenge not found.' };
    if (challenge.status === 'judged') return { success: false, error: 'Already judged.' };
    // Refund creator always; also refund opponent if already accepted
    const txRefund = makeTx('challenge_refund', challenge.amount, `Challenge cancelled — escrow refunded`);
    setUsersAndEmit(prev => prev.map(u => {
      if (u.id === challenge.creatorId) return appendTx({ ...u, credits: u.credits + challenge.amount }, txRefund);
      if (challenge.status === 'accepted' && u.id === challenge.opponentId) {
        return appendTx({ ...u, credits: u.credits + challenge.amount }, makeTx('challenge_refund', challenge.amount, `Challenge cancelled — escrow refunded`));
      }
      return u;
    }));
    postCritical(`/api/credits/${challenge.creatorId}/add`, { amount: challenge.amount, type: 'challenge_refund', reason: 'Challenge cancelled — escrow refunded' }, reportSyncFailure);
    if (challenge.status === 'accepted') {
      postCritical(`/api/credits/${challenge.opponentId}/add`, { amount: challenge.amount, type: 'challenge_refund', reason: 'Challenge cancelled — escrow refunded' }, reportSyncFailure);
    }
    // Update local state immediately regardless of server response
    const cancelled = { ...challenge, status: 'cancelled' as const };
    updateChallenges(challengesRef.current.map(c => c.id === challengeId ? cancelled : c));
    // Best-effort server sync
    fetch(`${SERVER_URL}/api/challenges/${challengeId}/cancel`, { method: 'POST' }).catch(() => {});
    return { success: true };
  };

  const payoutChallenge = (challengeId: string, winnerId: string, winnerName: string) => {
    const challenge = challengesRef.current.find(c => c.id === challengeId);
    if (!challenge || challenge.status === 'judged') return;
    const loserId = winnerId === challenge.creatorId ? challenge.opponentId : challenge.creatorId;
    const totalPot = challenge.amount * 2;
    const loserName = winnerId === challenge.creatorId ? challenge.opponentName : challenge.creatorName;
    const txWin = makeTx('challenge_win', totalPot, `Won challenge vs ${loserName}`);
    setUsersAndEmit(prev => prev.map(u => u.id === winnerId ? appendTx({ ...u, credits: u.credits + totalPot }, txWin) : u));
    updateChallenges(challengesRef.current.map(c => c.id === challengeId ? { ...c, status: 'judged', winnerId, winnerName, judgedAt: Date.now() } : c));
    postCritical(`/api/credits/${winnerId}/add`, { amount: totalPot, type: 'challenge_win', reason: `Won challenge vs ${loserName}` }, reportSyncFailure);
    void loserId;
  };

  // Always-fresh ref — avoids stale closure bugs in callbacks
  const usersRef = useRef(users);
  useEffect(() => { usersRef.current = users; }, [users]);

  // Track expected total — sum of all user credits + pending bets (coins in flight are still in system)
  const totalWithPending = (list: User[]) =>
    list.reduce((s, u) => s + u.credits + (u.pendingBets ?? []).reduce((ps, b) => ps + b.amount, 0), 0);

  const expectedTotalRef = useRef<number>(totalWithPending(users));
  const initialSyncDoneRef = useRef(false);
  // Track users with in-flight persistBalance writes — suppress DB credit sync for those users
  // for 3 seconds after a write fires, so a stale users:push can't overwrite the correct value
  const recentlyPersistedRef = useRef<Map<string, number>>(new Map());

  // Duplicate-submit guard for critical one-shot actions (P2P transfers). Prevents a
  // double-tap or a client-side retry from firing the same transfer twice.
  const inFlightTransferRef = useRef<Set<string>>(new Set());
  // Always recompute on load so the expected is in sync with the current formula
  useEffect(() => {
    const t = totalWithPending(users);
    expectedTotalRef.current = t;
    try { localStorage.setItem(EXPECTED_KEY, String(t)); } catch {}
  }, []);

  const auditLogRef = useRef(coinAuditLog);
  useEffect(() => { auditLogRef.current = coinAuditLog; }, [coinAuditLog]);

  const recordDrift = (trigger: string, actual: number) => {
    const expected = expectedTotalRef.current;
    const drift = actual - expected;
    if (drift === 0) return;
    // Suppress duplicate alerts — if an unacknowledged entry already exists
    // for this exact drift amount, don't flood the log with repeat entries
    const alreadyLogged = auditLogRef.current.some(e => !e.acknowledged && e.drift === drift);
    if (alreadyLogged) return;
    const entry: CoinAuditEntry = {
      id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(),
      expected,
      actual,
      drift,
      trigger,
      acknowledged: false,
    };
    const next = [entry, ...auditLogRef.current].slice(0, 200);
    auditLogRef.current = next;
    setCoinAuditLog(next);
    saveAuditLog(next);
    serverPost('/api/audit/drift', entry);
  };

  const checkDrift = (trigger: string, currentUsers: User[]) => {
    // Include pending bets — coins in pendingBets are still in the system, just held
    const actual = currentUsers.reduce((s, u) => {
      const pending = (u.pendingBets ?? []).reduce((ps, b) => ps + b.amount, 0);
      return s + u.credits + pending;
    }, 0);
    recordDrift(trigger, actual);
  };

  const setExpected = (newTotal: number) => {
    expectedTotalRef.current = newTotal;
    try { localStorage.setItem(EXPECTED_KEY, String(newTotal)); } catch {}
  };

  const acknowledgeAudit = (id: string) => {
    const next = auditLogRef.current.map(e => e.id === id ? { ...e, acknowledged: true } : e);
    auditLogRef.current = next;
    setCoinAuditLog(next);
    saveAuditLog(next);
    serverPut(`/api/audit/drift/${id}/ack`);
  };

  const clearAuditLog = () => {
    auditLogRef.current = [];
    setCoinAuditLog([]);
    saveAuditLog([]);
    serverDelete('/api/audit/drift');
  };

  const clearSnapshots = () => {
    snapshotsRef.current = [];
    setGameSnapshots([]);
    saveSnapshots([]);
    serverDelete('/api/audit/snapshots');
  };

  const recordGameSnapshot = (snap: GameBalanceSnapshot) => {
    const next = [snap, ...snapshotsRef.current].slice(0, 500);
    snapshotsRef.current = next;
    setGameSnapshots(next);
    saveSnapshots(next);
    serverPost('/api/audit/snapshots', snap);
  };

  const recordPlayerSnap = (snap: PlayerBalanceSnap) => {
    const next = [snap, ...playerSnapsRef.current].slice(0, 200);
    playerSnapsRef.current = next;
    setPlayerSnaps(next);
    savePlayerSnaps(next);
  };

  const clearPlayerSnaps = () => {
    playerSnapsRef.current = [];
    setPlayerSnaps([]);
    localStorage.removeItem(PLAYER_SNAPS_KEY);
  };

  // Socket sync
  const socketRef = useRef<Socket | null>(null);
  const suppressEmitRef = useRef(false);

  useEffect(() => {
    const serverUrl = window.location.hostname === 'localhost'
      ? `http://localhost:3001`
      : 'https://gamebird-app-production.up.railway.app';
    const socket = io(serverUrl, { transports: ['polling'], upgrade: false });
    socketRef.current = socket;

    socket.on('users:state', (incoming: User[]) => {
      if (!Array.isArray(incoming) || incoming.length === 0) return;
      suppressEmitRef.current = true;
      // Merge: keep existing local users as-is, add any new users from server
      const merged = [...usersRef.current];
      incoming.forEach(u => {
        if (!merged.find(m => m.id === u.id)) merged.push(u);
      });
      usersRef.current = merged;
      setUsers(merged);
      suppressEmitRef.current = false;
    });

    // Server asks all clients to re-push their user list (triggered by admin opening User Manager)
    socket.on('users:push', () => {
      const toEmit = usersRef.current
        .filter(u => !serverDeletedIdsRef.current.has(u.id))
        .map(({ id, name, isAdmin, online }) => ({ id, name, isAdmin, online }));
      if (toEmit.length > 0) socket.emit('users:update', toEmit);
      fetchAndMergeFromServer();
    });

    socket.on('user:deleted', (userId: string) => {
      serverDeletedIdsRef.current.add(userId);
      usersRef.current = usersRef.current.filter(u => u.id !== userId);
      setUsers(prev => prev.filter(u => u.id !== userId));
      if (currentUserId === userId) setCurrentUserId(null);
    });

    socket.on('challenge:new', (challenge: Challenge) => {
      if (!challengesRef.current.find(c => c.id === challenge.id)) {
        updateChallenges([challenge, ...challengesRef.current]);
      }
    });

    socket.on('challenge:decided', ({ challengeId, winnerId, winnerName }: { challengeId: string; winnerId: string; loserId: string; winnerName: string; amount: number }) => {
      const ch = challengesRef.current.find(c => c.id === challengeId);
      if (ch && ch.status !== 'judged') {
        payoutChallenge(challengeId, winnerId, winnerName);
      }
    });

    // Real-time receipt delivery for the receiving end of a P2P transfer
    socket.on('transfer:receipt', ({ fromId, toId, amount, fromName, toName, timestamp }: {
      fromId: string; toId: string; amount: number; fromName: string; toName: string; timestamp: number;
    }) => {
      const myId = usersRef.current.find(u => u.id === currentUserId)?.id ?? localStorage.getItem('gb_current_user_id');
      if (myId !== toId && myId !== fromId) return;
      const txType = myId === toId ? 'transfer_received' : 'transfer_sent';
      const desc   = myId === toId ? `P2P transfer from ${fromName}` : `P2P transfer to ${toName}`;
      const tx: import('@/types').Transaction = { id: `tx_${timestamp}_${txType}`, type: txType, amount, description: desc, timestamp };
      usersRef.current = usersRef.current.map(u =>
        u.id === myId ? appendTx(u, tx) : u
      );
      setUsers(prev => prev.map(u => u.id === myId ? appendTx(u, tx) : u));
    });

    return () => { socket.disconnect(); };
  }, []);

  // Wraps setUsers: every mutation also broadcasts to other clients
  const setUsersAndEmit = (updater: User[] | ((prev: User[]) => User[])) => {
    setUsers(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      if (!suppressEmitRef.current && socketRef.current?.connected) {
        // Only send identity — credits and membership are DB-authoritative and must never flow client→server
        const safe = next.map(({ id, name, isAdmin, online }) => ({ id, name, isAdmin, online }));
        socketRef.current.emit('users:update', safe);
      }
      return next;
    });
  };

  // Persist on change
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(users)); } catch {}
  }, [users]);

  useEffect(() => {
    try {
      if (currentUserId) localStorage.setItem('gb_current_user_id', currentUserId);
      else localStorage.removeItem('gb_current_user_id');
    } catch {}
  }, [currentUserId]);

  // Derive currentUser from ID so it's always in sync with latest users
  const currentUser = users.find(u => u.id === currentUserId) ?? null;
  const fetchAndMergeFromServer = () => {
    fetch(`${SERVER_URL}/api/users`)
      .then(r => r.json())
      .then((data: any) => {
        const serverUsers: any[] = Array.isArray(data) ? data : (data?.users ?? []);
        const deletedIds: string[] = Array.isArray(data?.deletedIds) ? data.deletedIds : [];
        mergeServerUsers(serverUsers, deletedIds);
      })
      .catch(() => {});
  };

  const setCurrentUser = (user: User | null) => {
    const prevUserId = currentUserId;
    setCurrentUserId(user?.id ?? null);
    if (user) {
      try { sessionStorage.setItem('gb_session_active', '1'); } catch {}
      usersRef.current = usersRef.current.map(u => u.id === user.id ? { ...u, online: true } : u);
      setUsersAndEmit(prev => prev.map(u => u.id === user.id ? { ...u, online: true } : u));
      socketRef.current?.emit('user-login', { id: user.id, name: user.name, credits: user.credits, isAdmin: user.isAdmin || false });
      // Auto-fetch all users from DB on login
      setTimeout(fetchAndMergeFromServer, 500);
    } else {
      try { sessionStorage.removeItem('gb_session_active'); } catch {}
      if (prevUserId) socketRef.current?.emit('user:release', { userId: prevUserId });
    }
  };

  // Claims exclusive login session for this account. If another device already holds
  // it, the claim is refused outright (alreadyActive) — no takeover option. The other
  // device must log out (or disconnect) before this login can succeed.
  const claimUserSession = (userId: string): Promise<{ success: boolean; error?: string; alreadyActive?: boolean }> => {
    return new Promise((resolve) => {
      const socket = socketRef.current;
      if (!socket || !socket.connected) { resolve({ success: false, error: 'Not connected to server.' }); return; }
      let settled = false;
      const handler = (res: { success: boolean; error?: string; alreadyActive?: boolean }) => {
        if (settled) return;
        settled = true;
        socket.off('user:claim:result', handler);
        resolve(res);
      };
      socket.on('user:claim:result', handler);
      socket.emit('user:claim', { userId });
      setTimeout(() => {
        if (settled) return;
        settled = true;
        socket.off('user:claim:result', handler);
        resolve({ success: false, error: 'Server did not respond — try again.' });
      }, 5000);
    });
  };

  const getUserById = (id: string) => usersRef.current.find(u => u.id === id);

  const addUser = (name: string, isAdmin = false, initialCredits = 0, pin?: string, referredBy?: string): User => {
    const user: User = {
      id: `user_${Date.now()}`,
      name,
      pin,
      referredBy: referredBy?.trim() || undefined,
      credits: initialCredits,
      isAdmin,
      pendingBets: [],
    };
    usersRef.current = [...usersRef.current, user];
    setUsersAndEmit(prev => [...prev, user]);
    // Persist to DB immediately on signup so admin can always see the user
    const serverUrl = window.location.hostname === 'localhost'
      ? 'http://localhost:3001'
      : 'https://gamebird-app-production.up.railway.app';
    fetch(`${serverUrl}/api/users/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: user.id, name: user.name, isAdmin }),
    }).catch(() => {});
    setExpected(expectedTotalRef.current + initialCredits);
    if (initialCredits > 0) {
      logAdminEvent('user_created', { description: `New user "${name}" created with ${initialCredits} starting coins`, amount: initialCredits, userName: name, balanceAfter: initialCredits });
    }
    return user;
  };

  const setPin = (userId: string, pin: string) => {
    usersRef.current = usersRef.current.map(u => u.id === userId ? { ...u, pin } : u);
    setUsersAndEmit(prev => prev.map(u => u.id === userId ? { ...u, pin } : u));
  };

  const renameUser = (userId: string, name: string) => {
    usersRef.current = usersRef.current.map(u => u.id === userId ? { ...u, name } : u);
    setUsersAndEmit(prev => prev.map(u => u.id === userId ? { ...u, name } : u));
  };

  const deleteUser = (userId: string) => {
    const deleted = usersRef.current.find(u => u.id === userId);
    const deletedCredits = deleted?.credits ?? 0;
    usersRef.current = usersRef.current.filter(u => u.id !== userId);
    setUsersAndEmit(prev => prev.filter(u => u.id !== userId));
    if (currentUserId === userId) setCurrentUserId(null);
    setExpected(expectedTotalRef.current - deletedCredits);
    if (deleted) {
      logAdminEvent('user_deleted', { description: `User "${deleted.name}" deleted with ${deletedCredits} coins removed from pool`, amount: deletedCredits, userName: deleted.name, balanceBefore: deletedCredits });
      // Persist deletion to DB so they don't return on next sync
      fetch(`${SERVER_URL}/api/users/${userId}`, { method: 'DELETE' }).catch(() => {});
    }
  };

  const persistBalance = (userId: string, balance: number) => {
    // Mark this user as protected for 3s — stale users:push won't overwrite their credits
    recentlyPersistedRef.current.set(userId, Date.now() + 8000);
    postCritical(`/api/credits/${userId}/set`, { balance }, reportSyncFailure);
  };

  const deductCredits = (userId: string, amount: number, pendingBet: PendingBet): boolean => {
    const user = usersRef.current.find(u => u.id === userId);
    if (!user || user.credits < amount) return false;
    const newBal = user.credits - amount;
    const desc = `Bet placed — Game #${pendingBet.gameNumber} (Team ${pendingBet.teamSide})`;
    const tx = makeTx('bet_placed', amount, desc);
    const next = usersRef.current.map(u =>
      u.id !== userId ? u : appendTx({ ...u, credits: newBal, pendingBets: [...(u.pendingBets || []), pendingBet] }, tx)
    );
    usersRef.current = next;
    setUsersAndEmit(prev => prev.map(u =>
      u.id !== userId ? u : appendTx({ ...u, credits: newBal, pendingBets: [...(u.pendingBets || []), pendingBet] }, tx)
    ));
    postCritical(`/api/credits/${userId}/bet`, { amount, betDetails: desc }, reportSyncFailure);
    checkDrift(`Bet placed by ${user.name} (Game #${pendingBet.gameNumber})`, next);
    return true;
  };

  const refundBet = (userId: string, betId: string, amount: number) => {
    const user = usersRef.current.find(u => u.id === userId);
    const newBal = (user?.credits ?? 0) + amount;
    const tx = makeTx('bet_refund', amount, `Bet refunded (unmatched)`);
    const next = usersRef.current.map(u =>
      u.id !== userId ? u : appendTx({ ...u, credits: newBal, pendingBets: (u.pendingBets || []).filter(b => b.id !== betId) }, tx)
    );
    usersRef.current = next;
    setUsersAndEmit(prev => prev.map(u =>
      u.id !== userId ? u : appendTx({ ...u, credits: newBal, pendingBets: (u.pendingBets || []).filter(b => b.id !== betId) }, tx)
    ));
    postCritical(`/api/credits/${userId}/refund`, { amount, reason: 'Bet refunded (unmatched)' }, reportSyncFailure);
    checkDrift(`Bet refund for ${user?.name ?? userId}`, next);
  };

  const addCredits = (userId: string, amount: number, type?: TransactionType, description?: string) => {
    const txType = type ?? (amount >= 0 ? 'admin_add' : 'admin_deduct');
    const txDesc = description ?? (amount >= 0 ? `Admin added ${amount} coins` : `Admin deducted ${Math.abs(amount)} coins`);
    const tx = makeTx(txType, Math.abs(amount), txDesc);
    const user = usersRef.current.find(u => u.id === userId);
    const balBefore = user?.credits ?? 0;
    const newBal = Math.max(0, balBefore + amount);
    const actualDelta = newBal - balBefore;
    usersRef.current = usersRef.current.map(u =>
      u.id !== userId ? u : appendTx({ ...u, credits: newBal }, tx)
    );
    setUsersAndEmit(prev => prev.map(u =>
      u.id !== userId ? u : appendTx({ ...u, credits: newBal }, tx)
    ));
    setExpected(expectedTotalRef.current + actualDelta);
    if (user && amount !== 0) {
      const isReload = txType === 'reload';
      const eventType: AdminAuditEventType = isReload ? 'reload' : amount > 0 ? 'admin_add' : 'admin_deduct';
      logAdminEvent(eventType, {
        description: txDesc,
        amount: Math.abs(actualDelta),
        userName: user.name,
        balanceBefore: balBefore,
        balanceAfter: newBal,
      });
      postCritical(`/api/credits/${userId}/add`, { amount: actualDelta, type: txType, reason: txDesc }, reportSyncFailure);
    }
  };

  const recordTip = (fromId: string, toId: string, amount: number) => {
    const fromUser = usersRef.current.find(u => u.id === fromId);
    const toUser = usersRef.current.find(u => u.id === toId);
    const toName = toUser?.name ?? 'player';
    const fromName = fromUser?.name ?? 'player';
    logAdminEvent('tip', { description: `${fromName} tipped ${toName} ${amount} coins`, amount, fromUserName: fromName, toUserName: toName });
    const txGiven = makeTx('tip_given', amount, `Tip sent to ${toName}`);
    const txReceived = makeTx('tip_received', amount, `Tip received from ${fromName}`);
    usersRef.current = usersRef.current.map(u => {
      if (u.id === fromId) return appendTx({ ...u, tipsGiven: (u.tipsGiven ?? 0) + amount }, txGiven);
      if (u.id === toId) return appendTx({ ...u, tipsReceived: (u.tipsReceived ?? 0) + amount }, txReceived);
      return u;
    });
    setUsersAndEmit(prev => prev.map(u => {
      if (u.id === fromId) return appendTx({ ...u, tipsGiven: (u.tipsGiven ?? 0) + amount }, txGiven);
      if (u.id === toId) return appendTx({ ...u, tipsReceived: (u.tipsReceived ?? 0) + amount }, txReceived);
      return u;
    }));
    postCritical(`/api/tip`, { fromId, toId, amount, fromName, toName }, reportSyncFailure);
  };

  const transferCredits = (fromId: string, toUsername: string, amount: number): { success: boolean; error?: string } => {
    const from = usersRef.current.find(u => u.id === fromId);
    if (!from) return { success: false, error: 'Sender not found.' };
    const to = usersRef.current.find(u => u.name.toLowerCase() === toUsername.toLowerCase().trim());
    if (!to) return { success: false, error: `Player "${toUsername}" not found.` };
    if (to.id === fromId) return { success: false, error: 'Cannot transfer to yourself.' };
    if (amount <= 0 || !Number.isInteger(amount)) return { success: false, error: 'Amount must be a positive whole number.' };
    if (from.credits < amount) return { success: false, error: 'Insufficient coins.' };
    if (inFlightTransferRef.current.has(fromId)) return { success: false, error: 'Transfer already in progress — please wait.' };
    inFlightTransferRef.current.add(fromId);
    setTimeout(() => inFlightTransferRef.current.delete(fromId), 2500);

    // Optimistic local update so the UI responds instantly
    const txSent     = makeTx('transfer_sent',     amount, `P2P transfer to ${to.name}`);
    const txReceived = makeTx('transfer_received',  amount, `P2P transfer from ${from.name}`);
    usersRef.current = usersRef.current.map(u => {
      if (u.id === fromId) return appendTx({ ...u, credits: u.credits - amount }, txSent);
      if (u.id === to.id)  return appendTx({ ...u, credits: u.credits + amount }, txReceived);
      return u;
    });
    setUsersAndEmit(prev => prev.map(u => {
      if (u.id === fromId) return appendTx({ ...u, credits: u.credits - amount }, txSent);
      if (u.id === to.id)  return appendTx({ ...u, credits: u.credits + amount }, txReceived);
      return u;
    }));

    // Persist to DB via dedicated transfer endpoint — records proper tx labels for both users
    // and broadcasts transfer:receipt so the receiver's device gets the record in real-time
    postCritical(`/api/transfer`, { fromId, toId: to.id, amount, fromName: from.name, toName: to.name }, reportSyncFailure);

    logAdminEvent('transfer', {
      description: `P2P transfer: ${from.name} → ${to.name} (${amount} coins)`,
      amount, fromUserName: from.name, toUserName: to.name,
      balanceBefore: from.credits, balanceAfter: from.credits - amount,
    });
    return { success: true };
  };

  const clearPendingBetsForGame = (gameNumber: number, payouts: { userId: string; amount: number }[], allAffectedIds?: Set<string>) => {
    const payoutMap: Record<string, number> = {};
    for (const p of payouts) {
      payoutMap[p.userId] = (payoutMap[p.userId] || 0) + p.amount;
    }

    const update = (u: User) => {
      const payout = payoutMap[u.id] || 0;
      const pendingBets = (u.pendingBets || []).filter(b => b.gameNumber !== gameNumber);
      const gameBets = (u.pendingBets || []).filter(b => b.gameNumber === gameNumber);
      let updated = { ...u, credits: u.credits + payout, pendingBets };
      if (payout > 0) {
        updated = appendTx(updated, makeTx('bet_win', payout, `Won bet — Game #${gameNumber}`));
      } else if (gameBets.length > 0) {
        updated = appendTx(updated, makeTx('bet_loss', gameBets.reduce((s, b) => s + b.amount, 0), `Lost bet — Game #${gameNumber}`));
      }
      return updated;
    };

    // Use passed affectedIds (from bookedBets) so admin device always persists correctly
    // even though admin's usersRef never called deductCredits locally
    const affectedIds = allAffectedIds ?? new Set(
      usersRef.current
        .filter(u => (u.pendingBets || []).some(b => b.gameNumber === gameNumber))
        .map(u => u.id)
    );
    const next = usersRef.current.map(update);
    usersRef.current = next;
    setUsersAndEmit(prev => prev.map(update));
    // Persist ALL affected players with correct tx labels in DB
    next.forEach(u => {
      if (!affectedIds.has(u.id)) return;
      const payout = payoutMap[u.id] || 0;
      if (payout > 0) {
        postCritical(`/api/credits/${u.id}/win`, { amount: payout, betDetails: `Won bet — Game #${gameNumber}` }, reportSyncFailure);
      } else {
        // Loser: balance already deducted at bet-time; just sync so DB doesn't drift from late joins
        persistBalance(u.id, u.credits);
      }
    });
    checkDrift(`Game #${gameNumber} settled`, next);
  };

  const updateMembership = (userId: string, membership: Membership | null) => {
    const prev = usersRef.current.find(u => u.id === userId);
    const wasActivePremium = prev?.membership?.tier === 'premium' && !prev?.membership?.cancelledAt;
    const isCancelling = membership?.cancelledAt && !prev?.membership?.cancelledAt;
    const isRenewing = membership?.tier === 'premium' && !membership.cancelledAt && wasActivePremium;
    const isActivating = membership?.tier === 'premium' && !membership.cancelledAt && !wasActivePremium;
    const tx = isCancelling
      ? makeTx('membership_cancel', 0, 'Premium membership cancelled')
      : isRenewing
      ? makeTx('membership_renew', 20, 'Premium membership renewed — $20/month')
      : isActivating
      ? makeTx('membership_activate', 20, 'Premium membership activated — $20/month')
      : null;

    usersRef.current = usersRef.current.map(u => {
      if (u.id !== userId) return u;
      const updated = { ...u, membership: membership ?? undefined };
      return tx ? appendTx(updated, tx) : updated;
    });
    setUsersAndEmit(prev => prev.map(u => {
      if (u.id !== userId) return u;
      const updated = { ...u, membership: membership ?? undefined };
      return tx ? appendTx(updated, tx) : updated;
    }));
  };

  const requestAllUsers = () => { socketRef.current?.emit('users:request-all'); };

  const mergeServerUsers = (serverUsers: any[], deletedIds: string[] = []) => {
    suppressEmitRef.current = true;
    const deletedSet = new Set(deletedIds);
    deletedIds.forEach(id => serverDeletedIdsRef.current.add(id));
    // Remove any locally cached users the server has marked as deleted
    let merged = usersRef.current.filter(u => !deletedSet.has(u.id));
    serverUsers.forEach(su => {
      if (su.isAdmin) return;
      const idx = merged.findIndex(m => m.id === su.id);
      const isPremium = su.membershipStatus === 'premium';
      const premiumMembership = { tier: 'premium' as const, startDate: Date.now(), renewsAt: Date.now() + 365*24*60*60*1000 };
      if (idx === -1) {
        merged.push({
          id: su.id, name: su.name, credits: su.credits || 0,
          isAdmin: false, pendingBets: [],
          membership: isPremium ? premiumMembership : undefined,
        });
      } else {
        // Skip credit update if we have an in-flight persistBalance for this user —
        // the DB value is stale and would overwrite the correct client-side balance
        const writeProtected = (recentlyPersistedRef.current.get(su.id) ?? 0) > Date.now();
        merged[idx] = {
          ...merged[idx],
          credits: writeProtected ? merged[idx].credits : (su.credits ?? merged[idx].credits),
          // DB is authoritative for membership — always trust server status
          membership: isPremium ? (merged[idx].membership?.tier === 'premium' && !merged[idx].membership?.cancelledAt ? merged[idx].membership : premiumMembership) : undefined,
        };
      }
    });
usersRef.current = merged;
    setUsers(merged);
    // On first server sync, reset expectedTotal to the authoritative DB total
    // to avoid false drift alerts from stale localStorage values
    if (!initialSyncDoneRef.current) {
      initialSyncDoneRef.current = true;
      const t = totalWithPending(merged);
      expectedTotalRef.current = t;
      try { localStorage.setItem(EXPECTED_KEY, String(t)); } catch {}
    }
    suppressEmitRef.current = false;
  };

  // Auto-refresh every 30s while logged in
  useEffect(() => {
    if (!currentUserId) return;
    const interval = setInterval(fetchAndMergeFromServer, 30000);
    return () => clearInterval(interval);
  }, [currentUserId]);

  // Refresh when tab becomes visible again
  useEffect(() => {
    if (!currentUserId) return;
    const onVisible = () => { if (document.visibilityState === 'visible') fetchAndMergeFromServer(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [currentUserId]);

  // Refresh on socket reconnect — also re-claim this account's session slot (every
  // reconnect gets a new socket.id, so the server's activeUserSocket entry would
  // otherwise go stale and silently stop enforcing single-session for this account).
  // If another device legitimately took over while we were disconnected, we log out.
  // Skipped entirely while in admin mode — admin can browse any user account from
  // the UserBar switcher without that being treated as "logging in" as that account.
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;
    const onReconnect = () => {
      if (!currentUserId) return;
      fetchAndMergeFromServer();
      const isAdminMode = localStorage.getItem('gb_admin') === '1';
      if (isAdminMode) return;
      claimUserSession(currentUserId).then(res => {
        if (!res.success && res.alreadyActive) {
          setCurrentUserId(null);
          try { sessionStorage.removeItem('gb_session_active'); } catch {}
          setUserKickedMessage('This account is now active on another device.');
        }
      });
    };
    socket.on('connect', onReconnect);
    return () => { socket.off('connect', onReconnect); };
  }, [currentUserId]);

  return (
    <UserContext.Provider value={{ users, currentUser, currentUserId, setCurrentUser, claimUserSession, userKickedMessage, clearUserKickedMessage, addUser, setPin, renameUser, deleteUser, getUserById, deductCredits, addCredits, refundBet, recordTip, clearPendingBetsForGame, updateMembership, coinAuditLog, acknowledgeAudit, clearAuditLog, gameSnapshots, clearSnapshots, recordGameSnapshot, playerSnaps, recordPlayerSnap, clearPlayerSnaps, adminAuditLog, clearAdminAudit, transferCredits, challenges, createChallenge, acceptChallenge, cancelChallenge, payoutChallenge, requestAllUsers, mergeServerUsers }}>
      {children}
    </UserContext.Provider>

  );
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error('useUser must be used within UserProvider');
  return ctx;
}
