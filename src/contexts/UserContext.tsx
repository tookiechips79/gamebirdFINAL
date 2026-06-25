import React, { createContext, useContext, useState, useEffect } from "react";
import { User, BetHistoryRecord, UserBetReceipt, CreditTransaction, PendingBet, ProcessedBet } from "@/types/user";
import { toast } from "sonner";
import { socketIOService } from "@/services/socketIOService";
import { useRef } from "react";

interface UserContextType {
  users: User[];
  currentUser: User | null;
  setCurrentUser: (user: User | null) => void;
  addUser: (name: string, password: string) => User;
  authenticateUser: (name: string, password: string) => User | null;
  addCredits: (userId: string, amount: number, isAdmin?: boolean, reason?: string) => void;
  deductCredits: (userId: string, amount: number, isAdminAction?: boolean) => boolean;
  getUserById: (id: string) => User | undefined;
  getAllUsers: () => User[];
  betHistory: BetHistoryRecord[];
  addBetHistoryRecord: (record: Omit<BetHistoryRecord, "id" | "timestamp">) => void;
  resetBetHistory: () => void;
  // REMOVED: setBetHistory - bet history is now completely immutable
  getHardLedgerBetHistory: () => BetHistoryRecord[];
  incrementWins: (userId: string) => void;
  incrementLosses: (userId: string) => void;
  socialLogin: (provider: "google" | "apple") => User;
  userBetReceipts: UserBetReceipt[];
  addUserBetReceipt: (receipt: Omit<UserBetReceipt, "id" | "timestamp">) => void;
  getUserBetReceipts: (userId: string) => UserBetReceipt[];
  getHardLedgerBetReceipts: (userId: string) => UserBetReceipt[];
  resetBetReceipts: () => void;
  clearBettingQueueReceipts: () => void;
  processCashout: (userId: string, amount: number) => boolean;
  creditTransactions: CreditTransaction[];
  getCreditTransactions: (userId: string) => CreditTransaction[];
  activateMembership: (userId: string) => void;
  isUsersLoaded: boolean;
  connectedUsersCoins: { totalCoins: number; connectedUserCount: number; connectedUsers: any[] };
  // ✅ NEW: Pending bets system
  addPendingBet: (userId: string, betData: {
    id: string;
    amount: number;
    team: 'A' | 'B';
    gameNumber: number;
    teamName?: string;
    opponentName?: string;
  }) => void;
  getPendingBetAmount: (userId: string) => number;
  getAvailableCredits: (userId: string) => number;
  processPendingBets: (gameNumber: number, winningTeam: 'A' | 'B', teamABets?: any[], teamBBets?: any[], bookedBets?: any[]) => void;
  refundPendingBet: (userId: string, betId: string) => void;
  updatePendingBetMatched: (userId: string, betId: string, matchedAmount: number) => void;
  // ✅ RECOVERY: Restore multiple users at once
  restoreUsers: (usersToRestore: User[]) => void;
  // ✅ AUDIT: Coin and bet verification functions
  auditCoins: () => any;
  auditBets: (teamABets?: any[], teamBBets?: any[]) => any;
  systemHealthCheck: (teamABets?: any[], teamBBets?: any[]) => any;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

const USERS_STORAGE_KEY = "betting_app_users";
const CURRENT_USER_STORAGE_KEY = "betting_app_current_user";
const BET_HISTORY_STORAGE_KEY = "betting_app_bet_history";
const CREDIT_TRANSACTIONS_KEY = "betting_app_credit_transactions";

// ✅ NO STORAGE FOR BET RECEIPTS OR GAME HISTORY - Both are server-only via Socket.IO

// Create a default admin user
const createDefaultAdmin = (): User => ({
  id: "admin-" + Date.now(),
  name: "Admin",
  credits: 1000,
  password: "admin",
  wins: 0,
  losses: 0,
  membershipStatus: 'active',
  subscriptionDate: Date.now()
});

export const UserProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // *** MOVE ALL useRef DECLARATIONS HERE - FIRST, BEFORE ANY useState ***
  // Flag to prevent emitting history updates during clear operations
  const isClearingRef = useRef(false);

  // Flag to pause Socket.IO listener processing during clear operations
  const pauseListenersRef = useRef(false);

  // 💰 Flag to prevent excessive credit fetches
  const lastCreditFetchRef = useRef<number>(0);
  const CREDIT_FETCH_THROTTLE_MS = 1000; // Min 1 second between fetches

  // CRITICAL: Backup tracking of all games ever added - prevents loss during rapid adds
  // This ref maintains a complete history that acts as a safety net
  const allGamesEverAddedRef = useRef<BetHistoryRecord[]>([]);

  // ✅ DEDUPLICATION: Track which games have had receipts created to prevent double-recording
  // This prevents the same game from creating receipts twice (once locally, once from server broadcast)
  const gamesWithReceiptsCreatedRef = useRef<Set<number>>(new Set());

