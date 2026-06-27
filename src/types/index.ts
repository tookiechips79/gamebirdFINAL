export type TransactionType =
  | 'bet_placed'
  | 'bet_refund'
  | 'bet_win'
  | 'bet_loss'
  | 'tip_given'
  | 'tip_received'
  | 'admin_add'
  | 'admin_deduct'
  | 'cashout'
  | 'membership_activate'
  | 'membership_cancel'
  | 'membership_renew';

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  description: string;
  timestamp: number;
}

export type MembershipTier = 'free' | 'premium';

export interface Membership {
  tier: MembershipTier;
  startedAt: number;
  renewsAt: number | null;
  cancelledAt: number | null;
}

export interface User {
  id: string;
  name: string;
  pin?: string;
  referredBy?: string;
  credits: number;
  isAdmin?: boolean;
  pendingBets?: PendingBet[];
  online?: boolean;
  tipsGiven?: number;
  tipsReceived?: number;
  transactions?: Transaction[];
  membership?: Membership;
}

export interface PendingBet {
  id: string;
  gameNumber: number;
  amount: number;
  teamSide: 'A' | 'B';
}

export interface Bet {
  id: string;
  userId: string;
  userName: string;
  amount: number;
  teamSide: 'A' | 'B';
  gameNumber: number;
  booked: boolean;
  color?: string;
  timestamp: number;
}

export interface BookedBet {
  id: string;
  betIdA: string;
  betIdB: string;
  userIdA: string;
  userIdB: string;
  userNameA: string;
  userNameB: string;
  amount: number;
  gameNumber: number;
}

export interface GameBet {
  userId: string;
  userName: string;
  amount: number;
  won: boolean;
  booked: boolean;
  startingBalance?: number;
}

export interface GameRecord {
  id: string;
  gameNumber: number;
  timestamp: number;
  teamAName: string;
  teamBName: string;
  teamAScore: number;
  teamBScore: number;
  teamABalls: number;
  teamBBalls: number;
  winningTeam: 'A' | 'B';
  bets: { teamA: GameBet[]; teamB: GameBet[] };
  totalAmount: number;
  duration: number;
}

export interface GameState {
  teamAName: string;
  teamBName: string;
  teamAGames: number;
  teamBGames: number;
  teamABalls: number;
  teamBBalls: number;
  teamAHasBreak: boolean;
  currentGameNumber: number;
  teamAQueue: Bet[];
  teamBQueue: Bet[];
  nextTeamAQueue: Bet[];
  nextTeamBQueue: Bet[];
  bookedBets: BookedBet[];
  nextBookedBets: BookedBet[];
  totalBookedAmount: number;
  nextTotalBookedAmount: number;
  betCounter: number;
  gameDescription: string;
  timerStartedAt: number | null;
  timerElapsedMs: number;
  isTimerRunning: boolean;
  timerVersion?: number;
  lastWinner: 'A' | 'B' | null;
}
