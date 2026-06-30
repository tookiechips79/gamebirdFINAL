import React, { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from 'react';
import { GameState, Bet, BookedBet, GameRecord, GameBet } from '@/types';
import { useUser } from './UserContext';
import { io, Socket } from 'socket.io-client';

interface GameContextType {
  game: GameState;
  updateGame: (updates: Partial<GameState>) => void;
  resetQueues: () => void;
  isAdmin: boolean;
  setIsAdmin: (v: boolean) => void;
  // Timer
  startTimer: () => void;
  pauseTimer: () => void;
  resetTimer: () => void;
  clockOffset: number;
  // Betting
  placeBet: (userId: string, userName: string, teamSide: 'A' | 'B', amount: number, isNextGame?: boolean) => boolean;
  cancelBet: (betId: string, teamSide: 'A' | 'B', isNextGame?: boolean) => void;
  // Game win
  declareWinner: (winningTeam: 'A' | 'B') => void;
  // History
  gameHistory: GameRecord[];
  clearHistory: () => void;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

const GAME_STORAGE_KEY = 'gb_game_state';
const HISTORY_STORAGE_KEY = 'gb_game_history';

const defaultGame: GameState = {
  teamAName: 'Player A',
  teamBName: 'Player B',
  teamAGames: 0,
  teamBGames: 0,
  teamABalls: 0,
  teamBBalls: 0,
  teamAHasBreak: true,
  currentGameNumber: 1,
  teamAQueue: [],
  teamBQueue: [],
  nextTeamAQueue: [],
  nextTeamBQueue: [],
  bookedBets: [],
  nextBookedBets: [],
  totalBookedAmount: 0,
  nextTotalBookedAmount: 0,
  betCounter: 1,
  gameDescription: '',
  gameType: '',
  timerStartedAt: null,
  timerElapsedMs: 0,
  isTimerRunning: false,
  lastWinner: null,
};

function loadGame(): GameState {
  try {
    const s = localStorage.getItem(GAME_STORAGE_KEY);
    if (s) {
      const parsed = JSON.parse(s);
      return { ...defaultGame, ...parsed, timerStartedAt: null, timerElapsedMs: parsed.timerElapsedMs ?? 0, isTimerRunning: false };
    }
  } catch {}
  return defaultGame;
}

function saveGame(g: GameState) {
  try {
    const { isTimerRunning, timerStartedAt, ...rest } = g;
    localStorage.setItem(GAME_STORAGE_KEY, JSON.stringify(rest));
  } catch {}
}

function loadHistory(): GameRecord[] {
  try {
    const s = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (s) return JSON.parse(s);
  } catch {}
  return [];
}

function saveHistory(h: GameRecord[]) {
  try {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(h));
  } catch {}
}

const BET_COLORS = ['#00FFFF', '#00FF41', '#FFD700', '#FF6B00', '#FF00FF', '#00BFFF'];

// Match bets greedily: pair equal amounts, smallest-first
function matchBets(queueA: Bet[], queueB: Bet[]): { bookedBets: BookedBet[]; updatedA: Bet[]; updatedB: Bet[] } {
  const bookedBets: BookedBet[] = [];
  const a = queueA.map(b => ({ ...b }));
  const b = queueB.map(b => ({ ...b }));
  const usedA = new Set<string>();
  const usedB = new Set<string>();

  for (const ba of a) {
    if (ba.booked || usedA.has(ba.id)) continue; // skip already-matched bets
    const match = b.find(bb => !bb.booked && !usedB.has(bb.id) && bb.amount === ba.amount);
    if (match) {
      usedA.add(ba.id);
      usedB.add(match.id);
      ba.booked = true;
      match.booked = true;
      bookedBets.push({
        id: `booked_${Date.now()}_${Math.random()}`,
        betIdA: ba.id,
        betIdB: match.id,
        userIdA: ba.userId,
        userIdB: match.userId,
        userNameA: ba.userName,
        userNameB: match.userName,
        amount: ba.amount,
        gameNumber: ba.gameNumber,
      });
    }
  }

  return {
    bookedBets,
    updatedA: a,
    updatedB: b,
  };
}

export function GameProvider({ children }: { children: ReactNode }) {
  const [game, setGame] = useState<GameState>(loadGame);
  const [isAdminFlag, setIsAdminState] = useState(() => localStorage.getItem('gb_admin') === '1');
  const { currentUser } = useUser();

  // Clear admin flag whenever a non-admin user is logged in
  useEffect(() => {
    if (currentUser && !currentUser.isAdmin && isAdminFlag) {
      setIsAdminState(false);
      localStorage.removeItem('gb_admin');
    }
  }, [currentUser]);

  // isAdmin is true when the flag is set (password was entered) OR current user is an admin account
  // Non-admin users cannot gain admin — if a non-admin is logged in, flag is ignored
  const isAdmin = isAdminFlag && (currentUser === null || currentUser.isAdmin === true);

  const setIsAdmin = (v: boolean) => {
    setIsAdminState(v);
    if (v) localStorage.setItem('gb_admin', '1');
    else localStorage.removeItem('gb_admin');
  };
  const [gameHistory, setGameHistory] = useState<GameRecord[]>(loadHistory);
  const [clockOffset, setClockOffset] = useState(0);
  const { getUserById, deductCredits, clearPendingBetsForGame, refundBet, recordGameSnapshot } = useUser();

  const gameRef = useRef(game);
  useEffect(() => { gameRef.current = game; }, [game]);

  // Socket.io — real-time sync
  const socketRef = useRef<Socket | null>(null);
  const suppressEmitRef = useRef(false); // prevents echo loops
  // clockOffsetRef: add to Date.now() to get server time. All timer timestamps use server time.
  const clockOffsetRef = useRef(0);

  useEffect(() => {
    const serverUrl = window.location.hostname === 'localhost'
      ? `http://localhost:3001`
      : 'https://gamebird-app-production.up.railway.app';
    const socket = io(serverUrl, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    // NTP-lite: measure clock offset relative to server on connect (and periodically)
    const syncClock = () => {
      const t0 = Date.now();
      socket.emit('time:ping', t0);
    };
    socket.on('time:pong', ({ clientTs, serverTs }: { clientTs: number; serverTs: number }) => {
      const rtt = Date.now() - clientTs;
      const offset = serverTs - (clientTs + rtt / 2);
      clockOffsetRef.current = offset;
      setClockOffset(offset);
    });
    const joinArena = () => {
      syncClock();
      socket.emit('set-arena', { arenaId: 'default' });
    };
    socket.on('connect', joinArena);
    if (socket.connected) joinArena();
    const syncInterval = setInterval(syncClock, 30_000);

    socket.on('gb:state', (incoming: GameState) => {
      if (!incoming) return;
      suppressEmitRef.current = true;
      setGame(incoming);
      gameRef.current = incoming;
      suppressEmitRef.current = false;
    });

    socket.on('history:state', (incoming: GameRecord[]) => {
      setGameHistory(incoming);
    });

    const betAudio = new Audio('/bet-click.mp3');
    socket.on('bet:sound', () => {
      betAudio.currentTime = 0;
      betAudio.play().catch(() => {});
    });

    return () => { clearInterval(syncInterval); socket.disconnect(); };
  }, []);

  // Persist game state
  useEffect(() => { saveGame(game); }, [game]);
  useEffect(() => { saveHistory(gameHistory); }, [gameHistory]);

  // No interval needed — timer is computed from timestamps client-side

  // Wraps setGame: every state mutation also broadcasts to other clients
  const setGameAndEmit = useCallback((updater: GameState | ((prev: GameState) => GameState)) => {
    setGame(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      if (!suppressEmitRef.current && socketRef.current?.connected) {
        socketRef.current.emit('gb:state', { ...next, arenaId: 'default' });
      }
      return next;
    });
  }, []);

  const updateGame = useCallback((updates: Partial<GameState>) => {
    setGameAndEmit(prev => ({ ...prev, ...updates }));
  }, [setGameAndEmit]);

  const resetQueues = useCallback(() => {
    const g = gameRef.current;
    const allBets = [...g.teamAQueue, ...g.teamBQueue, ...g.nextTeamAQueue, ...g.nextTeamBQueue];
    for (const bet of allBets) {
      refundBet(bet.userId, bet.id, bet.amount);
    }
    setGameAndEmit(prev => ({
      ...prev,
      teamAQueue: [],
      teamBQueue: [],
      bookedBets: [],
      totalBookedAmount: 0,
      nextTeamAQueue: [],
      nextTeamBQueue: [],
      nextBookedBets: [],
      nextTotalBookedAmount: 0,
    }));
  }, [refundBet]);

  const startTimer = useCallback(() => updateGame({
    isTimerRunning: true,
    timerStartedAt: Date.now() + clockOffsetRef.current,
    timerVersion: (gameRef.current.timerVersion ?? 0) + 1,
  }), [updateGame]);

  const pauseTimer = useCallback(() => {
    const g = gameRef.current;
    const addedMs = g.timerStartedAt ? (Date.now() + clockOffsetRef.current) - g.timerStartedAt : 0;
    updateGame({ isTimerRunning: false, timerStartedAt: null, timerElapsedMs: g.timerElapsedMs + addedMs });
  }, [updateGame]);

  const resetTimer = useCallback(() => updateGame({
    isTimerRunning: false, timerStartedAt: null, timerElapsedMs: 0,
  }), [updateGame]);

  const placeBet = useCallback((userId: string, userName: string, teamSide: 'A' | 'B', amount: number, isNextGame = false): boolean => {
    const g = gameRef.current;
    const user = getUserById(userId);
    if (!user || user.credits < amount) return false;

    const betId = `bet_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const gameNumber = isNextGame ? g.currentGameNumber + 1 : g.currentGameNumber;
    const colorIdx = g.betCounter % BET_COLORS.length;

    const newBet: Bet = {
      id: betId,
      userId,
      userName,
      amount,
      teamSide,
      gameNumber,
      booked: false,
      color: BET_COLORS[colorIdx],
      timestamp: Date.now(),
    };

    // Deduct immediately (pending bet system)
    const ok = deductCredits(userId, amount, { id: betId, gameNumber, amount, teamSide });
    if (!ok) return false;

    setGameAndEmit(prev => {
      const aKey = isNextGame ? 'nextTeamAQueue' : 'teamAQueue';
      const bKey = isNextGame ? 'nextTeamBQueue' : 'teamBQueue';
      const bookedKey = isNextGame ? 'nextBookedBets' : 'bookedBets';
      const totalKey = isNextGame ? 'nextTotalBookedAmount' : 'totalBookedAmount';

      const newA = teamSide === 'A' ? [...prev[aKey], newBet] : [...prev[aKey]];
      const newB = teamSide === 'B' ? [...prev[bKey], newBet] : [...prev[bKey]];

      const { bookedBets, updatedA, updatedB } = matchBets(newA, newB);
      const totalBooked = bookedBets.reduce((s, b) => s + b.amount, 0) +
        prev[bookedKey].reduce((s, b) => s + b.amount, 0);

      return {
        ...prev,
        [aKey]: updatedA,
        [bKey]: updatedB,
        [bookedKey]: [...prev[bookedKey], ...bookedBets],
        [totalKey]: totalBooked,
        betCounter: prev.betCounter + 1,
      };
    });

    return true;
  }, [getUserById, deductCredits]);

  const cancelBet = useCallback((betId: string, teamSide: 'A' | 'B', isNextGame = false) => {
    setGameAndEmit(prev => {
      const aKey = isNextGame ? 'nextTeamAQueue' : 'teamAQueue';
      const bKey = isNextGame ? 'nextTeamBQueue' : 'teamBQueue';

      const queue = teamSide === 'A' ? prev[aKey] : prev[bKey];
      const bet = queue.find(b => b.id === betId);
      if (!bet || bet.booked) return prev; // can't cancel matched bets

      const newQueue = queue.filter(b => b.id !== betId);
      return {
        ...prev,
        [teamSide === 'A' ? aKey : bKey]: newQueue,
      };
    });
  }, []);

  const declareWinner = useCallback((winningTeam: 'A' | 'B') => {
    const g = gameRef.current;
    const losingTeam: 'A' | 'B' = winningTeam === 'A' ? 'B' : 'A';
    const duration = Math.floor((g.timerElapsedMs + (g.timerStartedAt ? Date.now() - g.timerStartedAt : 0)) / 1000);

    // Build pre-game balance snapshot (bets already deducted)
    const allBets = [...g.teamAQueue, ...g.teamBQueue];
    const betSumByUser: Record<string, number> = {};
    allBets.forEach(b => { betSumByUser[b.userId] = (betSumByUser[b.userId] || 0) + b.amount; });
    const preBalances: Record<string, number> = {};
    Object.keys(betSumByUser).forEach(id => {
      const u = getUserById(id);
      if (u) preBalances[id] = u.credits + betSumByUser[id];
    });
    const runningDed: Record<string, number> = {};
    const balanceBefore = (userId: string, amt: number) => {
      const prior = runningDed[userId] || 0;
      const bal = (preBalances[userId] ?? 0) - prior;
      runningDed[userId] = prior + amt;
      return bal;
    };

    // Build payout list from bookedBets
    const payouts: { userId: string; amount: number }[] = [];
    for (const bb of g.bookedBets) {
      const winnerId = winningTeam === 'A' ? bb.userIdA : bb.userIdB;
      payouts.push({ userId: winnerId, amount: bb.amount * 2 });
    }
    // Refund unmatched bets
    for (const bet of allBets) {
      if (!bet.booked) payouts.push({ userId: bet.userId, amount: bet.amount });
    }

    // Snapshot before/after — only matched bet participants
    const snapshotPlayers = g.bookedBets.flatMap(bb => [
      { userId: bb.userIdA, name: bb.userNameA, betAmount: bb.amount },
      { userId: bb.userIdB, name: bb.userNameB, betAmount: bb.amount },
    ]).map(p => {
      const u = getUserById(p.userId);
      return { userId: p.userId, name: p.name, before: (u?.credits ?? 0) + p.betAmount, after: 0 };
    });

    clearPendingBetsForGame(g.currentGameNumber, payouts);

    // Fill in after-settlement credits and record snapshot
    const afterPlayers = snapshotPlayers.map(p => {
      const u = getUserById(p.userId);
      return { ...p, after: u?.credits ?? 0 };
    });
    recordGameSnapshot({
      id: `snap_${Date.now()}`,
      gameNumber: g.currentGameNumber,
      timestamp: Date.now(),
      winningTeam,
      totalBefore: afterPlayers.reduce((s, p) => s + p.before, 0),
      totalAfter: afterPlayers.reduce((s, p) => s + p.after, 0),
      players: afterPlayers,
    });

    // Refund unmatched next-game bets individually (by betId, not gameNumber)
    // so matched next-game bets carried forward are not incorrectly cleared
    const unmatchedNext = [...g.nextTeamAQueue, ...g.nextTeamBQueue].filter(b => !b.booked);
    for (const bet of unmatchedNext) {
      refundBet(bet.userId, bet.id, bet.amount);
    }

    // Build game record
    const makeGameBets = (queue: Bet[], won: boolean): GameBet[] =>
      queue.filter(b => b.booked).map(b => ({
        userId: b.userId,
        userName: b.userName,
        amount: b.amount,
        won: (winningTeam === 'A' && b.teamSide === 'A') || (winningTeam === 'B' && b.teamSide === 'B'),
        booked: true,
        startingBalance: balanceBefore(b.userId, b.amount),
      }));

    const record: GameRecord = {
      id: `game_${Date.now()}`,
      gameNumber: g.currentGameNumber,
      timestamp: Date.now(),
      teamAName: g.teamAName,
      teamBName: g.teamBName,
      teamAScore: winningTeam === 'A' ? 1 : 0,
      teamBScore: winningTeam === 'B' ? 1 : 0,
      teamABalls: g.teamABalls,
      teamBBalls: g.teamBBalls,
      winningTeam,
      bets: {
        teamA: makeGameBets(g.teamAQueue, winningTeam === 'A'),
        teamB: makeGameBets(g.teamBQueue, winningTeam === 'B'),
      },
      totalAmount: g.bookedBets.reduce((s, b) => s + b.amount, 0),
      duration,
    };

    setGameHistory(prev => {
      const next = [record, ...prev];
      if (socketRef.current?.connected) socketRef.current.emit('history:update', next);
      return next;
    });

    // Advance game state: promote next-game queues, increment counters
    setGameAndEmit(prev => ({
      ...prev,
      [winningTeam === 'A' ? 'teamAGames' : 'teamBGames']:
        (winningTeam === 'A' ? prev.teamAGames : prev.teamBGames) + 1,
      teamABalls: 0,
      teamBBalls: 0,
      teamAHasBreak: !prev.teamAHasBreak,
      currentGameNumber: prev.currentGameNumber + 1,
      timerStartedAt: null,
      timerElapsedMs: 0,
      isTimerRunning: false,
      // Promote only matched next-game bets; unmatched are refunded above
      teamAQueue: prev.nextTeamAQueue.filter(b => b.booked),
      teamBQueue: prev.nextTeamBQueue.filter(b => b.booked),
      bookedBets: prev.nextBookedBets,
      totalBookedAmount: prev.nextTotalBookedAmount,
      nextTeamAQueue: [],
      nextTeamBQueue: [],
      nextBookedBets: [],
      nextTotalBookedAmount: 0,
      lastWinner: winningTeam,
    }));
  }, [getUserById, clearPendingBetsForGame, refundBet, recordGameSnapshot]);

  const clearHistory = useCallback(() => {
    setGameHistory([]);
    if (socketRef.current?.connected) socketRef.current.emit('history:update', []);
    localStorage.removeItem(HISTORY_STORAGE_KEY);
  }, []);

  return (
    <GameContext.Provider value={{
      game, updateGame, resetQueues,
      isAdmin, setIsAdmin,
      startTimer, pauseTimer, resetTimer, clockOffset,
      placeBet, cancelBet,
      declareWinner,
      gameHistory, clearHistory,
    }}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used within GameProvider');
  return ctx;
}
