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
  | 'membership_renew'
  | 'transfer_sent'
  | 'transfer_received'
  | 'challenge_escrow'
  | 'challenge_win'
  | 'challenge_refund';

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
  gameType: string;
  timerStartedAt: number | null;
  timerElapsedMs: number;
  isTimerRunning: boolean;
  timerVersion?: number;
  lastWinner: 'A' | 'B' | null;
  preGameBalances: Record<string, number>;
}

export interface SnapshotBet {
  opponentName: string;
  amount: number;
  won: boolean;
}

export interface GameBalanceSnapshot {
  id: string;
  gameNumber: number;
  timestamp: number;
  winningTeam: 'A' | 'B';
  totalBefore: number;
  totalAfter: number;
  players: { userId: string; name: string; before: number; after: number; bets: SnapshotBet[] }[];
}

export type AdminAuditEventType = 'admin_add' | 'admin_deduct' | 'user_created' | 'user_deleted' | 'reload' | 'tip';

export interface AdminAuditEvent {
  id: string;
  timestamp: number;
  type: AdminAuditEventType;
  description: string;
  amount: number;
  userName?: string;
  fromUserName?: string;
  toUserName?: string;
  balanceBefore?: number;
  balanceAfter?: number;
}

export type ChallengeStatus = 'pending' | 'accepted' | 'judged' | 'cancelled';

export interface Challenge {
  id: string;
  creatorId: string;
  creatorName: string;
  opponentId: string;
  opponentName: string;
  amount: number;
  judgeToken: string;
  judgePhone: string;
  judgeLink?: string;
  myPlayer: string;
  theirPlayer: string;
  betType?: 'game' | 'match';
  status: ChallengeStatus;
  winnerId?: string;
  winnerName?: string;
  createdAt: number;
  acceptedAt?: number;
  judgedAt?: number;
}

export interface CoinAuditEntry {
  id: string;
  timestamp: number;
  expected: number;
  actual: number;
  drift: number;
  trigger: string;
  acknowledged: boolean;
}
