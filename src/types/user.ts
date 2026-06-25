
export interface PendingBet {
  id: string;
  amount: number;
  team: 'A' | 'B';
  gameNumber: number;
  timestamp: number;
  status: 'pending' | 'matched' | 'processing';
  teamName?: string;
  opponentName?: string;
}

export interface ProcessedBet {
  id: string;
  amount: number;
  won: boolean;
  gameNumber: number;
  timestamp: number;
  teamName?: string;
  opponentName?: string;
}

export interface User {
  id: string;
  name: string;
  credits: number;
  password: string;
  wins: number;
  losses: number;
  membershipStatus: 'inactive' | 'active';
  subscriptionDate?: number;
  pendingBets?: PendingBet[];
  processedBets?: ProcessedBet[];
}

export interface BetHistoryRecord {
  id: string;
  gameNumber: number;
  timestamp: number;
  teamAName: string;
  teamBName: string;
  teamAScore: number;
  teamBScore: number;
  winningTeam: 'A' | 'B' | 'Tie';
  bets: {
    teamA: GameBet[];
    teamB: GameBet[];
  };
  teamABalls?: number;
  teamBBalls?: number;
  breakingTeam?: 'A' | 'B';
  duration?: number;
  totalAmount?: number;
}

export interface GameBet {
  userId: string;
  userName: string;
  amount: number;
  won: boolean;
  booked: boolean;
  startingBalance?: number;
}

export interface UserBetReceipt {
  id: string;
  userId: string;
  userName: string;
  gameNumber: number;
  teamName: string;
  opponentName: string;
  teamAName?: string;
  teamBName?: string;
  teamAScore?: number;
  teamBScore?: number;
  amount: number;
  won: boolean;
  teamSide: 'A' | 'B';
  winningTeam?: 'A' | 'B' | 'Tie';
  arenaId?: string;
  duration?: number;
  timestamp: number;
  transactionType?: 'bet' | 'admin_add' | 'admin_deduct' | 'cashout';
}

export interface CreditTransaction {
  id: string;
  userId: string;
  userName: string;
  type: 'deposit' | 'withdrawal' | 'subscription' | 'admin_add' | 'admin_deduct' | 'cashout' | 'bet_refund';
  amount: number;
  details: string;
  timestamp: number;
}

// Additional types needed by components
export interface Bet {
  id: number;
  amount: number;
  color: string | null;
  booked: boolean;
  userId: string;
  userName?: string; // Added for cross-browser synchronization
  teamSide: 'A' | 'B';
}

export interface BookedBet {
  idA: number;
  idB: number;
  amount: number;
  userIdA: string;
  userIdB: string;
}

export interface ConfirmationState {
  isOpen: boolean;
  team: string;
  teamSide: 'A' | 'B' | null;
  amount: number;
  isNextGame: boolean;
}
