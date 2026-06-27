import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { User, PendingBet, Transaction, TransactionType, Membership, MembershipTier } from '@/types';
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
  setCurrentUser: (user: User | null) => void;
  addUser: (name: string, isAdmin?: boolean, initialCredits?: number, pin?: string, referredBy?: string) => User;
  setPin: (userId: string, pin: string) => void;
  renameUser: (userId: string, name: string) => void;
  deleteUser: (userId: string) => void;
  getUserById: (id: string) => User | undefined;
  deductCredits: (userId: string, amount: number, pendingBet: PendingBet) => boolean;
  addCredits: (userId: string, amount: number, type?: TransactionType, description?: string) => void;
  refundBet: (userId: string, betId: string, amount: number) => void;
  recordTip: (fromId: string, toId: string, amount: number) => void;
  clearPendingBetsForGame: (gameNumber: number, payouts: { userId: string; amount: number }[]) => void;
  updateMembership: (userId: string, membership: Membership | null) => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

const STORAGE_KEY = 'gb_users';

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
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Always-fresh ref — avoids stale closure bugs in callbacks
  const usersRef = useRef(users);
  useEffect(() => { usersRef.current = users; }, [users]);

  // Socket sync
  const socketRef = useRef<Socket | null>(null);
  const suppressEmitRef = useRef(false);

  useEffect(() => {
    const serverUrl = window.location.hostname === 'localhost'
      ? `http://localhost:3001`
      : 'https://gamebird-app-production.up.railway.app';
    const socket = io(serverUrl, { transports: ['polling'] });
    socketRef.current = socket;

    socket.on('users:state', (incoming: User[]) => {
      suppressEmitRef.current = true;
      usersRef.current = incoming;
      setUsers(incoming);
      suppressEmitRef.current = false;
    });

    return () => { socket.disconnect(); };
  }, []);

  // Wraps setUsers: every mutation also broadcasts to other clients
  const setUsersAndEmit = (updater: User[] | ((prev: User[]) => User[])) => {
    setUsers(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      if (!suppressEmitRef.current && socketRef.current?.connected) {
        socketRef.current.emit('users:update', next);
      }
      return next;
    });
  };

  // Persist on change
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(users)); } catch {}
  }, [users]);

  // Derive currentUser from ID so it's always in sync with latest users
  const currentUser = users.find(u => u.id === currentUserId) ?? null;
  const setCurrentUser = (user: User | null) => {
    setCurrentUserId(user?.id ?? null);
    if (user) {
      usersRef.current = usersRef.current.map(u => u.id === user.id ? { ...u, online: true } : u);
      setUsersAndEmit(prev => prev.map(u => u.id === user.id ? { ...u, online: true } : u));
    }
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
    usersRef.current = usersRef.current.filter(u => u.id !== userId);
    setUsersAndEmit(prev => prev.filter(u => u.id !== userId));
    if (currentUserId === userId) setCurrentUserId(null);
  };

  const deductCredits = (userId: string, amount: number, pendingBet: PendingBet): boolean => {
    const user = usersRef.current.find(u => u.id === userId);
    if (!user || user.credits < amount) return false;

    const tx = makeTx('bet_placed', amount, `Bet placed — Game #${pendingBet.gameNumber} (${pendingBet.teamSide === 'A' ? 'Player A' : 'Player B'})`);
    usersRef.current = usersRef.current.map(u =>
      u.id !== userId ? u : appendTx({ ...u, credits: u.credits - amount, pendingBets: [...(u.pendingBets || []), pendingBet] }, tx)
    );
    setUsersAndEmit(prev => prev.map(u =>
      u.id !== userId ? u : appendTx({ ...u, credits: u.credits - amount, pendingBets: [...(u.pendingBets || []), pendingBet] }, tx)
    ));
    return true;
  };

  const refundBet = (userId: string, betId: string, amount: number) => {
    const tx = makeTx('bet_refund', amount, `Bet refunded (unmatched)`);
    usersRef.current = usersRef.current.map(u =>
      u.id !== userId ? u : appendTx({ ...u, credits: u.credits + amount, pendingBets: (u.pendingBets || []).filter(b => b.id !== betId) }, tx)
    );
    setUsersAndEmit(prev => prev.map(u =>
      u.id !== userId ? u : appendTx({ ...u, credits: u.credits + amount, pendingBets: (u.pendingBets || []).filter(b => b.id !== betId) }, tx)
    ));
  };

  const addCredits = (userId: string, amount: number, type?: TransactionType, description?: string) => {
    const txType = type ?? (amount >= 0 ? 'admin_add' : 'admin_deduct');
    const txDesc = description ?? (amount >= 0 ? `Admin added ${amount} coins` : `Admin deducted ${Math.abs(amount)} coins`);
    const tx = makeTx(txType, Math.abs(amount), txDesc);
    usersRef.current = usersRef.current.map(u =>
      u.id !== userId ? u : appendTx({ ...u, credits: Math.max(0, u.credits + amount) }, tx)
    );
    setUsersAndEmit(prev => prev.map(u =>
      u.id !== userId ? u : appendTx({ ...u, credits: Math.max(0, u.credits + amount) }, tx)
    ));
  };

  const recordTip = (fromId: string, toId: string, amount: number) => {
    const toName = usersRef.current.find(u => u.id === toId)?.name ?? 'player';
    const fromName = usersRef.current.find(u => u.id === fromId)?.name ?? 'player';
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
  };

  const clearPendingBetsForGame = (gameNumber: number, payouts: { userId: string; amount: number }[]) => {
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

    usersRef.current = usersRef.current.map(update);
    setUsersAndEmit(prev => prev.map(update));
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

  return (
    <UserContext.Provider value={{ users, currentUser, setCurrentUser, addUser, setPin, renameUser, deleteUser, getUserById, deductCredits, addCredits, refundBet, recordTip, clearPendingBetsForGame, updateMembership }}>
      {children}
    </UserContext.Provider>

  );
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error('useUser must be used within UserProvider');
  return ctx;
}