  // *** NOW - STATE DECLARATIONS COME HERE ***
  // Initialize with default admin to ensure we always have at least one user
  const [users, setUsers] = useState<User[]>(() => {
    try {
      // CLEANUP: Remove old/unused localStorage keys to free up space
      console.log('🧹 Cleaning up old localStorage keys...');
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (
          key.includes('ultra_bulletproof_') ||
          key.includes('bulletproof_') ||
          key === BET_HISTORY_STORAGE_KEY || // Old mutable bet history
          // OLD GAME HISTORY - All versions - now server-only
          key === 'betting_app_immutable_bet_history_v1' ||
          key === 'betting_app_immutable_bet_history_v2' ||
          key === 'betting_app_immutable_bet_history_v3' ||
          key === 'betting_app_immutable_bet_history_v4' ||
          key === 'betting_app_immutable_bet_history_v5' ||
          key === 'betting_app_immutable_bet_history_v6' ||
          key === 'betting_app_immutable_bet_history_v7' ||
          // ✅ OLD BET RECEIPTS - All versions - now server-only (clean up completely)
          key === 'betting_app_user_bet_receipts' ||
          key === 'betting_app_immutable_bet_receipts_v1' ||
          key === 'betting_app_immutable_bet_receipts_v2' ||
          key === 'betting_app_immutable_bet_receipts_v3' ||
          key === 'betting_app_immutable_bet_receipts_v4' ||
          key === 'betting_app_immutable_bet_receipts_v5' ||
          key === 'betting_app_immutable_bet_receipts_v6' ||
          key === 'betting_app_immutable_bet_receipts_v7'
        )) {
          keysToRemove.push(key);
        }
      }
      
      keysToRemove.forEach(key => {
        localStorage.removeItem(key);
        console.log(`🗑️ Removed old key: ${key}`);
      });
      
      if (keysToRemove.length > 0) {
        console.log(`✅ Cleaned up ${keysToRemove.length} old keys, freed up space!`);
      }
      
      // Now load users
      const storedUsers = localStorage.getItem(USERS_STORAGE_KEY);
      if (storedUsers) {
        const parsedUsers = JSON.parse(storedUsers);
        if (Array.isArray(parsedUsers) && parsedUsers.length > 0) {
          return parsedUsers;
        }
      }
    } catch (error) {
      console.error('Error loading initial users:', error);
    }
    // Fallback to default admin
    const defaultAdmin = createDefaultAdmin();
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify([defaultAdmin]));
    return [defaultAdmin];
  });
  
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  
  const [immutableBetHistory, setImmutableBetHistory] = useState<BetHistoryRecord[]>(() => {
    try {
      const stored = localStorage.getItem('gamebird_bet_history');
      if (stored) return JSON.parse(stored);
    } catch {}
    return [];
  });
  
  // PRIVATE: setBetHistory is now completely internal and cannot be called externally
  // This ensures bet history can only be modified through addBetHistoryRecord
  // ✅ BET RECEIPTS - SERVER-ONLY (just like game history)
  // No localStorage - all data from server via Socket.IO
  // This ensures consistency and prevents stale data issues
  const [userBetReceipts, setUserBetReceipts] = useState<UserBetReceipt[]>([]);
  const [creditTransactions, setCreditTransactions] = useState<CreditTransaction[]>([]);
  const [isUsersLoaded, setIsUsersLoaded] = useState<boolean>(true); // Start as true since we initialize with users
  const [connectedUsersCoins, setConnectedUsersCoins] = useState<{ totalCoins: number; connectedUserCount: number; connectedUsers: any[] }>({ totalCoins: 0, connectedUserCount: 0, connectedUsers: [] });

  // Custom setCurrentUser that emits user login/logout events
  const setCurrentUserWithLogin = (user: User | null) => {
    // Prevent rapid login/logout events
    const now = Date.now();
    const lastLoginTime = (setCurrentUserWithLogin as any).lastLoginTime || 0;
    if (now - lastLoginTime < 100) { // 100ms debounce
      console.log('🚫 Debouncing rapid user change, ignoring');
      return;
    }
    (setCurrentUserWithLogin as any).lastLoginTime = now;
    
    // If there was a previous user, emit logout event
    if (currentUser && socketIOService.isSocketConnected()) {
      console.log('📤 Emitting user logout for connected users tracking:', currentUser.name, 'with', currentUser.credits, 'coins');
      socketIOService.emitUserLogout({
        id: currentUser.id,
        name: currentUser.name,
        credits: currentUser.credits
      });
    }
    
    setCurrentUser(user);
    
    // Emit user login event to server for connected users tracking
    if (user && socketIOService.isSocketConnected()) {
      console.log('📤 Emitting user login for connected users tracking:', user.name, 'with', user.credits, 'coins');
      socketIOService.emitUserLogin({
        id: user.id,
        name: user.name,
        credits: user.credits
      });
    }
  };

  useEffect(() => {
    const loadUsers = () => {
      try {
        // CLEANUP: Remove old/unused localStorage keys to free up space
        console.log('🧹 Cleaning up old localStorage keys...');
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (
            key.includes('ultra_bulletproof_') ||
            key.includes('bulletproof_') ||
            key === BET_HISTORY_STORAGE_KEY // Old mutable bet history
          )) {
            keysToRemove.push(key);
          }
        }
        
        keysToRemove.forEach(key => {
          localStorage.removeItem(key);
          console.log(`🗑️ Removed old key: ${key}`);
        });
        
        if (keysToRemove.length > 0) {
          console.log(`✅ Cleaned up ${keysToRemove.length} old keys`);
        }
        
        // Now load users
        const storedUsers = localStorage.getItem(USERS_STORAGE_KEY);
        if (storedUsers) {
          const parsedUsers = JSON.parse(storedUsers);
          
          // Validate that parsedUsers is an array
          if (!Array.isArray(parsedUsers)) {
            throw new Error('Invalid users data format');
          }
          
          // Migrate existing users to include membership status
          const migratedUsers = parsedUsers.map((user: any) => {
            // If user doesn't have membershipStatus, set it based on whether they're admin
            if (!user.membershipStatus) {
              return {
                ...user,
                membershipStatus: user.name.toLowerCase() === 'admin' ? 'active' : 'inactive',
                subscriptionDate: user.name.toLowerCase() === 'admin' ? Date.now() : undefined
              };
            }
            return user;
          });
          
          setUsers(migratedUsers);
          setIsUsersLoaded(true);
          
          // Update localStorage with migrated users
          localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(migratedUsers));
          console.log('✅ Users loaded from localStorage:', migratedUsers.length, 'users');
        } else {
          // Create default admin if no users exist
          const defaultAdmin = createDefaultAdmin();
          setUsers([defaultAdmin]);
          setIsUsersLoaded(true);
          localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify([defaultAdmin]));
          console.log('✅ Default admin created');
        }
      } catch (error) {
        console.error('❌ Error loading users from localStorage:', error);
        
        // Fallback: Create a default admin
        const defaultAdmin = createDefaultAdmin();
        setUsers([defaultAdmin]);
        setIsUsersLoaded(true);
        localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify([defaultAdmin]));
        console.log('✅ Fallback admin created after error');
      }
    };

    loadUsers();

    const storedCurrentUser = localStorage.getItem(CURRENT_USER_STORAGE_KEY);
    if (storedCurrentUser) {
      const currentUserData = JSON.parse(storedCurrentUser);
      // Ensure current user has membership status
      if (!currentUserData.membershipStatus) {
        const updatedCurrentUser = {
          ...currentUserData,
          membershipStatus: currentUserData.name.toLowerCase() === 'admin' ? 'active' : 'inactive',
          subscriptionDate: currentUserData.name.toLowerCase() === 'admin' ? Date.now() : undefined
        };
        setCurrentUser(updatedCurrentUser);
        localStorage.setItem(CURRENT_USER_STORAGE_KEY, JSON.stringify(updatedCurrentUser));
      } else {
        setCurrentUser(currentUserData);
      }
    }
    
    const storedCreditTransactions = localStorage.getItem(CREDIT_TRANSACTIONS_KEY);
    if (storedCreditTransactions) {
      setCreditTransactions(JSON.parse(storedCreditTransactions));
    }
  }, []);

  // Socket.IO listeners for game history and bet receipts real-time sync
  useEffect(() => {
    console.log('🔌 Setting up Socket.IO listeners');

    // 💰 LISTEN FOR REAL-TIME GAME HISTORY UPDATES FROM SERVER
    // When another browser adds a game, sync it here - EXACTLY LIKE WALLET PATTERN
    // ⚠️ CRITICAL: Set up listeners BEFORE connecting socket
    // This ensures we don't miss the game-history-update sent on set-arena
    const handleGameHistoryUpdate = (data: { arenaId: string, games: any[], timestamp: number }) => {
      try {
        // ✅ TRUST SERVER COMPLETELY - Server is source of truth
        console.log(`💰 [GAME-HISTORY-SYNC] Received real-time game history update for arena '${data.arenaId}': ${data.games?.length} games`);
        console.log(`💾 [GAME-HISTORY-SYNC] Games from server:`, data.games);
        
        if (!data.games || data.games.length === 0) {
          console.log('📭 [GAME-HISTORY-SYNC] Server sent empty history - this is valid (cleared)');
          console.warn('⚠️ [GAME-HISTORY-DEBUG] Empty array from server!');
          console.warn('   Possible causes:');
          console.warn('   1. Database is in STUB MODE (set DATABASE_URL to enable persistence)');
          console.warn('   2. Server was restarted (in-memory storage cleared)');
          console.warn('   3. History was cleared by admin');
          console.warn('   4. No games added yet in this session');
          setImmutableBetHistory([]);
          return;
        }
        
        // Convert server format to local BetHistoryRecord format
        const ensuredHistory = data.games.map((record, index) => ({
          ...record,
          id: record.id || record.game_id || `game-${record.game_number || index}`,
          gameNumber: record.game_number || record.gameNumber || 0,
          teamAScore: record.team_a_score || record.teamAScore || 0,
          teamBScore: record.team_b_score || record.teamBScore || 0,
          winningTeam: record.winning_team || record.winningTeam || null,
          teamABalls: record.team_a_balls || record.teamABalls || 0,
          teamBBalls: record.team_b_balls || record.teamBBalls || 0,
          breakingTeam: record.breaking_team || record.breakingTeam || 'A',
          bets: record.bets_data ? (typeof record.bets_data === 'string' ? JSON.parse(record.bets_data) : record.bets_data) : record.bets || {},
          arenaId: record.arena_id || record.arenaId || 'default'
        }));
        
        // ✅ REPLACE entire history with server version (just like wallet replaces credits)
        console.log(`✅ [GAME-HISTORY-SYNC] Updated from socket: ${immutableBetHistory.length} → ${ensuredHistory.length} games`);
        setImmutableBetHistory([...ensuredHistory]);
        
        // 💰 CREATE BET RECEIPTS FOR HISTORICAL GAMES
        // Schedule this to run after addUserBetReceipt is defined
        // We'll emit receipts to the server which will save them to database
        setTimeout(() => {
          const arenaId = data.arenaId || 'default';
          const receiptsToEmit = [];
          
          ensuredHistory.forEach((game) => {
            // ✅ DEDUPLICATION: Skip if we've already created receipts for this game
            if (gamesWithReceiptsCreatedRef.current.has(game.gameNumber)) {
              console.log(`⏭️ [BET-RECEIPTS] Skipping game #${game.gameNumber} - receipts already created`);
              return;
            }
            
            if (game.bets) {
              console.log(`💰 [BET-RECEIPTS] Processing historical game #${game.gameNumber}: Team A=${game.bets.teamA?.length || 0}, Team B=${game.bets.teamB?.length || 0}`);
              
              // Process Team A booked bets
              (game.bets.teamA || []).forEach((bet) => {
                if (bet.booked) {
                  const receipt: UserBetReceipt = {
                    id: `hist-bet-${game.gameNumber}-A-${bet.userId}-${Date.now()}`,
                    userId: bet.userId,
                    userName: bet.userName,
                    gameNumber: game.gameNumber,
                    teamName: game.teamAName,
                    opponentName: game.teamBName,
                    teamAName: game.teamAName,
                    teamBName: game.teamBName,
                    teamAScore: game.teamAScore,
                    teamBScore: game.teamBScore,
                    amount: bet.amount,
                    won: bet.won,
                    teamSide: 'A',
                    winningTeam: game.winningTeam,
                    duration: game.duration,
                    arenaId,
                    timestamp: Date.now(),
                    transactionType: 'bet'
                  };
                  receiptsToEmit.push(receipt);
                  console.log(`   📝 Receipt for ${bet.userName}: $${bet.amount}, Won: ${bet.won}`);
                }
              });
              
              // Process Team B booked bets
              (game.bets.teamB || []).forEach((bet) => {
                if (bet.booked) {
                  const receipt: UserBetReceipt = {
                    id: `hist-bet-${game.gameNumber}-B-${bet.userId}-${Date.now()}`,
                    userId: bet.userId,
                    userName: bet.userName,
                    gameNumber: game.gameNumber,
                    teamName: game.teamBName,
                    opponentName: game.teamAName,
                    teamAName: game.teamAName,
                    teamBName: game.teamBName,
                    teamAScore: game.teamAScore,
                    teamBScore: game.teamBScore,
                    amount: bet.amount,
                    won: bet.won,
                    teamSide: 'B',
                    winningTeam: game.winningTeam,
                    duration: game.duration,
                    arenaId,
                    timestamp: Date.now(),
                    transactionType: 'bet'
                  };
                  receiptsToEmit.push(receipt);
                  console.log(`   📝 Receipt for ${bet.userName}: $${bet.amount}, Won: ${bet.won}`);
                }
              });
              
              // ✅ MARK: Mark this game as having receipts created
              gamesWithReceiptsCreatedRef.current.add(game.gameNumber);
            }
          });
          
          // Emit all receipts to the server for persistence
          if (receiptsToEmit.length > 0 && socketIOService.isSocketConnected()) {
            console.log(`✅ [BET-RECEIPTS] Emitting ${receiptsToEmit.length} historical bet receipts to server`);
            socketIOService.emitBetReceiptsUpdate(receiptsToEmit);
          } else if (receiptsToEmit.length > 0) {
            console.warn(`⚠️ [BET-RECEIPTS] Have ${receiptsToEmit.length} receipts to emit but socket not connected`);
          }
        }, 0);
      } catch (err) {
        console.error('❌ [GAME-HISTORY-SYNC] Error handling history update:', err);
      }
    };

  // ✅ LISTEN FOR BET RECEIPTS UPDATES FROM SERVER (just like game history)
  // Server is the ONLY source of truth for bet receipts
  const handleBetReceiptsUpdate = (data: { betReceipts: any[], userId?: string, arenaId?: string }) => {
    try {
      console.log(`📥 [BET-RECEIPTS-SYNC] Received bet receipts update for user '${data.userId}' in arena '${data.arenaId}': ${data.betReceipts?.length} receipts`);
      
      // ✅ TRUST SERVER COMPLETELY - Server is source of truth (exactly like game history)
      if (!data.betReceipts || !Array.isArray(data.betReceipts)) {
        console.log('📭 [BET-RECEIPTS-SYNC] Server sent empty/null receipts - clearing local state');
        setUserBetReceipts([]);
        return;
      }
      
      // Ensure all records have IDs
      const ensuredReceipts = data.betReceipts.map((record, index) => ({
        ...record,
        id: record.id || `bet-receipt-${Date.now()}-${index}-${Math.random().toString(36).substring(2, 9)}`
      }));
      
      setUserBetReceipts([...ensuredReceipts]);
      console.log(`✅ [BET-RECEIPTS-SYNC] Updated user bet receipts: ${ensuredReceipts.length} receipts`);
    } catch (err) {
      console.error('❌ [BET-RECEIPTS-SYNC] Error handling bet receipts update:', err);
    }
  };

    // Setup game history listeners
    socketIOService.onGameHistoryUpdate(handleGameHistoryUpdate);
    
    // 🎮 NOTE: onGameAdded is NOT needed anymore
    // Server broadcasts complete game-history-update after each game is added
    // This ensures ALL clients get the same data from the server
    // EXACTLY LIKE THE WALLET PATTERN - single source of truth
    
    // Listen for game history clear broadcasts
    socketIOService.onGameHistoryCleared((data) => {
      try {
        console.log(`💰 [GAME-HISTORY-SYNC] Server cleared history for arena '${data.arenaId}' (${data.deletedCount} games deleted from DB)`);
        
        // ✅ Always clear immediately - server is source of truth
        setImmutableBetHistory([]);
        console.log(`✅ [GAME-HISTORY-SYNC] Local history cleared to match server`);
      } catch (err) {
        console.error('❌ [GAME-HISTORY-SYNC] Error handling clear broadcast:', err);
      }
    });
    
    // ✅ Setup bet receipts listeners (just like game history)
    // Listen for real-time bet receipt updates from other clients
    socketIOService.onBetReceiptsUpdate(handleBetReceiptsUpdate);
    
    // Listen for user bet receipts data when we request it (same pattern as game history)
    socketIOService.onBetReceiptsData((data) => {
      try {
        console.log(`📥 [BET-RECEIPTS-SYNC] Received ${data.betReceipts?.length || 0} receipts from server for user ${data.userId}`);
        if (data.betReceipts && Array.isArray(data.betReceipts)) {
          setUserBetReceipts(data.betReceipts);
        }
      } catch (err) {
        console.error('❌ [BET-RECEIPTS-SYNC] Error handling bet receipts data:', err);
      }
    });

    // ✅ REMOVED: onClearAllData() listener
    // We now use ONLY emitClearGameHistory() which is isolated and doesn't affect bet receipts
    // The server's 'clear-game-history' event handles the clearing directly

    // Listen for pause command from other browsers
    socketIOService.onPauseListeners(() => {
      console.log('⏸️ [UserContext] Pausing listeners due to remote pause command');
      pauseListenersRef.current = true;
    });

    // Listen for resume command from other browsers
    socketIOService.onResumeListeners(() => {
      console.log('▶️ [UserContext] Resuming listeners due to remote resume command');
      pauseListenersRef.current = false;
    });

    // ⚠️ CRITICAL: Connect AFTER all listeners are set up
    // This ensures we don't miss the game-history-update sent on set-arena
    console.log('📡 [SOCKET] All listeners set up - now connecting to server');
    socketIOService.connect();

    return () => {
      console.log('🔌 Cleaning up Socket.IO listeners');
      // Remove all socket listeners
      socketIOService.offGameHistoryUpdate();
      socketIOService.offBetReceiptsUpdate();
      socketIOService.offBetReceiptsData();
      socketIOService.offArenaBetReceiptsData();
      socketIOService.offBetReceiptsCleared();
      socketIOService.offBetReceiptsError();
      socketIOService.offPauseListeners();
      socketIOService.offResumeListeners();
      socketIOService.offGameAdded();
      socketIOService.offGameHistoryCleared();
      socketIOService.offGameHistoryError();
    };
  }, []);

  useEffect(() => {
    if (users.length > 0) {
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
    }
  }, [users]);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(CURRENT_USER_STORAGE_KEY, JSON.stringify(currentUser));
      
      // ✅ REQUEST BET RECEIPTS FROM SERVER (just like game history)
      // Server sends all bet receipts for this user via Socket.IO
      // Skip in development mode (no socket.io connection)
      if (process.env.NODE_ENV !== 'development') {
        // Retry until socket is connected (handles page refresh and reconnection)
        const requestWithRetry = () => {
          if (socketIOService.isSocketConnected()) {
            console.log(`📥 [BET-RECEIPTS] Requesting from server for user ${currentUser.id}`);
            socketIOService.requestBetReceipts(currentUser.id);
          } else {
            // Socket not ready yet, retry in 200ms
            console.log(`⏳ [BET-RECEIPTS] Socket not ready, retrying...`);
            setTimeout(requestWithRetry, 200);
          }
        };
        
        requestWithRetry();
      }
    } else {
      localStorage.removeItem(CURRENT_USER_STORAGE_KEY);
    }
  }, [currentUser]);

  // NOTE: betHistory is synced via Socket.IO, don't save to localStorage separately
  
  // 🎮 SERVER-ONLY: Game history is managed by server database, NO localStorage
  // This useEffect now only tracks the state for UI rendering, all persistence is on server
  useEffect(() => {
    // Update backup ref for reference only (not for persistence)
    allGamesEverAddedRef.current = immutableBetHistory;
    
    // Only log for debugging, no localStorage operations
    if (immutableBetHistory.length > 0) {
      console.log('✅ [HISTORY-SYNC] Current game history in memory:', immutableBetHistory.length, 'records (from server)');
    }
  }, [immutableBetHistory]);
  
  // NOTE: userBetReceipts is synced via Socket.IO, don't save to localStorage separately
  
  // IMMUTABLE BET RECEIPTS - Always save to separate storage, NEVER cleared
  // ✅ BET RECEIPTS ARE SERVER-ONLY - NO localStorage
  // All data comes from server via Socket.IO, just like game history
  
  useEffect(() => {
    if (creditTransactions.length > 0) {
      localStorage.setItem(CREDIT_TRANSACTIONS_KEY, JSON.stringify(creditTransactions));
    }
  }, [creditTransactions]);

  // USER SETTINGS ARE COMPLETELY OFFLINE - NO SOCKET UPDATES
  // Removed all socket handlers to prevent any external modifications
  // User settings (bet history, receipts, transactions) are now completely local

  const addCreditTransaction = (transaction: Omit<CreditTransaction, "id" | "timestamp">) => {
    const newTransaction: CreditTransaction = {
      ...transaction,
      id: `credit-tx-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      timestamp: Date.now()
    };
    
    setCreditTransactions(prev => [newTransaction, ...prev]);
  };
  
  const getCreditTransactions = (userId: string) => {
    return creditTransactions.filter(tx => tx.userId === userId);
  };

  const activateMembership = (userId: string) => {
    setUsers(prev => prev.map(user => {
      if (user.id === userId) {
        const updatedUser = { 
          ...user, 
          membershipStatus: 'active' as const,
          subscriptionDate: Date.now()
        };
        
        if (currentUser?.id === userId) {
          setCurrentUser(updatedUser);
        }
        
        return updatedUser;
      }
      return user;
    }));
    
    const userName = users.find(u => u.id === userId)?.name || userId;
    
    toast.success("Membership Activated!", {
      description: `${userName}'s membership is now active. They can now place bets.`,
      className: "custom-toast-success"
    });
    
    addCreditTransaction({
      userId,
      userName: userName,
      type: 'subscription',
      amount: 0,
      details: 'Membership activated - subscription purchased'
    });
  };

  const addUser = async (name: string, password: string): Promise<User> => {
    if (!name.trim() || !password.trim()) {
      throw new Error("Name and password are required");
    }
    
    try {
      console.log(`👤 [USERS] Creating new user: ${name}`);
      
      // In development mode, create locally
      if (process.env.NODE_ENV === 'development') {
        const newUser: User = {
          id: `user-${Date.now()}`,
          name: name.trim(),
          password: password.trim(),
          credits: 1000,
          wins: 0,
          losses: 0,
          membershipStatus: 'inactive'
        };
        
        // Update local state
        setUsers(prev => {
          const updatedUsers = [...prev, newUser];
          try {
            localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(updatedUsers));
            console.log('💾 [USERS] User backed up to localStorage');
          } catch (storageError) {
            console.error('⚠️ [USERS] Failed to backup user to localStorage:', storageError);
          }
          return updatedUsers;
        });
        
        toast.success("User Added", {
          description: `User "${name}" created with 1000 credits!`,
          className: "custom-toast-success"
        });
        
        console.log(`✅ [USERS] User created locally: ${newUser.name} (ID: ${newUser.id})`);
        return newUser;
      }
      
      // Production: Save to server (source of truth)
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, password, initialCredits: 0 })
      });
      
      if (!response.ok) {
        throw new Error('Failed to create user on server');
      }
      
      const newUser = await response.json();
      console.log(`✅ [USERS] User created on server: ${newUser.name} (ID: ${newUser.id})`);
      
      // Update local state
      setUsers(prev => {
        const updatedUsers = [...prev, newUser];
        
        try {
          localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(updatedUsers));
          console.log('💾 [USERS] User backed up to localStorage');
        } catch (storageError) {
          console.error('⚠️ [USERS] Failed to backup user to localStorage:', storageError);
        }
        
        return updatedUsers;
      });
      
      toast.success("User Added", {
        description: `User "${name}" has been created`,
        className: "custom-toast-success"
      });
      
      return newUser;
    } catch (error) {
      console.error('❌ [USERS] Error adding user:', error);
      toast.error("Failed to Add User", {
        description: "There was an error creating the user. Please try again.",
        className: "custom-toast-error"
      });
      throw error;
    }
  };
  
  const authenticateUser = async (name: string, password: string): Promise<User | null> => {
    try {
      console.log(`🔐 [AUTH] Authenticating user: ${name}`);
      
      // In development mode, authenticate locally
      if (process.env.NODE_ENV === 'development') {
        const user = users.find(u => u.name === name && u.password === password);
        if (user) {
          console.log(`✅ [AUTH] User authenticated locally: ${user.name}`);
          return user;
        } else {
          console.warn('⚠️ [AUTH] Invalid credentials');
          return null;
        }
      }
      
      // Production: Authenticate on server (source of truth)
      const response = await fetch('/api/users/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, password })
      });
      
      if (!response.ok) {
        console.warn('⚠️ [AUTH] Authentication failed: invalid credentials');
        return null;
      }
      
      const user = await response.json();
      console.log(`✅ [AUTH] User authenticated: ${user.name} (credits: ${user.credits})`);
      
      // Update local users list with fresh data from server
      setUsers(prev => {
        const existingIndex = prev.findIndex(u => u.id === user.id);
        if (existingIndex >= 0) {
          const updated = [...prev];
          updated[existingIndex] = user;
          return updated;
        }
        return [...prev, user];
      });
      
      return user;
    } catch (error) {
      console.error('❌ [AUTH] Error during authentication:', error);
      // Fallback to local authentication
      const user = users.find(u => 
        u.name.toLowerCase() === name.toLowerCase() && 
        u.password === password
      );
      return user || null;
    }
  };

  // ✅ PENDING BETS: Add a bet as pending (credits not deducted yet)
  const addPendingBet = (userId: string, betData: {
    id: string;
    amount: number;
    team: 'A' | 'B';
    gameNumber: number;
    teamName?: string;
    opponentName?: string;
    matchedAmount?: number;  // If matched, how much was matched
  }) => {
    const user = users.find(u => u.id === userId);
    if (!user) {
      console.warn('⚠️ [PENDING-BET] User not found:', userId);
      return;
    }

    const pendingBet: any = {
      id: betData.id,
      amount: betData.amount,
      team: betData.team,
      gameNumber: betData.gameNumber,
      status: 'pending',
      timestamp: Date.now(),
      teamName: betData.teamName,
      opponentName: betData.opponentName,
      matchedAmount: betData.matchedAmount || 0  // Track how much was matched
    };

    setUsers(prev => {
      const updatedUsers = prev.map(u => {
        if (u.id === userId) {
          const pendingBets = [...(u.pendingBets || []), pendingBet];
          const updatedUser = { ...u, pendingBets };
          if (currentUser?.id === userId) {
            setCurrentUser(updatedUser);
          }
          const newAvailable = updatedUser.credits - pendingBets.reduce((sum, b) => sum + b.amount, 0);
          console.log(`✅ [PENDING-BET] Added pending bet #${betData.id} for ${u.name}. Pending: ${pendingBets.length}, Amount locked: ${betData.amount}, Available now: ${newAvailable}`);
          return updatedUser;
        }
        return u;
      });
      return updatedUsers;
    });
  };

  // ✅ Get pending bet amount (total locked in pending bets)
  const getPendingBetAmount = (userId: string): number => {
    const user = users.find(u => u.id === userId);
    if (!user) return 0;
    const pending = (user.pendingBets || []).reduce((sum, bet) => sum + bet.amount, 0);
    if (pending > 0) {
      console.log(`💰 [PENDING-CALC] ${user.name}: ${user.pendingBets?.length || 0} bets, total locked: ${pending}`);
    }
    return pending;
  };

  // ✅ Get available credits (total credits - pending bets)
  const getAvailableCredits = (userId: string): number => {
    const user = users.find(u => u.id === userId);
    if (!user) return 0;
    const pending = getPendingBetAmount(userId);
    const available = Math.max(0, user.credits - pending);
    console.log(`💰 [AVAILABLE-CALC] ${user.name}: total=${user.credits}, pending=${pending}, available=${available}`);
    return available;
  };

  // ✅ SIMPLIFIED: Process game results - winners get their bet back + loser's bet, unmatched bets refunded
  const processPendingBets = async (gameNumber: number, winningTeam: 'A' | 'B', teamABets: any[] = [], teamBBets: any[] = [], bookedBets: any[] = []) => {
    try {
      console.log(`🎮 [GAME-WIN] Game #${gameNumber}: ${winningTeam} won! Processing bets...`);

      const payouts: { userId: string; amount: number }[] = [];

      // Use authoritative bookedBets for matched payouts
      for (const booked of bookedBets) {
        const winnerUserId = winningTeam === 'A' ? booked.userIdA : booked.userIdB;
        const payout = booked.amount * 2;
        payouts.push({ userId: winnerUserId, amount: payout });
        console.log(`✅ Matched payout: ${winnerUserId} wins ${payout} (${booked.amount} + ${booked.amount})`);
      }

      // Refund every unmatched bet using the booked flag — handles users with multiple bets
      const allBets = [...teamABets, ...teamBBets];
      for (const bet of allBets) {
        if (!bet.booked) {
          payouts.push({ userId: bet.userId, amount: bet.amount });
          console.log(`💰 Refunding unmatched bet for ${bet.userName}: ${bet.amount} coins`);
        }
      }
      
      // Collect all user IDs who had bets in this game
      const bettorIds = new Set([
        ...teamABets.map(b => b.userId),
        ...teamBBets.map(b => b.userId),
      ]);

      // Apply payouts and clear pending bets for all users who had bets this game
      setUsers(prev => {
        const updated = prev.map(user => {
          const totalPayout = payouts
            .filter(p => p.userId === user.id)
            .reduce((sum, p) => sum + p.amount, 0);

          if (!bettorIds.has(user.id) && totalPayout === 0) return user;

          const newBalance = user.credits + totalPayout;
          // Clear only the bets from this game number so next-game pending bets remain
          const remainingPending = (user.pendingBets || []).filter(
            b => b.gameNumber !== gameNumber
          );

          if (totalPayout > 0) {
            console.log(`💰 ${user.name}: +${totalPayout} coins (${user.credits} → ${newBalance})`);
          }

          const updatedUser = { ...user, credits: newBalance, pendingBets: remainingPending };
          if (currentUser?.id === user.id) {
            setCurrentUser(updatedUser);
          }
          return updatedUser;
        });
        return updated;
      });
      
      console.log(`🎮 [GAME-WIN] Processed ${payouts.length} bet payouts`);
    } catch (error) {
      console.error(`❌ [GAME-WIN] Error processing bets:`, error);
    }
  };

  // ✅ AUDIT: Verify all coins are accounted for (no burns or creates)
  const auditCoins = () => {
    let totalUserCredits = 0;
    let totalInBets = 0;
    const audit: any[] = [];

    for (const user of users) {
      totalUserCredits += user.credits;
      
      audit.push({
        userId: user.id,
        userName: user.name,
        credits: user.credits
      });
    }

    console.log(`\n💰 [COIN-AUDIT] ===================`);
    console.log(`💰 [COIN-AUDIT] Total User Credits: ${totalUserCredits}`);
    console.log(`💰 [COIN-AUDIT] Audit Details:`, audit);
    console.log(`💰 [COIN-AUDIT] ===================\n`);

    return {
      totalUserCredits,
      details: audit
    };
  };

  // ✅ AUDIT: Verify bet system integrity
  const auditBets = (teamABets: any[] = [], teamBBets: any[] = []) => {
    const totalTeamAAmount = teamABets.reduce((sum, b) => sum + b.amount, 0);
    const totalTeamBAmount = teamBBets.reduce((sum, b) => sum + b.amount, 0);
    const totalInQueues = totalTeamAAmount + totalTeamBAmount;

    const matchedTeamA = teamABets.filter(b => b.booked).reduce((sum, b) => sum + b.amount, 0);
    const matchedTeamB = teamBBets.filter(b => b.booked).reduce((sum, b) => sum + b.amount, 0);
    const totalMatched = matchedTeamA + matchedTeamB;

    const unmatchedTeamA = teamABets.filter(b => !b.booked).reduce((sum, b) => sum + b.amount, 0);
    const unmatchedTeamB = teamBBets.filter(b => !b.booked).reduce((sum, b) => sum + b.amount, 0);
    const totalUnmatched = unmatchedTeamA + unmatchedTeamB;

    console.log(`\n🎲 [BET-AUDIT] ===================`);
    console.log(`🎲 [BET-AUDIT] Team A Queue: ${teamABets.length} bets, ${totalTeamAAmount} coins`);
    console.log(`🎲 [BET-AUDIT]   - Matched: ${teamABets.filter(b => b.booked).length} bets, ${matchedTeamA} coins`);
    console.log(`🎲 [BET-AUDIT]   - Unmatched: ${teamABets.filter(b => !b.booked).length} bets, ${unmatchedTeamA} coins`);
    console.log(`🎲 [BET-AUDIT] Team B Queue: ${teamBBets.length} bets, ${totalTeamBAmount} coins`);
    console.log(`🎲 [BET-AUDIT]   - Matched: ${teamBBets.filter(b => b.booked).length} bets, ${matchedTeamB} coins`);
    console.log(`🎲 [BET-AUDIT]   - Unmatched: ${teamBBets.filter(b => !b.booked).length} bets, ${unmatchedTeamB} coins`);
    console.log(`🎲 [BET-AUDIT] TOTAL: ${totalInQueues} coins (${totalMatched} matched, ${totalUnmatched} unmatched)`);
    console.log(`🎲 [BET-AUDIT] ===================\n`);

    return {
      teamA: {
        total: totalTeamAAmount,
        matched: matchedTeamA,
        unmatched: unmatchedTeamA,
        count: teamABets.length
      },
      teamB: {
        total: totalTeamBAmount,
        matched: matchedTeamB,
        unmatched: unmatchedTeamB,
        count: teamBBets.length
      },
      grandTotal: totalInQueues,
      totalMatched,
      totalUnmatched
    };
  };

  // ✅ AUDIT: Full system health check
  const systemHealthCheck = (teamABets: any[] = [], teamBBets: any[] = []) => {
    const coinAudit = auditCoins();
    const betAudit = auditBets(teamABets, teamBBets);

    console.log(`\n✅ [SYSTEM-HEALTH] ===================`);
    console.log(`✅ Total Credits in System: ${coinAudit.totalUserCredits}`);
    console.log(`✅ Total Coins in Active Bets: ${betAudit.grandTotal}`);
    console.log(`✅ Total System Coins: ${coinAudit.totalUserCredits + betAudit.grandTotal}`);
    console.log(`✅ [SYSTEM-HEALTH] ===================\n`);

    return {
      coinAudit,
      betAudit,
      systemTotal: coinAudit.totalUserCredits + betAudit.grandTotal
    };
  };

  // ✅ Update pending bet with matched amount (when it gets booked)
  const updatePendingBetMatched = (userId: string, betId: string, matchedAmount: number) => {
    const user = users.find(u => u.id === userId);
    if (!user) {
      console.warn('⚠️ [PENDING-BET] User not found for update:', userId);
      return;
    }

    const bet = user.pendingBets?.find(b => b.id === betId);
    if (!bet) {
      console.warn('⚠️ [PENDING-BET] Bet not found for update:', betId);
      return;
    }

    setUsers(prev => {
      const updatedUsers = prev.map(u => {
        if (u.id === userId && u.pendingBets) {
          const updatedBets = u.pendingBets.map(b => {
            if (b.id === betId) {
              console.log(`✅ [PENDING-BET] Updated bet #${betId} with matched amount: ${matchedAmount}`);
              return { ...b, matchedAmount };
            }
            return b;
          });
          const updatedUser = { ...u, pendingBets: updatedBets };
          if (currentUser?.id === userId) {
            setCurrentUser(updatedUser);
          }
          return updatedUser;
        }
        return u;
      });
      return updatedUsers;
    });
  };

  // ✅ Refund pending bet (user cancels a bet)
  const refundPendingBet = (userId: string, betId: string) => {
    const user = users.find(u => u.id === userId);
    if (!user) {
      console.warn('⚠️ [PENDING-BET] User not found:', userId);
      return;
    }

    const betToRemove = user.pendingBets?.find(b => b.id === betId);
    if (!betToRemove) {
      console.warn('⚠️ [PENDING-BET] Bet not found:', betId);
      return;
    }

    setUsers(prev => {
      const updatedUsers = prev.map(u => {
        if (u.id === userId) {
          const pendingBets = (u.pendingBets || []).filter(b => b.id !== betId);
          const updatedUser = { ...u, pendingBets };
          if (currentUser?.id === userId) {
            setCurrentUser(updatedUser);
          }
          console.log(`✅ [PENDING-BET] Refunded bet #${betId} for ${u.name}. Remaining pending: ${pendingBets.length}`);
          return updatedUser;
        }
        return u;
      });
      return updatedUsers;
    });
  };

  const addCredits = async (userId: string, amount: number, isAdmin: boolean = false, reason: string = 'admin_add'): Promise<boolean> => {
    if (amount <= 0) {
      console.warn('⚠️ [CREDITS] Invalid amount:', amount);
      return false;
    }
    
    try {
      console.log(`💰 [CREDITS-ADD] Starting: userId=${userId}, amount=${amount}, reason=${reason}`);
      
      // In development mode, handle locally without server
      if (process.env.NODE_ENV === 'development') {
        const user = users.find(u => u.id === userId);
        if (!user) {
          console.warn('⚠️ [CREDITS-ADD] User not found:', userId);
          return false;
        }
        
        const newBalance = user.credits + amount;
        console.log(`✅ [CREDITS-ADD] Dev mode: adding locally, newBalance=${newBalance}`);
        
        // Update local state immediately
        setUsers(prev => {
          const updatedUsers = prev.map(u => {
            if (u.id === userId) {
              const updatedUser = { ...u, credits: newBalance };
              if (currentUser?.id === userId) {
                setCurrentUserWithLogin(updatedUser);
              }
              return updatedUser;
            }
            return u;
          });
          localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(updatedUsers));
          return updatedUsers;
        });
        
        return true;
      }
      
      // 💰 Call server API instead of modifying local state
      // Server is authoritative - it validates, processes, and records the transaction
      const response = await fetch(`/api/credits/${userId}/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          reason: isAdmin ? reason : 'system_operation',
          adminNotes: isAdmin ? `Admin action: ${reason}` : ''
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error(`❌ [CREDITS-ADD] Server returned error: ${response.status}`, errorData);
        throw new Error(`Server error: ${response.status} - ${errorData.error || 'Unknown'}`);
      }
      
      const data = await response.json();
      const newBalance = data.newBalance;
      console.log(`✅ [CREDITS-ADD] Server returned newBalance=${newBalance}`);
      
      // Update local state with server-confirmed balance
      setUsers(prev => {
        const updatedUsers = prev.map(user => {
          if (user.id === userId) {
            const updatedUser = { ...user, credits: newBalance };
            if (currentUser?.id === userId) {
              setCurrentUser(updatedUser);
            }
            return updatedUser;
          }
          return user;
        });
        
        // Emit wallet update for connected users coin counter
        if (socketIOService.isSocketConnected()) {
          socketIOService.emitUserWalletUpdate(updatedUsers);
        }
        
        return updatedUsers;
      });
      
      const userName = users.find(u => u.id === userId)?.name || userId;
      
      if (isAdmin) {
        // Determine toast message based on reason
        let toastTitle = "Credits Added";
        let toastDescription = `Added ${amount} credits to ${userName}`;
        let transactionType: 'admin_add' | 'bet_refund' = 'admin_add';
        
        if (reason === 'bet_refund') {
          toastTitle = "Bet Refunded";
          toastDescription = `Refunded ${amount} credits to ${userName}`;
          transactionType = 'bet_refund';
        }
        
        toast.success(toastTitle, {
          description: toastDescription,
          className: "custom-toast-success"
        });
        
        // Record in credit transactions
        addCreditTransaction({
          userId,
          userName: userName,
          type: transactionType,
          amount,
          details: reason === 'bet_refund' ? 'Bet refunded' : 'Admin added coins to account'
        });
      }
      
      return true;
    } catch (error) {
      console.error('❌ [CREDITS] Error adding credits:', error);
      if (isAdmin) {
        toast.error("Error", {
          description: "Failed to add credits - server operation failed",
          className: "custom-toast-error"
        });
      }
      return false;
    }
  };

  // ✅ Deduct credits from user account
  const deductCredits = async (userId: string, amount: number, isAdminAction: boolean = false): Promise<boolean> => {
    if (amount <= 0) {
      console.warn('⚠️ [CREDITS] Invalid deduct amount:', amount);
      return true;
    }
    
    const user = users.find(u => u.id === userId);
    if (!user) {
      console.warn('⚠️ [CREDITS] User not found:', userId);
      return false;
    }
    
    try {
      console.log(`💰 [CREDITS-BET] Starting: userId=${userId}, amount=${amount}, currentBalance=${user.credits}`);
      
      // In development mode, handle locally without server
      if (process.env.NODE_ENV === 'development') {
        if (user.credits < amount) {
          console.warn(`⚠️ [CREDITS-BET] Insufficient local credits: has ${user.credits}, needs ${amount}`);
          toast.error("Insufficient Credits", {
            description: `${user.name} needs ${amount} COINS (has ${user.credits})`,
            className: "custom-toast-error"
          });
          return false;
        }
        
        const newBalance = user.credits - amount;
        console.log(`✅ [CREDITS-BET] Dev mode: deducting locally, newBalance=${newBalance}`);
        
        // Update local state immediately
        setUsers(prev => {
          const updatedUsers = prev.map(u => {
            if (u.id === userId) {
              const updatedUser = { ...u, credits: newBalance };
              if (currentUser?.id === userId) {
                setCurrentUserWithLogin(updatedUser);
              }
              return updatedUser;
            }
            return u;
          });
          localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(updatedUsers));
          return updatedUsers;
        });
        
        return true;
      }
      
      // 💰 Call server API to validate and deduct credits
      // Server checks balance before allowing deduction
      const response = await fetch(`/api/credits/${userId}/bet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          betDetails: isAdminAction ? 'Admin deducted' : 'Bet placed'
        })
      });
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        console.warn(`⚠️ [CREDITS-BET] Server rejected: ${response.status}`, error);
        toast.error("Insufficient Credits", {
          description: error.error || `${user.name} doesn't have enough credits`,
          className: "custom-toast-error"
        });
        return false;
      }
      
      const data = await response.json();
      const newBalance = data.newBalance;
      console.log(`✅ [CREDITS-BET] Server returned newBalance=${newBalance}`);
      
      // Update local state with server-confirmed balance
      setUsers(prev => {
        const updatedUsers = prev.map(u => {
          if (u.id === userId) {
            const updatedUser = { ...u, credits: newBalance };
            if (currentUser?.id === userId) {
              setCurrentUser(updatedUser);
            }
            return updatedUser;
          }
          return u;
        });
        
        // Emit wallet update for connected users coin counter
        if (socketIOService.isSocketConnected()) {
          socketIOService.emitUserWalletUpdate(updatedUsers);
        }
        
        return updatedUsers;
      });
      
      if (isAdminAction) {
        addCreditTransaction({
          userId,
          userName: user.name,
          type: 'admin_deduct',
          amount,
          details: 'Admin removed coins from account'
        });
      }
      
      return true;
    } catch (error) {
      console.error('❌ [CREDITS] Error deducting credits:', error);
      toast.error("Error", {
        description: "Failed to process deduction - server operation failed",
        className: "custom-toast-error"
      });
      return false;
    }
  };

  const incrementWins = (userId: string) => {
    setUsers(prev => prev.map(user => {
      if (user.id === userId) {
        const updatedUser = { ...user, wins: (user.wins || 0) + 1 };
        
        if (currentUser?.id === userId) {
          setCurrentUser(updatedUser);
        }
        
        return updatedUser;
      }
      return user;
    }));
  };

  const incrementLosses = (userId: string) => {
    setUsers(prev => prev.map(user => {
      if (user.id === userId) {
        const updatedUser = { ...user, losses: (user.losses || 0) + 1 };
        
        if (currentUser?.id === userId) {
          setCurrentUser(updatedUser);
        }
        
        return updatedUser;
      }
      return user;
    }));
  };

  const getUserById = (id: string) => {
    return users.find(user => user.id === id);
  };

  const getAllUsers = () => {
    return [...users];
  };
  
  const addBetHistoryRecord = (record: Omit<BetHistoryRecord, "id" | "timestamp">) => {
    const newRecord: BetHistoryRecord = {
      ...record,
      id: `bet-history-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      timestamp: Date.now()
    };

    console.log('💰 [GAME-HISTORY-SYNC] Adding new game record, game#:', record.gameNumber);

    const MAX_GAMES = 50;
    const immediateHistory = [newRecord, ...immutableBetHistory].slice(0, MAX_GAMES);
    setImmutableBetHistory(immediateHistory);
    try {
      localStorage.setItem('gamebird_bet_history', JSON.stringify(immediateHistory));
    } catch {}
    console.log('✅ [GAME-HISTORY-SYNC] Local state updated:', immediateHistory.length, 'games');
    console.log('✅ [GAME-HISTORY-SYNC] Local state updated:', immediateHistory.length, 'games');
    
    // 💰 SEND TO SERVER (server will save to database and broadcast to all clients)
    try {
      const gameHistoryRecord = {
        gameNumber: record.gameNumber,
        teamAName: record.teamAName,
        teamBName: record.teamBName,
        teamAScore: record.teamAScore,
        teamBScore: record.teamBScore,
        winningTeam: record.winningTeam,
        teamABalls: record.teamABalls,
        teamBBalls: record.teamBBalls,
        breakingTeam: record.breakingTeam,
        duration: record.duration,
        totalAmount: record.totalAmount,
        bets: record.bets,
        arenaId: record.arenaId || socketIOService.getArenaId() || 'default'
      };
      
      console.log('📤 [GAME-HISTORY-SYNC] Sending to server:', `Game #${record.gameNumber}`);
      console.log('🔌 [GAME-HISTORY-SYNC] Socket connected?', socketIOService.isSocketConnected());
      
      if (socketIOService.isSocketConnected()) {
        socketIOService.emitNewGameAdded(gameHistoryRecord);
        
        // 💰 MIRROR WALLET PATTERN: Request full history from server immediately
        // Server will broadcast complete history to all clients synchronously
        console.log('📡 [GAME-HISTORY-SYNC] Requesting full history from server');
        socketIOService.emitRequestGameHistory();
      } else {
        console.warn('⚠️ [GAME-HISTORY-SYNC] Socket NOT connected! Cannot emit game to server');
      }
    } catch (err) {
      console.error('❌ [GAME-HISTORY-SYNC] Error sending game to server:', err);
    }
    
    const gameNumber = record.gameNumber;
    const arenaId = record.arenaId || socketIOService.getArenaId() || 'default';
    
    console.log(`💰 [BET-RECEIPTS] Processing receipts for game #${gameNumber}:`);
    console.log(`   Team A bets: ${record.bets.teamA?.length || 0}, Booked: ${record.bets.teamA?.filter(b => b.booked).length || 0}`);
    console.log(`   Team B bets: ${record.bets.teamB?.length || 0}, Booked: ${record.bets.teamB?.filter(b => b.booked).length || 0}`);
    
    // ✅ DEDUPLICATION: Check if receipts have already been created for this game
    if (gamesWithReceiptsCreatedRef.current.has(gameNumber)) {
      console.log(`⚠️ [BET-RECEIPTS] Game #${gameNumber} has already had receipts created - SKIPPING to prevent duplicates`);
    } else {
      // ✅ CREATE RECEIPTS IMMEDIATELY for instant feedback to user
      // Mark as processed first to prevent re-creation if server broadcast comes back
      gamesWithReceiptsCreatedRef.current.add(gameNumber);
      console.log(`✅ [BET-RECEIPTS] Marked game #${gameNumber} as having receipts created`);
      
      record.bets.teamA.forEach(bet => {
        if (bet.booked) {
          console.log(`   📝 Creating receipt for Team A bet: ${bet.userName} - $${bet.amount} - Won: ${bet.won}`);
          addUserBetReceipt({
            userId: bet.userId,
            userName: bet.userName,
            gameNumber,
            teamName: record.teamAName,
            opponentName: record.teamBName,
            teamAName: record.teamAName,
            teamBName: record.teamBName,
            teamAScore: record.teamAScore,
            teamBScore: record.teamBScore,
            amount: bet.amount,
            won: bet.won,
            teamSide: 'A',
            winningTeam: record.winningTeam,
            duration: record.duration,
            arenaId
          });
        }
      });
      
      record.bets.teamB.forEach(bet => {
        if (bet.booked) {
          console.log(`   📝 Creating receipt for Team B bet: ${bet.userName} - $${bet.amount} - Won: ${bet.won}`);
          addUserBetReceipt({
            userId: bet.userId,
            userName: bet.userName,
            gameNumber,
            teamName: record.teamBName,
            opponentName: record.teamAName,
            teamAName: record.teamAName,
            teamBName: record.teamBName,
            teamAScore: record.teamAScore,
            teamBScore: record.teamBScore,
            amount: bet.amount,
            won: bet.won,
            teamSide: 'B',
            winningTeam: record.winningTeam,
            duration: record.duration,
            arenaId
          });
        }
      });
    }
    
    toast.success("Game Results Recorded", {
      description: `Results for game #${record.gameNumber} have been saved in history`,
      className: "custom-toast-success"
    });
  };
  
  const resetBetHistory = () => {
    // 🎮 SERVER-ONLY: Clear game history from server database only
    console.log('🧹 Clearing ALL game history from server');
    
    // Clear local memory immediately
    setImmutableBetHistory([]);
    
    // ✅ DEDUPLICATION: Clear the receipts-created tracker when history is cleared
    gamesWithReceiptsCreatedRef.current.clear();
    console.log('✅ Cleared receipts creation tracker');
    
    // 🎮 CRITICAL: Clear from server database via Socket.IO
    // Server will broadcast clear to all clients, so no localStorage needed
    try {
      // 🎮 Use socketIOService to determine correct arena
        socketIOService.emitClearGameHistory();
    } catch (err) {
      console.error('❌ [RESET-HISTORY] Error clearing server history:', err);
    }
    
    console.log('✅ Game history cleared (from server, no localStorage)');
  };

  // HARD LEDGER - Read-only bet history for settings
  // This provides a completely immutable view of bet history
  const getHardLedgerBetHistory = (): BetHistoryRecord[] => {
    // Return a deep copy of the IMMUTABLE bet history to prevent any modifications
    return JSON.parse(JSON.stringify(immutableBetHistory));
  };
  
  const addUserBetReceipt = (receipt: Omit<UserBetReceipt, "id" | "timestamp">) => {
    if (receipt.transactionType === 'admin_add' || 
        receipt.transactionType === 'admin_deduct' || 
        receipt.transactionType === 'cashout') {
      return;
    }
    
    const newReceipt: UserBetReceipt = {
      ...receipt,
      id: `user-bet-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      timestamp: Date.now(),
      transactionType: receipt.transactionType || 'bet'
    };
    
    console.log(`✅ [addUserBetReceipt] Created new receipt with ID: ${newReceipt.id}`);
    console.log(`   User: ${newReceipt.userName} (${newReceipt.userId}), Game: #${newReceipt.gameNumber}, Team: ${newReceipt.teamName}, Amount: $${newReceipt.amount}, Won: ${newReceipt.won}`);
    
    let finalReceipts: UserBetReceipt[] = [];
    
    setUserBetReceipts(prev => {
      const updatedReceipts = [newReceipt, ...prev];
      
      // QUOTA MANAGEMENT: Keep only last 250 receipts in memory
      const MAX_RECEIPTS = 250;
      if (updatedReceipts.length > MAX_RECEIPTS) {
        console.log(`⚠️ Bet receipts limit reached (${updatedReceipts.length}), trimming to ${MAX_RECEIPTS} receipts`);
        finalReceipts = updatedReceipts.slice(0, MAX_RECEIPTS);
        return finalReceipts;
      }
      
      finalReceipts = updatedReceipts;
      return updatedReceipts;
    });
    
    // EMIT IMMEDIATELY with JUST the new receipt to the server
    // This is the SOURCE of truth - emit only when data is created locally
    const emitReceipt = () => {
      // DO NOT EMIT if listeners are paused (during clear operation)
      if (pauseListenersRef.current) {
        console.log('⏸️ [addUserBetReceipt] Skipping emit - listeners are paused');
        return;
      }
      
      if (!socketIOService.isSocketConnected()) {
        console.warn('⚠️ [addUserBetReceipt] Socket NOT connected! Retrying in 100ms...');
        setTimeout(emitReceipt, 100);
        return;
      }
      
      try {
        console.log('📤 [addUserBetReceipt] Emitting new receipt to server');
        console.log('   Full Receipt Object:', newReceipt);
        // Emit just the new receipt - server will handle adding to database
        socketIOService.emitBetReceiptsUpdate([newReceipt]);
        console.log('✅ [addUserBetReceipt] Receipt emitted successfully');
      } catch (err) {
        console.error('❌ Error emitting bet receipt:', err);
      }
    };
    
    setTimeout(emitReceipt, 0);
  };
  
  const getUserBetReceipts = (userId: string) => {
    return userBetReceipts.filter(receipt => receipt.userId === userId);
  };
  
  // ✅ GET HARD LEDGER BET RECEIPTS - Read-only view of user's bet receipts (from server)
  const getHardLedgerBetReceipts = (userId: string): UserBetReceipt[] => {
    return JSON.parse(JSON.stringify(userBetReceipts.filter(receipt => receipt.userId === userId)));
  };

  const resetBetReceipts = () => {
    // BET RECEIPTS ARE COMPLETELY IMMUTABLE - NEVER CLEAR THEM
    // This function does NOTHING to ensure bet receipts are never deleted
    console.log('⚠️ Attempt to clear bet receipts BLOCKED - bet receipts are completely immutable');
    
    toast.error("Bet Receipts Protected", {
      description: "Bet receipts cannot be cleared - they're a permanent, immutable ledger",
      className: "custom-toast-error"
    });
    
    // DO NOTHING - No clearing, no modifications, no external interference
    // Even if old code tries to clear, this function will not execute any clearing logic
    // Multiple layers of protection ensure data is never lost
    return;
  };

  // ✅ CLEAR BETTING QUEUE RECEIPTS - DO NOT CLEAR ACTUAL RECEIPTS
  // Bet receipts are IMMUTABLE and PERMANENT ledgers - they must NEVER be cleared
  // This function is kept for backward compatibility but does NOTHING
  const clearBettingQueueReceipts = () => {
    console.log('⏸️ clearBettingQueueReceipts called but BLOCKED - bet receipts are permanent');
    console.log('💾 Bet receipts are immutable and stay visible for all users at all times');
    
    toast.info("Bet Receipts Protected", {
      description: "Bet receipts are permanent and cannot be cleared",
      className: "custom-toast-info"
    });
  };

  const socialLogin = (provider: "google" | "apple"): User => {
    const userId = `${provider}-user-${Date.now()}`;
    const userName = `${provider}User${Math.floor(Math.random() * 1000)}`;
    const randomPassword = Math.random().toString(36).substring(2, 15);
    
    const newUser: User = {
      id: userId,
      name: userName,
      credits: 0,
      password: randomPassword,
      wins: 0,
      losses: 0,
      membershipStatus: 'inactive'
    };
    
    setUsers(prev => [...prev, newUser]);
    setCurrentUser(newUser);
    
    toast.success(`${provider} Login Successful`, {
      description: `Logged in as ${userName}! You can view the scoreboard and betting queues, but need to subscribe to place bets.`,
      className: "custom-toast-success"
    });
    
    return newUser;
  };

  const processCashout = async (userId: string, amount: number): Promise<boolean> => {
    if (amount <= 0) {
      toast.error("Invalid Amount", {
        description: "Please enter a valid amount greater than 0",
        className: "custom-toast-error"
      });
      return false;
    }
    
    const user = users.find(u => u.id === userId);
    if (!user) {
      toast.error("User Not Found", {
        description: "Could not find user account",
        className: "custom-toast-error"
      });
      return false;
    }
    
    try {
      // 💰 Call server API to process cashout
      const response = await fetch(`/api/credits/${userId}/cashout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount })
      });
      
      if (!response.ok) {
        const error = await response.json();
        toast.error("Cashout Failed", {
          description: error.error || 'Insufficient balance or server error',
          className: "custom-toast-error"
        });
        return false;
      }
      
      const data = await response.json();
      const newBalance = data.newBalance;
      
      // Update local state with server-confirmed balance
      setUsers(prev => prev.map(u => {
        if (u.id === userId) {
          const updatedUser = { ...u, credits: newBalance };
          if (currentUser?.id === userId) {
            setCurrentUser(updatedUser);
          }
          return updatedUser;
        }
        return u;
      }));
      
      // Record cashout in transaction history
      addCreditTransaction({
        userId: userId,
        userName: user.name,
        type: 'cashout',
        amount,
        details: 'Cashed out coins from wallet'
      });
      
      toast.success("Cashout Successful", {
        description: `${amount} COINS have been cashed out from your account`,
        className: "custom-toast-success"
      });
      
      return true;
    } catch (error) {
      console.error('❌ [CREDITS] Error processing cashout:', error);
      toast.error("Cashout Failed", {
        description: "Server error - please try again later",
        className: "custom-toast-error"
      });
      return false;
    }
  };

  // 💰 FETCH CURRENT USER BALANCE FROM SERVER ON MOUNT
  // This ensures every browser loads the accurate server balance
  useEffect(() => {
    if (!currentUser) {
      console.log('⚠️ [CREDITS] No current user, skipping balance sync');
      return;
    }

    const syncCurrentUserBalanceFromServer = async () => {
      // Throttle fetches to prevent excessive API calls
      const now = Date.now();
      if (now - lastCreditFetchRef.current < CREDIT_FETCH_THROTTLE_MS) {
        return;
      }
      lastCreditFetchRef.current = now;

      // Skip server fetch in development if backend is not responding
      if (process.env.NODE_ENV === 'development') {
        console.log('⏭️ [CREDITS] Skipping server fetch in development mode');
        return;
      }
      
      try {
        console.log(`📡 [CREDITS] Fetching server balance for user: ${currentUser.id}`);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        
        const response = await fetch(`/api/credits/${currentUser.id}`, { signal: controller.signal });
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          console.warn(`⚠️ [CREDITS] Failed to fetch balance: ${response.status}`);
          return;
        }

        const text = await response.text();
        
        // Check if response is valid JSON
        if (!text || text.trim().length === 0) {
          console.warn('⚠️ [CREDITS] Server returned empty response');
          return;
        }
        
        if (text.includes('<!DOCTYPE') || text.includes('<html')) {
          console.warn('⚠️ [CREDITS] Server returned HTML instead of JSON');
          return;
        }
        
        const data = JSON.parse(text);
        const serverBalance = data.balance;

        console.log(`✅ [CREDITS] Server balance: ${serverBalance}, Local balance: ${currentUser.credits}`);

        // If balances differ, update local state to match server
        if (serverBalance !== currentUser.credits) {
          console.log(`🔄 [CREDITS] Balance mismatch detected! Updating from server...`);
          
          // Update users array with server balance
          setUsers(prev => prev.map(u => {
            if (u.id === currentUser.id) {
              const updatedUser = { ...u, credits: serverBalance };
              console.log(`✅ [CREDITS] Updated ${currentUser.id}: ${u.credits} → ${serverBalance}`);
              return updatedUser;
            }
            return u;
          }));

          // Also update current user to trigger UI re-render
          setCurrentUserWithLogin({ ...currentUser, credits: serverBalance });
        } else {
          console.log(`✅ [CREDITS] Balances match! Current user is in sync`);
        }
      } catch (error) {
        console.error('❌ [CREDITS] Error syncing balance from server:', error);
        console.log('📍 [CREDITS] Keeping local balance, server sync failed');
      }
    };

    // Sync balance on mount
    syncCurrentUserBalanceFromServer();

    // Also sync every 5 seconds to catch remote changes
    const syncInterval = setInterval(syncCurrentUserBalanceFromServer, 5000);
    
    return () => clearInterval(syncInterval);
  }, [currentUser]); // Use full currentUser object to avoid stale closures

  // 💰 LISTEN FOR REAL-TIME CREDIT UPDATES FROM SERVER
  // When another browser updates this user's balance, sync it here
  useEffect(() => {
    if (!currentUser) return;

    const handleCreditUpdate = (data: any) => {
      if (data.userId === currentUser.id) {
        console.log(`💰 [CREDITS-SYNC] Received real-time credit update for ${currentUser.id}: ${data.newBalance}`);
        
        // Update users array
        setUsers(prev => prev.map(u => {
          if (u.id === currentUser.id) {
            console.log(`✅ [CREDITS-SYNC] Updated from socket: ${u.credits} → ${data.newBalance}`);
            return { ...u, credits: data.newBalance };
          }
          return u;
        }));

        // Update current user  
        setCurrentUserWithLogin(prev => {
          if (prev?.id === currentUser.id) {
            const updated = { ...prev, credits: data.newBalance };
            
            // Show toast if significant change
            if (Math.abs(data.newBalance - prev.credits) > 0) {
              toast.info("Balance Updated", {
                description: `Your balance is now ${data.newBalance} coins`,
                className: "custom-toast-info"
              });
            }
            
            return updated;
          }
          return prev;
        });
      }
    };

    // Listen for credit updates from server
    if (socketIOService.isSocketConnected()) {
      socketIOService.socket?.on('credit-update', handleCreditUpdate);
    }

    return () => {
      if (socketIOService.socket) {
        socketIOService.socket.off('credit-update', handleCreditUpdate);
      }
    };
  }, [currentUser?.id]);

  // 👥 FETCH USERS FROM SERVER ON APP LOAD
  // Override localStorage with server data to ensure accuracy
  useEffect(() => {
    const fetchUsersFromServer = async () => {
      // Skip server fetch in development if backend is not responding
      const skipServerFetch = process.env.NODE_ENV === 'development';
      
      if (skipServerFetch) {
        console.log('⏭️ [USERS] Skipping server fetch in development mode - using local/fallback users');
        return;
      }
      
      try {
        console.log('📡 [USERS] Fetching users from server...');
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        
        const response = await fetch('/api/users', { signal: controller.signal });
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          console.warn('⚠️ [USERS] Failed to fetch users from server, status:', response.status);
          return;
        }
        
        const text = await response.text();
        
        // Check if response is actually JSON
        if (!text || text.trim().length === 0) {
          console.warn('⚠️ [USERS] Server returned empty response');
          return;
        }
        
        if (text.includes('<!DOCTYPE') || text.includes('<html')) {
          console.warn('⚠️ [USERS] Server returned HTML instead of JSON (likely error page)');
          return;
        }
        
        const serverUsers = JSON.parse(text);
        
        if (!Array.isArray(serverUsers)) {
          console.warn('⚠️ [USERS] Server did not return an array:', serverUsers);
          return;
        }
        
        console.log(`✅ [USERS] Loaded ${serverUsers.length} users from server`);
        
        // Update local state with server users (overrides localStorage)
        setUsers(serverUsers);
        
        // Also save to localStorage for fallback
        try {
          localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(serverUsers));
          console.log('💾 [USERS] Synced users to localStorage backup');
        } catch (e) {
          console.warn('⚠️ [USERS] Could not save to localStorage:', e);
        }
      } catch (error) {
        console.error('❌ [USERS] Error fetching users from server:', error);
        console.log('📍 [USERS] Falling back to localStorage or default admin');
      }
    };
    
    // Fetch users on mount
    fetchUsersFromServer();
    
    // Also fetch every 10 seconds to keep credits fresh
    const refreshInterval = setInterval(fetchUsersFromServer, 10000);
    
    return () => clearInterval(refreshInterval);
  }, []);

  // Socket listener for connected users coins updates
  useEffect(() => {
    // Set up the listener once
    socketIOService.onConnectedUsersCoinsUpdate((data) => {
      console.log('📊 Received connected users coins update:', data);
      setConnectedUsersCoins(data);
    });
    
    // Request initial data
    if (socketIOService.isSocketConnected()) {
      socketIOService.requestConnectedUsersData();
    }
  }, []);

  // ✅ RECOVERY: Restore multiple users at once
  const restoreUsers = (usersToRestore: User[]) => {
    console.log(`🔧 [RECOVERY] Restoring ${usersToRestore.length} users...`);
    setUsers(prev => {
      const newUsers = [...prev];
      for (const userToRestore of usersToRestore) {
        const exists = newUsers.find(u => u.id === userToRestore.id);
        if (!exists) {
          newUsers.push(userToRestore);
          console.log(`✅ [RECOVERY] Restored user: ${userToRestore.name} (${userToRestore.id})`);
        }
      }
      try {
        localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(newUsers));
      } catch (e) {
        console.error('❌ [RECOVERY] Failed to save:', e);
      }
      return newUsers;
    });
    toast.success(`Restored ${usersToRestore.length} users!`, {
      className: "custom-toast-success"
    });
  };

  return (
    <UserContext.Provider
      value={{
        users,
        currentUser,
        setCurrentUser: setCurrentUserWithLogin,
        addUser,
        authenticateUser,
        addCredits,
        deductCredits,
        getUserById,
        getAllUsers,
        betHistory: immutableBetHistory, // Expose immutableBetHistory as betHistory
        addBetHistoryRecord,
        resetBetHistory,
        getHardLedgerBetHistory,
        incrementWins,
        incrementLosses,
        socialLogin,
        userBetReceipts,
        addUserBetReceipt,
        getUserBetReceipts,
        getHardLedgerBetReceipts,
        resetBetReceipts,
        clearBettingQueueReceipts,
        processCashout,
        creditTransactions,
        getCreditTransactions,
        activateMembership,
        isUsersLoaded,
        connectedUsersCoins,
        // ✅ NEW: Pending bets system
        addPendingBet,
        getPendingBetAmount,
        getAvailableCredits,
        processPendingBets,
        refundPendingBet,
        updatePendingBetMatched,
        restoreUsers,
        // ✅ AUDIT functions
        auditCoins,
        auditBets,
        systemHealthCheck,
      }}
    >
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context;
};
