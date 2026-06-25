import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Link, useLocation } from "react-router-dom";
import { 
  ArrowLeft, Zap, Coins, CheckSquare, Unlock, 
  Wallet, TimerReset, ReceiptText, SkipForward, ArrowDownUp, ArrowDown, Trash2
} from "lucide-react";
import NumericAnimation from "@/components/NumericAnimation";
import ScoreBoard from "@/components/ScoreBoard";
import GameDescription from "@/components/GameDescription";
import UserCreditSystem, { UserSelector } from "@/components/UserCreditSystem";
import UserWidgetsContainer from "@/components/UserWidgetsContainer";
import BookedBetsReceipt from "@/components/BookedBetsReceipt";
import BetLedger from "@/components/BetLedger";
import BetReceiptsLedger from "@/components/BetReceiptsLedger";
import BirdButton from "@/components/BirdButton";
import GameInfoWindow from "@/components/GameInfoWindow";
import GameHistoryWindow from "@/components/GameHistoryWindow";
import { useUser } from "@/contexts/UserContext";
import { useGameState } from "@/contexts/GameStateContext";
import { Bet, BookedBet, ConfirmationState } from "@/types/user";
import { socketIOService } from "@/services/socketIOService";
import { coinAuditService } from "@/services/coinAudit";
import { useSound } from "@/hooks/use-sound";
import SocketIOStatus from "@/components/SocketIOStatus";

// ============================================================================
// ONE POCKET ARENA - SEPARATE BETTING QUEUE WITH INDEPENDENT DATA
// This arena syncs only with itself, not with the 9 Ball Arena
// ============================================================================

const OnePocketArena = () => {
  const { 
    currentUser, 
    deductCredits, 
    addCredits, 
    getUserById, 
    addBetHistoryRecord, 
    incrementWins, 
    incrementLosses,
    clearBettingQueueReceipts,
    userBetReceipts,
    betHistory,
    processPendingBets,
    getAvailableCredits,
    getPendingBetAmount
  } = useUser();

  // ⚠️ CRITICAL: DO NOT call addCredits() for unmatched bets
  // They were never deducted - just remove from pending
  
  const { gameState, updateGameState, isAdmin, localAdminState, updateLocalAdminState, startTimer, pauseTimer, resetTimer, setTimer, resetTimerOnMatchStart, resetTimerOnGameWin } = useGameState();
  
  const location = useLocation();
  
  // Ref to track previous bet queue sizes for detecting new bets
  const prevQueueSizesRef = useRef({ teamA: 0, teamB: 0 });
  
  // Ref to track if we should mute cheer sound on win button
  const muteCheerOnWinRef = useRef(false);
  
  // Ref to track if we should mute pool/boo sounds (e.g., when plus/minus buttons are clicked)
  const mutePoolBooSoundsRef = useRef(false);

  // Sound effect for bet placement
  const { play: playSilverSound, stop: stopSilverSound } = useSound('/silver.mp3', { volume: 0.8 });
  
  // Sound effects for other game events
  const { play: playCheerSound, stop: stopCheerSound } = useSound('/cheer.mp3', { volume: 0.8 });
  const { play: playPoolSound, stop: stopPoolSound } = useSound('/pool.mp3', { volume: 0.8 });
  const { play: playBooSound, stop: stopBooSound } = useSound('/boo.mp3', { volume: 0.8 });
  
  // Ref to track previous state for detecting changes
  const prevStateRef = useRef({ 
    teamA: 0, 
    teamB: 0,
    bookedCount: 0,
    nextBookedCount: 0,
    gameNumber: 0,
    teamABalls: 0,
    teamBBalls: 0
  });

  // Ref to track if component is unmounting (switching arenas)
  const isUnmountingRef = useRef(false);

  // Extract state from gameState context
  const {
    teamAQueue,
    teamBQueue,
    nextTeamAQueue,
    nextTeamBQueue,
    bookedBets,
    totalBookedAmount,
    nextBookedBets,
    nextTotalBookedAmount,
    teamAName,
    teamBName,
    teamAGames,
    teamABalls,
    teamBGames,
    teamBBalls,
    teamAHasBreak,
    gameLabel,
    currentGameNumber,
    gameDescription,
    betCounter,
    colorIndex,
    timerSeconds,
    isTimerRunning,
    timerStartTime
  } = gameState;

  // Extract local admin state (not synchronized)
  const { isAdminMode, isAgentMode } = localAdminState;
  
  const [betId, setBetId] = useState<string>("");
  
  // Track admin lock state - when true, scoreboard and controls are disabled
  const [adminLocked, setAdminLocked] = useState<boolean>(true);
  
  // Ref to access CompactAdminWidget's openModal method
  const adminModalRef = useRef<{ openModal: () => void }>(null);
  
  const betColors = ["#00FF00", "#00FFFF", "#FF00FF", "#FFFF00", "#1EAEDB"];
  
  const [confirmation, setConfirmation] = useState<ConfirmationState>({
    isOpen: false,
    team: '',
    teamSide: null,
    amount: 0,
    isNextGame: false
  });

  // Log betting queue changes for debugging
  useEffect(() => {
    console.log(`💰 [BET QUEUE - ONE POCKET] Team A Queue: ${teamAQueue.length} bets`, teamAQueue);
    console.log(`💰 [BET QUEUE - ONE POCKET] Team B Queue: ${teamBQueue.length} bets`, teamBQueue);
  }, [teamAQueue, teamBQueue]);

  // Detect new bets and play sound once per new bet
  useEffect(() => {
    const teamANewBets = teamAQueue.length - prevQueueSizesRef.current.teamA;
    const teamBNewBets = teamBQueue.length - prevQueueSizesRef.current.teamB;

    // Only play sound if we're on this page AND not unmounting
    const isOnThisPage = location.pathname === "/one-pocket-arena";
    if ((teamANewBets > 0 || teamBNewBets > 0) && !isUnmountingRef.current && isOnThisPage) {
      console.log(`🔊 [BET SOUND - ONE POCKET] New bets detected! Team A: +${teamANewBets}, Team B: +${teamBNewBets}`);
      playSilverSound();
    }

    // Update refs
    prevQueueSizesRef.current = {
      teamA: teamAQueue.length,
      teamB: teamBQueue.length
    };
  }, [teamAQueue, teamBQueue, playSilverSound, location.pathname]);

  // Detect booked bets and play pool/match sound
  useEffect(() => {
    const newBookedCount = bookedBets.length;
    const prevBookedCount = prevStateRef.current.bookedCount;
    
    if (newBookedCount > prevBookedCount) {
      console.log(`🔊 [MATCH SOUND - ONE POCKET] Bets matched! New booked count: ${newBookedCount}`);
      // playPoolSound(); // DISABLED: Pool sound turned off for matched bets
    }
    
    prevStateRef.current.bookedCount = newBookedCount;
  }, [bookedBets, playPoolSound]);

  // Detect next game bets placed in queues and play silver sound
  useEffect(() => {
    // Count total next game bets (both queues combined)
    const newNextGameBetCount = nextTeamAQueue.length + nextTeamBQueue.length;
    const prevNextGameBetCount = prevStateRef.current.nextBookedCount || 0;
    
    if (newNextGameBetCount > prevNextGameBetCount) {
      console.log(`🔊 [NEXT GAME BET SOUND - ONE POCKET] Next game bet placed! New count: ${newNextGameBetCount}`);
      playSilverSound();
    }
    
    prevStateRef.current.nextBookedCount = newNextGameBetCount;
  }, [nextTeamAQueue, nextTeamBQueue, playSilverSound]);

  // ✅ RECOVERY: Periodically check and recover missing matched bets
  useEffect(() => {
    const recoveryInterval = setInterval(() => {
      // Only run recovery if there are booked bets to check
      if (bookedBets.length > 0) {
        const recoveredCount = recoverMissingMatchedBets();
        if (recoveredCount > 0) {
          toast.warning("Matched Bets Recovered", {
            description: `${recoveredCount} missing bet side(s) were recovered and restored.`,
            className: "custom-toast-warning"
          });
        }
      }
    }, 5000); // Check every 5 seconds
    
    return () => clearInterval(recoveryInterval);
  }, [bookedBets, teamAQueue, teamBQueue]);

  // Detect game wins and play cheer sound
  useEffect(() => {
    const newGameNumber = currentGameNumber;
    const prevGameNumber = prevStateRef.current.gameNumber;
    
    if (newGameNumber > prevGameNumber && prevGameNumber > 0) {
      // Check if cheer sound should be muted (e.g., when win button is clicked)
      if (muteCheerOnWinRef.current) {
        console.log(`🔊 [WIN SOUND - ONE POCKET] Game won but cheer MUTED - New game number: ${newGameNumber}`);
        muteCheerOnWinRef.current = false; // Reset the flag
      } else {
        console.log(`🔊 [WIN SOUND - ONE POCKET] Game won! New game number: ${newGameNumber}`);
        playCheerSound();
      }
    }
    
    prevStateRef.current.gameNumber = newGameNumber;
  }, [currentGameNumber, playCheerSound]);

  // Detect ball count increases and decreases and play sounds
  useEffect(() => {
    const teamABallsIncreased = teamABalls > prevStateRef.current.teamABalls;
    const teamBBallsIncreased = teamBBalls > prevStateRef.current.teamBBalls;
    const teamABallsDecreased = teamABalls < prevStateRef.current.teamABalls;
    const teamBBallsDecreased = teamBBalls < prevStateRef.current.teamBBalls;
    
    // Only play sounds if ball count ACTUALLY changed (not on initial render)
    const ballCountChanged = teamABallsIncreased || teamABallsDecreased || teamBBallsIncreased || teamBBallsDecreased;
    const notInitialRender = prevStateRef.current.teamABalls !== 0 || prevStateRef.current.teamBBalls !== 0;
    
    // Play pool sound ONCE if any team's balls increased (and it's not initial render)
    if ((teamABallsIncreased || teamBBallsIncreased) && notInitialRender) {
      // Check if pool/boo sounds should be muted (e.g., when plus button is clicked)
      if (mutePoolBooSoundsRef.current) {
        console.log(`🔊 [BALL SOUND - ONE POCKET] Balls increased but pool sound MUTED`);
        mutePoolBooSoundsRef.current = false; // Reset the flag
      } else {
        if (teamABallsIncreased) {
          console.log(`🔊 [BALL SOUND - ONE POCKET] Team A ball count increased from ${prevStateRef.current.teamABalls} to ${teamABalls}`);
        }
        if (teamBBallsIncreased) {
          console.log(`🔊 [BALL SOUND - ONE POCKET] Team B ball count increased from ${prevStateRef.current.teamBBalls} to ${teamBBalls}`);
        }
        playPoolSound();
      }
    }
    
    // Play boo sound ONCE if any team's balls decreased (and it's not initial render)
    if ((teamABallsDecreased || teamBBallsDecreased) && notInitialRender) {
      // Check if pool/boo sounds should be muted (e.g., when minus button is clicked)
      if (mutePoolBooSoundsRef.current) {
        console.log(`🔊 [BALL MINUS SOUND - ONE POCKET] Balls decreased but boo sound MUTED`);
        mutePoolBooSoundsRef.current = false; // Reset the flag
      } else {
        if (teamABallsDecreased) {
          console.log(`🔊 [BALL MINUS SOUND - ONE POCKET] Team A ball count decreased from ${prevStateRef.current.teamABalls} to ${teamABalls}`);
        }
        if (teamBBallsDecreased) {
          console.log(`🔊 [BALL MINUS SOUND - ONE POCKET] Team B ball count decreased from ${prevStateRef.current.teamBBalls} to ${teamBBalls}`);
        }
        playBooSound();
      }
    }
    
    // Only update refs if there's an actual change (prevents stale refs)
    if (ballCountChanged) {
      prevStateRef.current.teamABalls = teamABalls;
      prevStateRef.current.teamBBalls = teamBBalls;
    }
  }, [teamABalls, teamBBalls, playPoolSound, playBooSound]);

  const generateBetId = () => {
    // Generate a 7-digit unique ID using counter + random number
    const random = Math.floor(Math.random() * 1000);
    const paddedCounter = betCounter.toString().padStart(4, '0');
    const newId = parseInt(`${paddedCounter}${random.toString().padStart(3, '0')}`);
    updateGameState({ betCounter: betCounter + 1 });
    return newId;
  };

  const toggleAdminMode = () => {
    // Password is now handled in AdminWidget, so we just toggle the state
    updateLocalAdminState({ isAdminMode: !isAdminMode });
  };

  const toggleAgentMode = () => {
    updateLocalAdminState({ isAgentMode: !isAgentMode });
    if (!isAgentMode) {
      toast.success("Agent Mode Activated", {
        description: "You now have access to game controls",
        className: "custom-toast-success",
      });
    } else {
      toast.info("Agent Mode Deactivated", {
        className: "custom-toast-success",
      });
    }
  };

  const moveBetsToNextGame = () => {
    if (!teamAQueue.length && !teamBQueue.length) {
      toast.error("No Bets to Move", {
        description: "There are no current bets to move to the next game",
        className: "custom-toast-error",
      });
      return;
    }

    updateGameState({
      nextTeamAQueue: [...nextTeamAQueue, ...teamAQueue],
      nextTeamBQueue: [...nextTeamBQueue, ...teamBQueue],
      nextBookedBets: [...nextBookedBets, ...bookedBets],
      nextTotalBookedAmount: nextTotalBookedAmount + totalBookedAmount,
      teamAQueue: [],
      teamBQueue: [],
      bookedBets: [],
      totalBookedAmount: 0
    });

    toast.success("Bets Moved to Next Game", {
      description: "All current bets have been moved to the next game",
      className: "custom-toast-success",
    });
  };

  const moveBetsToCurrentGame = () => {
    if (!nextTeamAQueue.length && !nextTeamBQueue.length) {
      toast.error("No Bets to Move", {
        description: "There are no next-game bets to move to the current game",
        className: "custom-toast-error",
      });
      return;
    }

    updateGameState({
      teamAQueue: [...teamAQueue, ...nextTeamAQueue],
      teamBQueue: [...teamBQueue, ...nextTeamBQueue],
      bookedBets: [...bookedBets, ...nextBookedBets],
      totalBookedAmount: totalBookedAmount + nextTotalBookedAmount,
      nextTeamAQueue: [],
      nextTeamBQueue: [],
      nextBookedBets: [],
      nextTotalBookedAmount: 0
    });

    toast.success("Bets Moved to Current Game", {
      description: "All next-game bets have been moved to the current game",
      className: "custom-toast-success",
    });
  };

  const handleTeamAWin = async (duration: number) => {
    console.log('🏆 [handleTeamAWin] WIN BUTTON CLICKED FOR TEAM A!');
    // Pause timer when game is won (don't reset it)
    pauseTimer();
    
    // Set flag to mute cheer sound when win button is clicked
    muteCheerOnWinRef.current = true;
    
    toast.success(`${teamAName} Wins!`, {
      description: `${teamAName} has won a game`,
      className: "custom-toast-success",
    });

    // Process bets FIRST before incrementing game counter
    // AWAIT the async credit operations to complete
    await processBetsForGameWin('A', duration);
    
    // Increment game counter and game number AFTER bets are processed
    // Using 500ms to ensure all bet processing is complete
    setTimeout(() => {
      console.log('🏆 [handleTeamAWin] Incrementing game counter after bet processing');
      console.log(`   Previous: teamAGames=${teamAGames}, currentGameNumber=${currentGameNumber}`);
      console.log(`   About to call updateGameState with: { teamAGames: ${teamAGames + 1}, currentGameNumber: ${currentGameNumber + 1} }`);
      updateGameState({
        teamAGames: teamAGames + 1,
        teamABalls: 0,
        teamBBalls: 0,
        teamAHasBreak: !teamAHasBreak,
        currentGameNumber: currentGameNumber + 1
      });
      console.log(`   Updated: teamAGames=${teamAGames + 1}, currentGameNumber=${currentGameNumber + 1}`);
    }, 500);
    
    // Timer will be controlled by admin (pause/resume/reset)
  };

  const handleTeamBWin = async (duration: number) => {
    console.log('🏆 [handleTeamBWin - ONE POCKET] WIN BUTTON CLICKED FOR TEAM B!');
    // Pause timer when game is won (don't reset it)
    pauseTimer();
    
    // Set flag to mute cheer sound when win button is clicked
    muteCheerOnWinRef.current = true;
    
    toast.success(`${teamBName} Wins!`, {
      description: `${teamBName} has won a game`,
      className: "custom-toast-success",
    });

    // Process bets FIRST before incrementing game counter
    // AWAIT the async credit operations to complete
    await processBetsForGameWin('B', duration);
    
    // Increment game counter and game number AFTER bets are processed
    // Using 500ms to ensure all bet processing is complete
    setTimeout(() => {
      console.log('🏆 [handleTeamBWin - ONE POCKET] Incrementing game counter after bet processing');
      console.log(`   Previous: teamBGames=${teamBGames}, currentGameNumber=${currentGameNumber}`);
      console.log(`   About to call updateGameState with: { teamBGames: ${teamBGames + 1}, currentGameNumber: ${currentGameNumber + 1} }`);
      updateGameState({
        teamBGames: teamBGames + 1,
        teamABalls: 0,
        teamBBalls: 0,
        teamAHasBreak: !teamAHasBreak,
        currentGameNumber: currentGameNumber + 1
      });
      console.log(`   Updated: teamBGames=${teamBGames + 1}, currentGameNumber=${currentGameNumber + 1}`);
    }, 500);
    
    // Timer will be controlled by admin (pause/resume/reset)
  };
  
  const processBetsForGameWin = async (winningTeam: 'A' | 'B', duration: number) => {
    // Calculate each user's balance before ANY bet this game was placed.
    // Bets are deducted immediately when placed (pending bets system), so
    // true pre-game balance = currentCredits + sum(all bets placed this game by that user).
    const allBets = [...teamAQueue, ...teamBQueue];
    const betSumByUser: Record<string, number> = {};
    allBets.forEach(b => { betSumByUser[b.userId] = (betSumByUser[b.userId] || 0) + b.amount; });
    const preGameBalances: Record<string, number> = {};
    Object.keys(betSumByUser).forEach(id => {
      const u = getUserById(id);
      if (u) preGameBalances[id] = u.credits + betSumByUser[id];
    });

    console.log(`🎮 [GAME-WIN] Processing bets for Game #${currentGameNumber}, winning team: ${winningTeam}`);
    console.log(`🎮 [GAME-WIN] Team A bets: ${teamAQueue.length}, Team B bets: ${teamBQueue.length}`);
    console.log(`🎮 [GAME-WIN] Team A amount: ${teamAQueue.reduce((s, b) => s + b.amount, 0)}, Team B amount: ${teamBQueue.reduce((s, b) => s + b.amount, 0)}`);
    await processPendingBets(currentGameNumber, winningTeam, teamAQueue, teamBQueue, bookedBets);
    
    // 📊 START COIN AUDIT - Take pre-game snapshot
    const gameId = `game-${Date.now()}`;
    const allUsers = Object.values(gameState.users || {});
    const preGameAudit = coinAuditService.startGameAudit(
      gameId,
      gameState.arenaId || 'unknown',
      allUsers
    );
    
    // Include ALL bets (both booked and unbooked) in game history for accurate tracking
    // Track running deductions per user so each bet shows balance before THAT specific bet
    const runningDeductions: Record<string, number> = {};
    const getBalanceBeforeBet = (userId: string, betAmount: number) => {
      const prior = runningDeductions[userId] || 0;
      const balBefore = (preGameBalances[userId] ?? 0) - prior;
      runningDeductions[userId] = prior + betAmount;
      return balBefore;
    };

    const teamABets = teamAQueue.map(bet => {
      const user = getUserById(bet.userId);
      return {
        userId: bet.userId,
        userName: bet.userName || user?.name || 'User',
        amount: bet.amount,
        won: winningTeam === 'A',
        booked: bet.booked,
        startingBalance: getBalanceBeforeBet(bet.userId, bet.amount),
      };
    });

    const teamBBets = teamBQueue.map(bet => {
      const user = getUserById(bet.userId);
      return {
        userId: bet.userId,
        userName: bet.userName || user?.name || 'User',
        amount: bet.amount,
        won: winningTeam === 'B',
        booked: bet.booked,
        startingBalance: getBalanceBeforeBet(bet.userId, bet.amount),
      };
    });
    
    // ✅ CRITICAL FIX: Only count BOOKED bets in total amount (matched bets only)
    const gameTotalAmount = [...teamABets, ...teamBBets]
      .filter(bet => bet.booked)
      .reduce((total, bet) => total + bet.amount, 0);
    
    const gameHistoryRecord = {
      gameNumber: currentGameNumber,
      teamAName,
      teamBName,
      teamAScore: winningTeam === 'A' ? 1 : 0,
      teamBScore: winningTeam === 'B' ? 1 : 0,
      winningTeam,
      teamABalls,
      teamBBalls,
      breakingTeam: teamAHasBreak ? 'A' : 'B',
      duration,
      bets: {
        teamA: teamABets,
        teamB: teamBBets
      },
      totalAmount: gameTotalAmount,
      arenaId: gameState.arenaId || 'default'  // 🎮 IMPORTANT: Include arena ID for server sync
    };
    
    addBetHistoryRecord(gameHistoryRecord);
    
    // ✅ NEW: All credit processing is now handled by processPendingBets() above
    // DO NOT add more credit transfers here - it will create duplicate coins!
    // The old logic below has been removed to prevent coin duplication
    console.log(`✅ [BET-PROCESSING] Booked bets (${bookedBets.length}) already processed via processPendingBets()`);
    
    // ✅ NEW: Remove unmatched bets from PENDING (don't create coins!)
    // With pending bets system, unmatched bets were never deducted
    // So just remove them from pending - no refunds needed
    
    // 1. Remove unmatched CURRENT game bets from pending
    const unmatchedCurrentBetsA = teamAQueue.filter(bet => !bet.booked);
    const unmatchedCurrentBetsB = teamBQueue.filter(bet => !bet.booked);
    const allUnmatchedCurrentBets = [...unmatchedCurrentBetsA, ...unmatchedCurrentBetsB];
    
    let totalCurrentUnmatched = 0;
    for (const bet of allUnmatchedCurrentBets) {
      const user = getUserById(bet.userId);
      if (user) {
        console.log(`🔄 [UNMATCHED-CURRENT] Removing unmatched current game bet #${bet.id}: ${user.name} - ${bet.amount} coins freed`);
        totalCurrentUnmatched += bet.amount;
      }
    }
    
    if (totalCurrentUnmatched > 0) {
      console.log(`✅ [UNMATCHED-CURRENT] Total unmatched current bets removed: ${totalCurrentUnmatched} COINS`);
    }
    
    // 2. Refund unmatched NEXT game bets
    const unmatchedNextBetsA = nextTeamAQueue.filter(bet => !bet.booked);
    const unmatchedNextBetsB = nextTeamBQueue.filter(bet => !bet.booked);

    if (unmatchedNextBetsA.length > 0 || unmatchedNextBetsB.length > 0) {
      console.log(`🔄 [UNMATCHED-NEXT] Refunding ${unmatchedNextBetsA.length + unmatchedNextBetsB.length} unmatched next-game bets`);
      // Use a sentinel game number so pending bets for the next game are cleared correctly
      await processPendingBets(currentGameNumber + 1, winningTeam, unmatchedNextBetsA, unmatchedNextBetsB, []);
    }
    
    const nextMatchedBetsA = nextTeamAQueue.filter(bet => bet.booked);
    const nextMatchedBetsB = nextTeamBQueue.filter(bet => bet.booked);
    const nextMatchedBooked = [...nextBookedBets];
    const nextTotal = nextTotalBookedAmount;
    
    updateGameState({
      teamAQueue: [],
      teamBQueue: [],
      bookedBets: [],
      totalBookedAmount: 0,
      nextTeamAQueue: [],
      nextTeamBQueue: [],
      nextBookedBets: [],
      nextTotalBookedAmount: 0
    });
    
    setTimeout(() => {
      updateGameState({
        teamAQueue: nextMatchedBetsA,
        teamBQueue: nextMatchedBetsB,
        bookedBets: nextMatchedBooked,
        totalBookedAmount: nextTotal
      });
      
      if (nextMatchedBetsA.length > 0 || nextMatchedBetsB.length > 0) {
        toast.success("Next Game Matched Bets Moved to Current Game", {
          description: "All matched bets for the next game are now active for the current game",
          className: "custom-toast-success",
        });
      }
    }, 100);
    
    updateGameState({ betCounter: 1 });
    
    toast.success("All Bets Processed", {
      description: "A new betting round can begin",
      className: "custom-toast-success",
    });
    
    // NOTE: Game history is already emitted from addBetHistoryRecord(), don't duplicate here
    // Only emit the bet state clearing so other clients clear their queues
    console.log('📤 [processBetsForGameWin] Emitting cleared bet queues to all clients');
    try {
      socketIOService.emitBetUpdate({
        teamAQueue: [],
        teamBQueue: [],
        bookedBets: [],
        totalBookedAmount: 0,
        nextGameBets: [],
        nextTeamAQueue: [],
        nextTeamBQueue: [],
        nextTotalBookedAmount: 0
      });
    } catch (err) {
      console.error('❌ Error emitting bet update:', err);
    }

    // 📊 END COIN AUDIT - Take post-game snapshot and compare
    const postGameUsers = Object.values(gameState.users || {});
    let totalWinnerGain = 0;
    let totalLoserLoss = 0;

    // Calculate winner and loser changes
    if (bookedBets.length > 0) {
      bookedBets.forEach(bet => {
        const userA = getUserById(bet.userIdA);
        const userB = getUserById(bet.userIdB);
        
        if (userA && userB && bet.userIdA !== bet.userIdB) {
          // Only count real matches, not self-bets
          totalWinnerGain += bet.amount;
          totalLoserLoss += bet.amount;
        }
      });
    }

    coinAuditService.endGameAudit(
      gameId,
      gameState.arenaId || 'unknown',
      postGameUsers,
      {
        matched: bookedBets.filter(b => b.booked).length,
        unmatchedRefunded: (teamAQueue.filter(b => !b.booked).length + 
                           teamBQueue.filter(b => !b.booked).length +
                           nextTeamAQueue.filter(b => !b.booked).length +
                           nextTeamBQueue.filter(b => !b.booked).length),
        totalAmount: gameTotalAmount,
      },
      totalWinnerGain,
      totalLoserLoss
    );

    // Log audit summary
    const summary = coinAuditService.getAuditSummary(gameState.arenaId || 'unknown');
    console.log(`\n📊 [AUDIT-SUMMARY] ${summary.totalGames} games processed`);
    console.log(`   ✅ Balanced: ${summary.balancedGames}`);
    console.log(`   ❌ Unbalanced: ${summary.unbalancedGames}`);
    console.log(`   ⚠️  Coins created: ${summary.totalCoinsCreated}`);
  };

  const deleteUnmatchedBets = async () => {
    const unmatchedBetsA = teamAQueue.filter(bet => !bet.booked);
    const unmatchedBetsB = teamBQueue.filter(bet => !bet.booked);
    const allUnmatchedBets = [...unmatchedBetsA, ...unmatchedBetsB];
    
    let totalFreed = 0;
    
    // ✅ NEW: Remove from PENDING, don't call addCredits() (no coins created!)
    for (const bet of allUnmatchedBets) {
      const user = getUserById(bet.userId);
      if (user) {
        refundPendingBet(user.id, bet.id.toString());
        totalFreed += bet.amount;
        
        toast.info(`Released ${bet.amount} COINS - removed from pending`, {
          description: `Unmatched bet #${bet.id} removed for ${user.name}`,
          className: "custom-toast-success",
        });
      }
    }
    
    const unmatchedNextBetsA = nextTeamAQueue.filter(bet => !bet.booked);
    const unmatchedNextBetsB = nextTeamBQueue.filter(bet => !bet.booked);
    const allUnmatchedNextBets = [...unmatchedNextBetsA, ...unmatchedNextBetsB];
    
    // Remove unmatched next game bets
    for (const bet of allUnmatchedNextBets) {
      const user = getUserById(bet.userId);
      if (user) {
        totalFreed += bet.amount;
      }
    }
    
    const matchedBetsA = teamAQueue.filter(bet => bet.booked);
    const matchedBetsB = teamBQueue.filter(bet => bet.booked);
    
    const nextMatchedBetsA = nextTeamAQueue.filter(bet => bet.booked);
    const nextMatchedBetsB = nextTeamBQueue.filter(bet => bet.booked);
    
    updateGameState({
      teamAQueue: matchedBetsA,
      teamBQueue: matchedBetsB,
      nextTeamAQueue: nextMatchedBetsA,
      nextTeamBQueue: nextMatchedBetsB
    });
    
    const totalUnmatchedBets = allUnmatchedBets.length + allUnmatchedNextBets.length;
    if (totalUnmatchedBets > 0) {
      console.log(`✅ [DELETE-UNMATCHED] Removed ${totalUnmatchedBets} unmatched bets - ${totalFreed} COINS freed from pending`);
      toast.success(`${totalUnmatchedBets} Unmatched Bets Removed (${totalFreed} COINS freed)`, {
        description: "Unmatched bets removed and credits freed from pending",
        className: "custom-toast-success",
      });
    } else {
      toast.info("No Unmatched Bets Found", {
        description: "All current bets are already matched",
        className: "custom-toast-success",
      });
    }
  };
  
  const handleConfirmBet = async () => {
    if (!confirmation.teamSide || confirmation.amount <= 0) return;
    
    if (!currentUser) {
      toast.error("No User Selected", {
        description: "Please select or create a user first",
        duration: 4500,
        className: "custom-toast-error",
      });
      closeBetConfirmation();
      return;
    }
    
    // ✅ NEW: Deduct credits from account (AWAIT for async operation)
    const deducted = await deductCredits(currentUser.id, confirmation.amount);
    if (!deducted) {
      closeBetConfirmation();
      return;
    }
    
    const betId = generateBetId().toString();
    const bet: Bet = { 
      id: parseInt(betId), 
      amount: confirmation.amount, 
      color: null, 
      booked: false,
      userId: currentUser.id,
      userName: currentUser.name,
      teamSide: confirmation.teamSide
    };

    try {
      if (confirmation.isNextGame) {
        if (confirmation.teamSide === 'A') {
          const updatedAQueue = [...nextTeamAQueue, bet];
          console.log('✅ [BET-PLACED] Created updated queue for next Team A with bet ID:', bet.id);
          updateGameState({ nextTeamAQueue: updatedAQueue });
          bookNextGameBets(updatedAQueue, nextTeamBQueue);
        } else {
          const updatedBQueue = [...nextTeamBQueue, bet];
          console.log('✅ [BET-PLACED] Created updated queue for next Team B with bet ID:', bet.id);
          updateGameState({ nextTeamBQueue: updatedBQueue });
          bookNextGameBets(nextTeamAQueue, updatedBQueue);
        }
      } else {
        if (confirmation.teamSide === 'A') {
          const updatedAQueue = [...teamAQueue, bet];
          console.log('✅ [BET-PLACED] Placing bet on Team A:', bet);
          console.log('🎲 [placeBet - ONE POCKET] New Team A Queue length:', updatedAQueue.length);
          updateGameState({ teamAQueue: updatedAQueue });
          bookBets(updatedAQueue, teamBQueue);
        } else {
          const updatedBQueue = [...teamBQueue, bet];
          console.log('✅ [BET-PLACED] Placing bet on Team B:', bet);
          console.log('🎲 [placeBet - ONE POCKET] New Team B Queue length:', updatedBQueue.length);
          updateGameState({ teamBQueue: updatedBQueue });
          bookBets(teamAQueue, updatedBQueue);
        }
      }
      
      // Show success message
      toast.success("Bet Placed!", {
        description: `${confirmation.amount} COINS bet on ${confirmation.teamSide === 'A' ? teamAName : teamBName}`,
        duration: 2000,
        className: "custom-toast-success",
      });
    } catch (error) {
      console.error('❌ [BET-PLACEMENT] Error placing bet:', error);
      toast.error("Bet Placement Failed", {
        description: "Failed to add bet to queue.",
        className: "custom-toast-error",
      });
    }
    
    closeBetConfirmation();
  };

  const showBetConfirmation = async (team: 'A' | 'B', amount: number, isNextGame: boolean = false) => {
    if (!currentUser) {
      toast.error("No User Selected", {
        description: "Please select or create a user first",
        duration: 4500,
        className: "custom-toast-error",
      });
      return;
    }

    // ✅ NEW: Check available credits (not locked in pending bets)
    const available = getAvailableCredits(currentUser.id);
    const pending = getPendingBetAmount(currentUser.id);

    if (available === 0) {
      toast.error("Zero Available Credits", {
        description: `You have ${pending} COINS locked in pending bets.`,
        icon: <Wallet className="h-5 w-5 text-red-500" />,
        duration: 5000,
        className: "custom-toast-error",
      });
      return;
    }
    
    if (available < amount) {
      toast.error("Insufficient Available Credits", {
        description: `You need ${amount} COINS (${available} available, ${pending} locked in pending bets).`,
        icon: <Wallet className="h-5 w-5 text-red-500" />,
        duration: 5000,
        className: "custom-toast-error",
      });
      return;
    }
    
    // ✅ NEW: Deduct credits from account (AWAIT for async operation)
    const deducted = await deductCredits(currentUser.id, amount);
    if (!deducted) {
      return;
    }
    
    try {
      // Directly place the bet without confirmation dialog
      const betId = generateBetId().toString();
      const bet: Bet = { 
        id: parseInt(betId), 
        amount: amount, 
        color: null, 
        booked: false,
        userId: currentUser.id,
        userName: currentUser.name,
        teamSide: team
      };

      if (isNextGame) {
        if (team === 'A') {
          const updatedAQueue = [...nextTeamAQueue, bet];
          console.log('✅ [BET-PLACED] Created updated queue for next Team A with bet ID:', bet.id);
          console.log('🎲 [placeBet - ONE POCKET] Adding bet to nextTeamAQueue:', bet, 'New queue length:', updatedAQueue.length);
          updateGameState({ nextTeamAQueue: updatedAQueue });
          bookNextGameBets(updatedAQueue, nextTeamBQueue);
        } else {
          const updatedBQueue = [...nextTeamBQueue, bet];
          console.log('✅ [BET-PLACED] Created updated queue for next Team B with bet ID:', bet.id);
          console.log('🎲 [placeBet - ONE POCKET] Adding bet to nextTeamBQueue:', bet, 'New queue length:', updatedBQueue.length);
          updateGameState({ nextTeamBQueue: updatedBQueue });
          bookNextGameBets(nextTeamAQueue, updatedBQueue);
        }
      } else {
        if (team === 'A') {
          const updatedAQueue = [...teamAQueue, bet];
          console.log('✅ [BET-PLACED] Created updated queue for Team A with bet ID:', bet.id);
          console.log('🎲 [placeBet - ONE POCKET] Adding bet to teamAQueue:', bet, 'New queue length:', updatedAQueue.length);
          updateGameState({ teamAQueue: updatedAQueue });
          bookBets(updatedAQueue, teamBQueue);
        } else {
          const updatedBQueue = [...teamBQueue, bet];
          console.log('✅ [BET-PLACED] Created updated queue for Team B with bet ID:', bet.id);
          console.log('🎲 [placeBet - ONE POCKET] Adding bet to teamBQueue:', bet, 'New queue length:', updatedBQueue.length);
          updateGameState({ teamBQueue: updatedBQueue });
          bookBets(teamAQueue, updatedBQueue);
        }
      }

      // ✅ NEW: Add to pending bets
      addPendingBet(currentUser.id, {
        id: betId,
        amount: amount,
        team: team,
        gameNumber: currentGameNumber,
        teamName: team === 'A' ? teamAName : teamBName,
        opponentName: team === 'A' ? teamBName : teamAName
      });

      toast.success("Bet Placed!", {
        description: `${amount} COINS bet on ${team === 'A' ? teamAName : teamBName}`,
        duration: 2000,
        className: "custom-toast-success",
      });
    } catch (error) {
      console.error('❌ [BET-PLACEMENT] Error placing bet:', error);
      toast.error("Bet Placement Failed", {
        description: "Failed to add bet to queue.",
        className: "custom-toast-error",
      });
    }
  };

  const closeBetConfirmation = () => {
    setConfirmation({
      isOpen: false,
      team: '',
      teamSide: null,
      amount: 0,
      isNextGame: false
    });
  };

  const bookBets = (aQueue: Bet[] = teamAQueue, bQueue: Bet[] = teamBQueue) => {
    const newAQueue = [...aQueue];
    const newBQueue = [...bQueue];
    let newBookedBets = [...bookedBets];
    let newTotalAmount = totalBookedAmount;
    let newColorIndex = colorIndex;

    for (let i = 0; i < newAQueue.length; i++) {
      if (!newAQueue[i].booked) {
        // Find a matching bet on the opposite team
        // Allow same user to bet both sides (self-matched bets result in neutral outcome)
        const matchIndex = newBQueue.findIndex(bBet => 
          !bBet.booked && 
          bBet.amount === newAQueue[i].amount
        );
        
        if (matchIndex !== -1) {
          const assignedColor = betColors[newColorIndex % betColors.length];
          
          // Determine which bet was placed first (lower ID = placed first)
          // Use the first-placed bet's ID as the master ID
          const teamAId = newAQueue[i].id;
          const teamBId = newBQueue[matchIndex].id;
          const masterId = teamAId < teamBId ? teamAId : teamBId;
          
          newAQueue[i].color = assignedColor;
          newAQueue[i].booked = true;
          newBQueue[matchIndex].color = assignedColor;
          newBQueue[matchIndex].booked = true;
          
          // Make both bets use the master ID (first-placed bet's ID)
          newAQueue[i].id = masterId;
          newBQueue[matchIndex].id = masterId;
          newColorIndex++;

          newBookedBets.push({ 
            idA: masterId, 
            idB: masterId, // Use the same ID for both (first-placed bet's ID)
            amount: newAQueue[i].amount,
            userIdA: newAQueue[i].userId,
            userIdB: newBQueue[matchIndex].userId
          });
          
          newTotalAmount += newAQueue[i].amount;
          
          // Bet booked successfully - no toast notification
          
        }
      }
    }

    updateGameState({
      teamAQueue: newAQueue,
      teamBQueue: newBQueue,
      bookedBets: newBookedBets,
      totalBookedAmount: newTotalAmount,
      colorIndex: newColorIndex
    });
  };

  // ✅ RECOVERY: Detect and restore missing sides of matched bets
  const recoverMissingMatchedBets = () => {
    let recovered = false;
    let recoveredCount = 0;
    const newAQueue = [...teamAQueue];
    const newBQueue = [...teamBQueue];
    let newBookedBets = [...bookedBets];
    
    console.log('🔍 [BET-RECOVERY] Checking for missing matched bets...');
    console.log('🔍 [BET-RECOVERY] Booked bets count:', bookedBets.length);
    console.log('🔍 [BET-RECOVERY] Team A queue count:', teamAQueue.length);
    console.log('🔍 [BET-RECOVERY] Team B queue count:', teamBQueue.length);
    
    // Check each booked bet to ensure both sides are present
    for (const bookedBet of bookedBets) {
      const betInA = newAQueue.some(bet => bet.id === bookedBet.idA);
      const betInB = newBQueue.some(bet => bet.id === bookedBet.idB);
      
      if (!betInA || !betInB) {
        console.warn(`⚠️ [BET-RECOVERY] Missing bet side! ID: ${bookedBet.idA}, In A: ${betInA}, In B: ${betInB}`);
        
        // Try to recover by finding and restoring the missing bet
        if (!betInA && betInB) {
          const partialBetB = newBQueue.find(bet => bet.id === bookedBet.idB);
          if (partialBetB) {
            // Recreate Team A bet from Team B info
            const recreatedBetA: Bet = {
              id: bookedBet.idA,
              amount: bookedBet.amount,
              userId: bookedBet.userIdA,
              userName: getUserById(bookedBet.userIdA)?.name || 'Unknown',
              booked: true,
              color: partialBetB.color,
              teamSide: 'A'
            };
            newAQueue.push(recreatedBetA);
            console.log('✅ [BET-RECOVERY] Recovered missing Team A bet:', recreatedBetA);
            recoveredCount++;
            recovered = true;
          }
        } else if (betInA && !betInB) {
          const partialBetA = newAQueue.find(bet => bet.id === bookedBet.idA);
          if (partialBetA) {
            // Recreate Team B bet from Team A info
            const recreatedBetB: Bet = {
              id: bookedBet.idB,
              amount: bookedBet.amount,
              userId: bookedBet.userIdB,
              userName: getUserById(bookedBet.userIdB)?.name || 'Unknown',
              booked: true,
              color: partialBetA.color,
              teamSide: 'B'
            };
            newBQueue.push(recreatedBetB);
            console.log('✅ [BET-RECOVERY] Recovered missing Team B bet:', recreatedBetB);
            recoveredCount++;
            recovered = true;
          }
        }
      }
    }
    
    if (recovered) {
      console.log(`✅ [BET-RECOVERY] Recovered ${recoveredCount} missing bet sides`);
      updateGameState({
        teamAQueue: newAQueue,
        teamBQueue: newBQueue,
        bookedBets: newBookedBets
      });
    } else {
      console.log('✅ [BET-RECOVERY] All matched bets are complete');
    }
    
    return recoveredCount;
  };

  const bookNextGameBets = (aQueue: Bet[] = nextTeamAQueue, bQueue: Bet[] = nextTeamBQueue) => {
    const newAQueue = [...aQueue];
    const newBQueue = [...bQueue];
    let newBookedBets = [...nextBookedBets];
    let newTotalAmount = nextTotalBookedAmount;
    let newColorIndex = colorIndex;

    for (let i = 0; i < newAQueue.length; i++) {
      if (!newAQueue[i].booked) {
        // Find a matching bet on the opposite team
        // Allow same user to bet both sides (self-matched bets result in neutral outcome)
        const matchIndex = newBQueue.findIndex(bBet => 
          !bBet.booked && 
          bBet.amount === newAQueue[i].amount
        );
        
        if (matchIndex !== -1) {
          const assignedColor = betColors[newColorIndex % betColors.length];
          
          // Determine which bet was placed first (lower ID = placed first)
          // Use the first-placed bet's ID as the master ID
          const teamAId = newAQueue[i].id;
          const teamBId = newBQueue[matchIndex].id;
          const masterId = teamAId < teamBId ? teamAId : teamBId;
          
          newAQueue[i].color = assignedColor;
          newAQueue[i].booked = true;
          newBQueue[matchIndex].color = assignedColor;
          newBQueue[matchIndex].booked = true;
          
          // Make both bets use the master ID (first-placed bet's ID)
          newAQueue[i].id = masterId;
          newBQueue[matchIndex].id = masterId;
          newColorIndex++;

          newBookedBets.push({ 
            idA: masterId, 
            idB: masterId, // Use the same ID for both (first-placed bet's ID)
            amount: newAQueue[i].amount,
            userIdA: newAQueue[i].userId,
            userIdB: newBQueue[matchIndex].userId
          });
          
          newTotalAmount += newAQueue[i].amount;
          
          // Next game bet booked successfully - no toast notification
          
        }
      }
    }

    updateGameState({
      nextTeamAQueue: newAQueue,
      nextTeamBQueue: newBQueue,
      nextBookedBets: newBookedBets,
      nextTotalBookedAmount: newTotalAmount,
      colorIndex: newColorIndex
    });
  };

  const deleteOpenBet = (betId: number, isNextGame: boolean = false) => {
    if (!currentUser) {
      toast.error("Cannot Delete Bet", {
        description: "You must be logged in to delete bets",
        duration: 3000,
        className: "custom-toast-error",
      });
      return;
    }

    let betDeleted = false;
    let deletedBet: Bet | undefined;
    
    if (isNextGame) {
      // Check next game queues
      deletedBet = nextTeamAQueue.find(bet => bet.id === betId);
      if (deletedBet && !deletedBet.booked && deletedBet.userId === currentUser.id) {
        const newNextTeamAQueue = nextTeamAQueue.filter(bet => bet.id !== betId);
        updateGameState({ nextTeamAQueue: newNextTeamAQueue });
        betDeleted = true;
      }
      
      if (!betDeleted) {
        deletedBet = nextTeamBQueue.find(bet => bet.id === betId);
        if (deletedBet && !deletedBet.booked && deletedBet.userId === currentUser.id) {
          const newNextTeamBQueue = nextTeamBQueue.filter(bet => bet.id !== betId);
          updateGameState({ nextTeamBQueue: newNextTeamBQueue });
          betDeleted = true;
        }
      }
    } else {
      // Check current game queues
      deletedBet = teamAQueue.find(bet => bet.id === betId);
      if (deletedBet && !deletedBet.booked && deletedBet.userId === currentUser.id) {
        const newTeamAQueue = teamAQueue.filter(bet => bet.id !== betId);
        updateGameState({ teamAQueue: newTeamAQueue });
        betDeleted = true;
      }
      
      if (!betDeleted) {
        deletedBet = teamBQueue.find(bet => bet.id === betId);
        if (deletedBet && !deletedBet.booked && deletedBet.userId === currentUser.id) {
          const newTeamBQueue = teamBQueue.filter(bet => bet.id !== betId);
          updateGameState({ teamBQueue: newTeamBQueue });
          betDeleted = true;
        }
      }
    }
    
    if (betDeleted && deletedBet) {
      // ✅ Refund the bet amount to the user
      addCredits(currentUser.id, deletedBet.amount, false, `bet_deleted_#${deletedBet.id}`);
      
      toast.success(`Bet #${deletedBet.id} deleted`, {
        description: `${deletedBet.amount} COINS refunded to your account`,
        className: "custom-toast-success",
      });
    } else {
      toast.error("Cannot Delete Bet", {
        description: "Bet not found, already booked/matched, or you don't have permission to delete this bet",
        duration: 3000,
        className: "custom-toast-error",
      });
    }
  };

  const deleteBet = (id: string) => {
    if (!betId) {
      toast.error("Error", {
        description: "Please enter a valid Bet ID",
        className: "custom-toast-error",
      });
      return;
    }

    const idInt = parseInt(id);
    let betDeleted = false;
    
    const deletedBetA = teamAQueue.find(bet => bet.id === idInt);
    if (deletedBetA) {
      const newTeamAQueue = teamAQueue.filter(bet => bet.id !== idInt);
      updateGameState({ teamAQueue: newTeamAQueue });
      
      if (deletedBetA.booked) {
        const matchedBookedBet = bookedBets.find(bookedBet => bookedBet.idA === idInt);
        if (matchedBookedBet) {
          const newTeamBQueue = teamBQueue.map(bet => {
            if (bet.id === matchedBookedBet.idB) {
              return { ...bet, color: null, booked: false };
            }
            return bet;
          });
          const newBookedBets = bookedBets.filter(bookedBet => bookedBet.idA !== idInt);
          
          updateGameState({
            teamBQueue: newTeamBQueue,
            bookedBets: newBookedBets,
            totalBookedAmount: totalBookedAmount - matchedBookedBet.amount
          });
        }
      }
      
      betDeleted = true;
    }
    
    const deletedBetB = teamBQueue.find(bet => bet.id === idInt);
    if (deletedBetB && !betDeleted) {
      const newTeamBQueue = teamBQueue.filter(bet => bet.id !== idInt);
      updateGameState({ teamBQueue: newTeamBQueue });
      
      if (deletedBetB.booked) {
        const matchedBookedBet = bookedBets.find(bookedBet => bookedBet.idB === idInt);
        if (matchedBookedBet) {
          const newTeamAQueue = teamAQueue.map(bet => {
            if (bet.id === matchedBookedBet.idA) {
              return { ...bet, color: null, booked: false };
            }
            return bet;
          });
          const newBookedBets = bookedBets.filter(bookedBet => bookedBet.idB !== idInt);
          
          updateGameState({
            teamAQueue: newTeamAQueue,
            bookedBets: newBookedBets,
            totalBookedAmount: totalBookedAmount - matchedBookedBet.amount
          });
        }
      }
      
      betDeleted = true;
    }
    
    if (!betDeleted) {
      const deletedNextBetA = nextTeamAQueue.find(bet => bet.id === idInt);
      if (deletedNextBetA) {
        const newNextTeamAQueue = nextTeamAQueue.filter(bet => bet.id !== idInt);
        updateGameState({ nextTeamAQueue: newNextTeamAQueue });
        
        if (deletedNextBetA.booked) {
          const matchedBookedBet = nextBookedBets.find(bookedBet => bookedBet.idA === idInt);
          if (matchedBookedBet) {
            const newNextTeamBQueue = nextTeamBQueue.map(bet => {
              if (bet.id === matchedBookedBet.idB) {
                return { ...bet, color: null, booked: false };
              }
              return bet;
            });
            const newNextBookedBets = nextBookedBets.filter(bookedBet => bookedBet.idA !== idInt);
            
            updateGameState({
              nextTeamBQueue: newNextTeamBQueue,
              nextBookedBets: newNextBookedBets,
              nextTotalBookedAmount: nextTotalBookedAmount - matchedBookedBet.amount
            });
          }
        }
        
        betDeleted = true;
      }
      
      const deletedNextBetB = nextTeamBQueue.find(bet => bet.id === idInt);
      if (deletedNextBetB && !betDeleted) {
        const newNextTeamBQueue = nextTeamBQueue.filter(bet => bet.id !== idInt);
        updateGameState({ nextTeamBQueue: newNextTeamBQueue });
        
        if (deletedNextBetB.booked) {
          const matchedBookedBet = nextBookedBets.find(bookedBet => bookedBet.idB === idInt);
          if (matchedBookedBet) {
            const newNextTeamAQueue = nextTeamAQueue.map(bet => {
              if (bet.id === matchedBookedBet.idA) {
                return { ...bet, color: null, booked: false };
              }
              return bet;
            });
            const newNextBookedBets = nextBookedBets.filter(bookedBet => bookedBet.idB !== idInt);
            
            updateGameState({
              nextTeamAQueue: newNextTeamAQueue,
              nextBookedBets: newNextBookedBets,
              nextTotalBookedAmount: nextTotalBookedAmount - matchedBookedBet.amount
            });
          }
        }
        
        betDeleted = true;
      }
    }
    
    if (betDeleted) {
      // Bet deleted successfully - no toast notification
      setBetId("");
    } else {
      toast.error("Error", {
        description: `No bet found with ID ${id}`,
        className: "custom-toast-error",
      });
    }
  };

  const countBookedBets = () => {
    return bookedBets.length;
  };

  const countNextGameBookedBets = () => {
    return nextBookedBets.length;
  };

  const [userBetAmounts, setUserBetAmounts] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    // Set page title to identify this as One Pocket Arena
    document.title = 'One Pocket Arena - Betting Queue';
    
    const newUserBetAmounts = new Map<string, number>();
    
    teamAQueue.forEach(bet => {
      const current = newUserBetAmounts.get(bet.userId) || 0;
      newUserBetAmounts.set(bet.userId, current + bet.amount);
    });
    
    teamBQueue.forEach(bet => {
      const current = newUserBetAmounts.get(bet.userId) || 0;
      newUserBetAmounts.set(bet.userId, current + bet.amount);
    });
    
    nextTeamAQueue.forEach(bet => {
      const current = newUserBetAmounts.get(bet.userId) || 0;
      newUserBetAmounts.set(bet.userId, current + bet.amount);
    });
    
    nextTeamBQueue.forEach(bet => {
      const current = newUserBetAmounts.get(bet.userId) || 0;
      newUserBetAmounts.set(bet.userId, current + bet.amount);
    });
    
    setUserBetAmounts(newUserBetAmounts);
  }, [teamAQueue, teamBQueue, nextTeamAQueue, nextTeamBQueue]);

  const handleTeamABallsChange = (balls: number) => {
    // Mute pool/boo sounds when plus/minus button is clicked
    mutePoolBooSoundsRef.current = true;
    updateGameState({ teamABalls: balls });
  };
  
  const handleTeamBBallsChange = (balls: number) => {
    // Mute pool/boo sounds when plus/minus button is clicked
    mutePoolBooSoundsRef.current = true;
    updateGameState({ teamBBalls: balls });
  };

  const handleTeamAGamesChange = (games: number) => {
    updateGameState({ teamAGames: games });
  };
  
  const handleTeamBGamesChange = (games: number) => {
    updateGameState({ teamBGames: games });
  };

  // Cleanup sounds on component unmount
  useEffect(() => {
    return () => {
      // Mute all sounds globally during arena transition
      (window as any).__MUTE_SOUNDS = true;
      stopSilverSound();
      stopCheerSound();
      stopPoolSound();
      stopBooSound();
      // Unmute after a brief delay to allow sounds to stop
      setTimeout(() => {
        (window as any).__MUTE_SOUNDS = false;
      }, 100);
    };
  }, [stopSilverSound, stopCheerSound, stopPoolSound, stopBooSound]);

  // Mute sounds during arena transitions to prevent echoes and overlapping audio
  // This effect runs when the component is mounted/unmounted or route changes
  useEffect(() => {
    // Initialize mute flag (ensure it starts in correct state)
    if ((window as any).__MUTE_SOUNDS === undefined) {
      (window as any).__MUTE_SOUNDS = false;
    }
    
    // Cleanup on unmount: mute for 5 seconds to prevent overlapping sounds during transition
    return () => {
      console.log('🔇 [SOUND] Arena transition detected - muting sounds for 5 seconds');
      (window as any).__MUTE_SOUNDS = true;
      const timer = setTimeout(() => {
        (window as any).__MUTE_SOUNDS = false;
        console.log('🔊 [SOUND] Mute period expired - sounds enabled again');
      }, 5000);
      return () => clearTimeout(timer);
    };
  }, [location.pathname]);


  return (
    <div className="min-h-screen p-4 md:p-8 pt-32 relative" style={{ backgroundColor: '#000000', color: '#FFFFFF' }}>
      
      {/* Debug Status - Shows data sync info for mobile troubleshooting */}
      {/* <SocketIOStatus /> - Hidden for now */}
      
      <div className="max-w-full mx-auto relative z-10">
        <UserWidgetsContainer 
          userBetAmounts={userBetAmounts} 
          bookedBets={bookedBets}
          nextBookedBets={nextBookedBets}
          isAdmin={isAdminMode}
          isAgent={isAgentMode}
          toggleAdminMode={toggleAdminMode}
          toggleAgentMode={toggleAgentMode}
          teamAQueue={teamAQueue}
          teamBQueue={teamBQueue}
          teamAName={teamAName}
          teamBName={teamBName}
          teamABalls={teamABalls}
          teamBBalls={teamBBalls}
        />
        
        <div className="mb-4 flex justify-between items-center">
          <Link to="/" className="inline-flex items-center transition-colors" style={{ color: '#FFFFFF' }}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Home
          </Link>
        </div>
        
        <div className="w-full max-w-full mx-auto mb-8">
          <img 
            src="/lovable-uploads/4dfcf9c9-cbb9-4a75-94ab-bcdb38a8091e.png" 
            alt="Game Bird Logo" 
            className="w-full h-40 object-contain drop-shadow-[0_0_10px_rgba(249,115,22,0.3)]" 
          />
        </div>

        <h1 className="text-4xl md:text-5xl font-bold text-center mb-6" style={{ color: '#000000', textShadow: 'none' }}>One Pocket Arena</h1>

        <UserCreditSystem isAdmin={isAdminMode} />

        {/* Game Info Window */}
        <GameInfoWindow 
          teamAQueue={teamAQueue}
          teamBQueue={teamBQueue}
          nextTeamAQueue={nextTeamAQueue}
          nextTeamBQueue={nextTeamBQueue}
        />

        {/* Realtime Scoreboard Header */}
        <div className="text-center mb-6">
          <h2 className="font-bold text-2xl uppercase tracking-wider" style={{ color: '#000000' }}>
            REALTIME SCOREBOARD
          </h2>
        </div>

        <GameDescription 
          isAdmin={isAdminMode || isAgentMode} 
          initialDescription={gameDescription} 
          onDescriptionChange={(desc) => updateGameState({ gameDescription: desc })} 
        />

        <ScoreBoard 
          teamAName={teamAName}
          teamAGames={teamAGames}
          teamABalls={teamABalls}
          teamBName={teamBName}
          teamBGames={teamBGames}
          teamBBalls={teamBBalls}
          teamAHasBreak={teamAHasBreak}
          isAdmin={isAdminMode}
          isAgent={isAgentMode}
          adminLocked={adminLocked}
          setAdminLocked={setAdminLocked}
          adminModalRef={adminModalRef}
          gameLabel={gameLabel}
          currentGameNumber={currentGameNumber}
          onTeamANameChange={(name) => updateGameState({ teamAName: name })}
          onTeamBNameChange={(name) => updateGameState({ teamBName: name })}
          onBreakChange={(hasBreak) => updateGameState({ teamAHasBreak: hasBreak })}
          onTeamAGameWin={handleTeamAWin}
          onTeamBGameWin={handleTeamBWin}
          onGameLabelChange={(label) => updateGameState({ gameLabel: label })}
          onCurrentGameNumberChange={(num) => updateGameState({ currentGameNumber: num })}
          onTeamABallsChange={handleTeamABallsChange}
          onTeamBBallsChange={handleTeamBBallsChange}
          onTeamAGamesChange={handleTeamAGamesChange}
          onTeamBGamesChange={handleTeamBGamesChange}
          timerSeconds={timerSeconds}
          isTimerRunning={isTimerRunning}
          onTimerStart={startTimer}
          onTimerPause={pauseTimer}
          onTimerReset={resetTimer}
          onToggleAdmin={toggleAdminMode}
          onToggleAgent={toggleAgentMode}
          teamAPlayerImageUrl="/lovable-uploads/alex.png"
          teamBPlayerImageUrl="/lovable-uploads/tony.jpg"
          showBallCount={true}
        />

        {/* Game History Window */}
        <GameHistoryWindow />

        {/* Betting Queue Header */}
        <div className="text-center mb-6">
          <h2 className="font-bold text-2xl uppercase tracking-wider" style={{ color: '#000000' }}>
            BETTING QUEUE
          </h2>
        </div>

        <div className="mb-8">
          <Card className="glass-card backdrop-blur-sm shadow-lg rounded-2xl transition-all duration-300 mb-4 hover:shadow-[0_0_15px_rgba(250,21,147,0.3)]" style={{ borderColor: '#fa1593', backgroundColor: '#004b6b' }}>
            <CardContent className="p-6 flex flex-col md:flex-row justify-between items-center">
              <div className="flex items-center mb-4 md:mb-0">
                <div className="p-3 rounded-2xl mr-4" style={{ backgroundColor: '#fa1593' }}>
                  <Zap className="h-8 w-8 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-medium text-white">Game {currentGameNumber} Bets</h3>
                  <p style={{ color: '#95deff' }}>{countBookedBets()} booked bets</p>
                </div>
              </div>
              
              <div className="flex items-center">
                <div className="p-3 rounded-2xl mr-4" style={{ backgroundColor: '#fa1593' }}>
                  <Coins className="h-8 w-8 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-medium text-white">Total Booked</h3>
                  <p className="text-2xl font-bold text-white">
                    <NumericAnimation 
                      value={totalBookedAmount} 
                      className="text-4xl transition-all duration-500"
                      withGlow={true}
                    /> <span>COINS</span>
                  </p>
                </div>
              </div>
              
              {isAgentMode && (
                <Button 
                  variant="outline" 
                  className="hover:text-white"
                  style={{ borderColor: '#fa1593', color: '#fa1593' }}
                  onClick={moveBetsToNextGame}
                >
                  <SkipForward className="h-4 w-4 mr-2" />
                  Move to Next Game
                </Button>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <Card className="glass-card overflow-hidden shadow-lg transform transition-all rounded-2xl" style={{ backgroundColor: '#052240', boxShadow: '0 0 30px rgba(149, 222, 255, 0.8)' }}>
              <CardHeader className="p-4 rounded-t-2xl" style={{ background: 'linear-gradient(to right, #95deff, #004b6b)' }}>
                <CardTitle className="text-center text-2xl text-white">{teamAName}</CardTitle>
              </CardHeader>
              <CardContent className="p-4" style={{ backgroundColor: '#052240' }}>
                <div className="grid grid-cols-3 gap-3 mb-5">
                  <BirdButton 
                    variant="pink" 
                    amount={10} 
                    onClick={() => showBetConfirmation('A', 10)}
                    disabled={!currentUser}
                  />
                  <BirdButton 
                    variant="blue" 
                    amount={50} 
                    onClick={() => showBetConfirmation('A', 50)}
                    disabled={!currentUser}
                  />
                  <BirdButton
                    variant="yellow"
                    amount={100}
                    onClick={() => showBetConfirmation('A', 100)}
                    disabled={!currentUser}
                  />
                </div>
                
                <div className="relative">
                  <div className="w-full mb-1 sticky top-0 z-10 rounded-xl" style={{ backgroundColor: '#95deff' }}>
                    <div className="grid grid-cols-3 py-2">
                      <div className="text-center text-white font-medium">Bet ID</div>
                      <div className="text-center text-white font-medium">User</div>
                      <div className="text-center text-white font-medium">Amount</div>
                    </div>
                  </div>
                  <div className="max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
                    {teamAQueue.length > 0 ? (
                      <div>
                        {teamAQueue.map((bet) => {
                          const betUser = getUserById(bet.userId);
                          return (
                            <div 
                              key={bet.id} 
                              style={{ 
                                backgroundColor: bet.booked ? bet.color : (bet.color ? `${bet.color}DD` : 'rgba(31, 41, 55, 0.7)'),
                                transition: 'all 0.3s ease',
                                borderLeft: bet.booked ? `4px solid ${bet.color}` : 'none'
                              }}
                              className="grid grid-cols-3 py-2 mb-1 rounded-xl hover:brightness-110"
                            >
                              <div className={`text-center font-medium ${bet.booked ? 'text-black' : 'text-white'}`}>
                                #{bet.id}
                              </div>
                              <div className={`text-center font-medium ${bet.booked ? 'text-black' : 'text-white'} truncate`}>
                                {bet.userName || betUser?.name || 'User'}
                              </div>
                              <div className={`text-center flex justify-between items-center px-2 ${bet.booked ? 'text-black font-bold' : 'text-white'}`}>
                                {bet.amount} COINS
                                <div className="flex items-center gap-2">
                                      {!bet.booked ? (
                                    <>
                                      <span className="px-2 py-0.5 text-xs rounded-xl text-white" style={{ backgroundColor: '#95deff' }}>OPEN</span>
                                      {currentUser && bet.userId === currentUser.id && (
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="h-6 w-6 p-0 transition-colors"
                                          style={{ color: '#fa1593' }}
                                          onMouseEnter={(e) => {
                                            e.currentTarget.style.color = '#fa1593';
                                            e.currentTarget.style.backgroundColor = 'rgba(250, 21, 147, 0.2)';
                                          }}
                                          onMouseLeave={(e) => {
                                            e.currentTarget.style.color = '#fa1593';
                                            e.currentTarget.style.backgroundColor = 'transparent';
                                          }}
                                          onClick={() => deleteOpenBet(bet.id, false)}
                                          title="Delete your open bet"
                                        >
                                          <Trash2 className="h-3 w-3" />
                                        </Button>
                                      )}
                                    </>
                                  ) : (
                                    <span className="px-2 py-0.5 bg-black/30 text-xs rounded-xl flex items-center text-white">
                                      <CheckSquare className="w-3 h-3 mr-1" /> BOOKED
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center text-gray-400 py-8">No active bets</div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="glass-card overflow-hidden shadow-lg transform transition-all rounded-2xl" style={{ backgroundColor: '#052240', boxShadow: '0 0 30px rgba(250, 21, 147, 0.8)' }}>
              <CardHeader className="p-4 rounded-t-2xl" style={{ background: 'linear-gradient(to right, #fa1593, #004b6b)' }}>
                <CardTitle className="text-center text-2xl text-white">{teamBName}</CardTitle>
              </CardHeader>
              <CardContent className="p-4" style={{ backgroundColor: '#052240' }}>
                <div className="grid grid-cols-3 gap-3 mb-5">
                  <BirdButton 
                    variant="pink" 
                    amount={10} 
                    onClick={() => showBetConfirmation('B', 10)}
                    disabled={!currentUser}
                  />
                  <BirdButton 
                    variant="blue" 
                    amount={50} 
                    onClick={() => showBetConfirmation('B', 50)}
                    disabled={!currentUser}
                  />
                  <BirdButton
                    variant="yellow"
                    amount={100}
                    onClick={() => showBetConfirmation('B', 100)}
                    disabled={!currentUser}
                  />
                </div>
                
                <div className="relative">
                  <div className="w-full mb-1 sticky top-0 z-10 rounded-xl" style={{ backgroundColor: '#fa1593' }}>
                    <div className="grid grid-cols-3 py-2">
                      <div className="text-center text-white font-medium">Bet ID</div>
                      <div className="text-center text-white font-medium">User</div>
                      <div className="text-center text-white font-medium">Amount</div>
                    </div>
                  </div>
                  <div className="max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
                    {teamBQueue.length > 0 ? (
                      <div>
                        {teamBQueue.map((bet) => {
                          const betUser = getUserById(bet.userId);
                          return (
                            <div 
                              key={bet.id} 
                              style={{ 
                                backgroundColor: bet.booked ? bet.color : (bet.color ? `${bet.color}DD` : 'rgba(31, 41, 55, 0.7)'),
                                transition: 'all 0.3s ease',
                                borderLeft: bet.booked ? `4px solid ${bet.color}` : 'none'
                              }}
                              className="grid grid-cols-3 py-2 mb-1 rounded-xl hover:brightness-110"
                            >
                              <div className={`text-center font-medium ${bet.booked ? 'text-black' : 'text-white'}`}>
                                #{bet.id}
                              </div>
                              <div className={`text-center font-medium ${bet.booked ? 'text-black' : 'text-white'} truncate`}>
                                {bet.userName || betUser?.name || 'User'}
                              </div>
                              <div className={`text-center flex justify-between items-center px-2 ${bet.booked ? 'text-black font-bold' : 'text-white'}`}>
                                {bet.amount} COINS
                                <div className="flex items-center gap-2">
                                  {!bet.booked ? (
                                    <>
                                      <span className="px-2 py-0.5 text-xs rounded-xl text-white" style={{ backgroundColor: '#fa1593' }}>OPEN</span>
                                      {currentUser && bet.userId === currentUser.id && (
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="h-6 w-6 p-0 transition-colors"
                                          style={{ color: '#fa1593' }}
                                          onMouseEnter={(e) => {
                                            e.currentTarget.style.color = '#fa1593';
                                            e.currentTarget.style.backgroundColor = 'rgba(250, 21, 147, 0.2)';
                                          }}
                                          onMouseLeave={(e) => {
                                            e.currentTarget.style.color = '#fa1593';
                                            e.currentTarget.style.backgroundColor = 'transparent';
                                          }}
                                          onClick={() => deleteOpenBet(bet.id, false)}
                                          title="Delete your open bet"
                                        >
                                          <Trash2 className="h-3 w-3" />
                                        </Button>
                                      )}
                                    </>
                                  ) : (
                                    <span className="px-2 py-0.5 bg-black/30 text-xs rounded-xl flex items-center text-white">
                                      <CheckSquare className="w-3 h-3 mr-1" /> BOOKED
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center text-gray-400 py-8">No active bets</div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Current Game Betting Queue Information */}
        <div className="text-center mb-6">
          <p className="font-medium text-lg" style={{ color: '#000000' }}>
            *** BETS ARE HIGHLIGHTED ONCE MATCHED ***
          </p>
        </div>
        
        <div className="mb-8">
          <div className="flex justify-center items-center mb-4">
            <div className="p-3 rounded-2xl flex items-center animate-bounce" style={{ backgroundColor: '#fa1593' }}>
              <span className="text-white font-bold text-lg mr-2">BET NEXT GAME</span>
              <ArrowDown className="h-6 w-6 text-white" />
            </div>
          </div>

          <Card className="glass-card backdrop-blur-sm shadow-lg rounded-2xl transition-all duration-300 mb-4 hover:shadow-[0_0_15px_rgba(250,21,147,0.3)]" style={{ borderColor: '#fa1593', backgroundColor: '#004b6b' }}>
            <CardContent className="p-6 flex flex-col md:flex-row justify-between items-center">
              <div className="flex items-center mb-4 md:mb-0">
                <div className="p-3 rounded-2xl mr-4" style={{ backgroundColor: '#fa1593' }}>
                  <SkipForward className="h-8 w-8 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-medium text-white">Game {currentGameNumber + 1} Bets</h3>
                  <p style={{ color: '#95deff' }}>{countNextGameBookedBets()} booked bets</p>
                </div>
              </div>
              
              <div className="flex items-center">
                <div className="p-3 rounded-2xl mr-4" style={{ backgroundColor: '#fa1593' }}>
                  <Coins className="h-8 w-8 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-medium text-white">Total Booked</h3>
                  <p className="text-2xl font-bold text-white">
                    <NumericAnimation 
                      value={nextTotalBookedAmount} 
                      className="text-4xl transition-all duration-500"
                      withGlow={true}
                    /> <span>COINS</span>
                  </p>
                </div>
              </div>
              
              {isAgentMode && (
                <Button 
                  variant="outline" 
                  className="hover:text-white"
                  style={{ borderColor: '#fa1593', color: '#fa1593' }}
                  onClick={moveBetsToCurrentGame}
                >
                  <ArrowDownUp className="h-4 w-4 mr-2" />
                  Move to Current Game
                </Button>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <Card className="glass-card overflow-hidden shadow-lg transform transition-all rounded-2xl" style={{ backgroundColor: '#052240', boxShadow: '0 0 30px rgba(149, 222, 255, 0.8)' }}>
              <CardHeader className="p-4 rounded-t-2xl" style={{ background: 'linear-gradient(to right, #95deff, #004b6b)' }}>
                <CardTitle className="text-center text-2xl text-white">{teamAName} (Next Game)</CardTitle>
              </CardHeader>
              <CardContent className="p-4" style={{ backgroundColor: '#052240' }}>
                <div className="grid grid-cols-3 gap-3 mb-5">
                  <BirdButton 
                    variant="pink" 
                    amount={10} 
                    onClick={() => showBetConfirmation('A', 10, true)}
                    disabled={!currentUser}
                  />
                  <BirdButton 
                    variant="blue" 
                    amount={50} 
                    onClick={() => showBetConfirmation('A', 50, true)}
                    disabled={!currentUser}
                  />
                  <BirdButton
                    variant="yellow"
                    amount={100}
                    onClick={() => showBetConfirmation('A', 100, true)}
                    disabled={!currentUser}
                  />
                </div>
                
                <div className="relative">
                  <div className="w-full mb-1 sticky top-0 z-10 rounded-xl" style={{ backgroundColor: '#95deff' }}>
                    <div className="grid grid-cols-3 py-2">
                      <div className="text-center text-white font-medium">Bet ID</div>
                      <div className="text-center text-white font-medium">User</div>
                      <div className="text-center text-white font-medium">Amount</div>
                    </div>
                  </div>
                  <div className="max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
                    {nextTeamAQueue.length > 0 ? (
                      <div>
                        {nextTeamAQueue.map((bet) => {
                          const betUser = getUserById(bet.userId);
                          return (
                            <div 
                              key={bet.id} 
                              style={{ 
                                backgroundColor: bet.booked ? bet.color : (bet.color ? `${bet.color}DD` : 'rgba(31, 41, 55, 0.7)'),
                                transition: 'all 0.3s ease',
                                borderLeft: bet.booked ? `4px solid ${bet.color}` : 'none'
                              }}
                              className="grid grid-cols-3 py-2 mb-1 rounded-xl hover:brightness-110"
                            >
                              <div className={`text-center font-medium ${bet.booked ? 'text-black' : 'text-white'}`}>
                                #{bet.id}
                              </div>
                              <div className={`text-center font-medium ${bet.booked ? 'text-black' : 'text-white'} truncate`}>
                                {bet.userName || betUser?.name || 'User'}
                              </div>
                              <div className={`text-center flex justify-between items-center px-2 ${bet.booked ? 'text-black font-bold' : 'text-white'}`}>
                                {bet.amount} COINS
                                <div className="flex items-center gap-2">
                                  {!bet.booked ? (
                                    <>
                                      <span className="px-2 py-0.5 text-xs rounded-xl text-white" style={{ backgroundColor: '#95deff' }}>OPEN</span>
                                      {currentUser && bet.userId === currentUser.id && (
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="h-6 w-6 p-0 transition-colors"
                                          style={{ color: '#fa1593' }}
                                          onMouseEnter={(e) => {
                                            e.currentTarget.style.color = '#fa1593';
                                            e.currentTarget.style.backgroundColor = 'rgba(250, 21, 147, 0.2)';
                                          }}
                                          onMouseLeave={(e) => {
                                            e.currentTarget.style.color = '#fa1593';
                                            e.currentTarget.style.backgroundColor = 'transparent';
                                          }}
                                          onClick={() => deleteOpenBet(bet.id, true)}
                                          title="Delete your open bet"
                                        >
                                          <Trash2 className="h-3 w-3" />
                                        </Button>
                                      )}
                                    </>
                                  ) : (
                                    <span className="px-2 py-0.5 bg-black/30 text-xs rounded-xl flex items-center text-white">
                                      <CheckSquare className="w-3 h-3 mr-1" /> BOOKED
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center text-gray-400 py-8">No active bets</div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="glass-card overflow-hidden shadow-lg transform transition-all rounded-2xl" style={{ backgroundColor: '#052240', boxShadow: '0 0 30px rgba(250, 21, 147, 0.8)' }}>
              <CardHeader className="p-4 rounded-t-2xl" style={{ background: 'linear-gradient(to right, #fa1593, #004b6b)' }}>
                <CardTitle className="text-center text-2xl text-white">{teamBName} (Next Game)</CardTitle>
              </CardHeader>
              <CardContent className="p-4" style={{ backgroundColor: '#052240' }}>
                <div className="grid grid-cols-3 gap-3 mb-5">
                  <BirdButton 
                    variant="pink" 
                    amount={10} 
                    onClick={() => showBetConfirmation('B', 10, true)}
                    disabled={!currentUser}
                  />
                  <BirdButton 
                    variant="blue" 
                    amount={50} 
                    onClick={() => showBetConfirmation('B', 50, true)}
                    disabled={!currentUser}
                  />
                  <BirdButton
                    variant="yellow"
                    amount={100}
                    onClick={() => showBetConfirmation('B', 100, true)}
                    disabled={!currentUser}
                  />
                </div>
                
                <div className="relative">
                  <div className="w-full mb-1 sticky top-0 z-10 rounded-xl" style={{ backgroundColor: '#fa1593' }}>
                    <div className="grid grid-cols-3 py-2">
                      <div className="text-center text-white font-medium">Bet ID</div>
                      <div className="text-center text-white font-medium">User</div>
                      <div className="text-center text-white font-medium">Amount</div>
                    </div>
                  </div>
                  <div className="max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
                    {nextTeamBQueue.length > 0 ? (
                      <div>
                        {nextTeamBQueue.map((bet) => {
                          const betUser = getUserById(bet.userId);
                          return (
                            <div 
                              key={bet.id} 
                              style={{ 
                                backgroundColor: bet.booked ? bet.color : (bet.color ? `${bet.color}DD` : 'rgba(31, 41, 55, 0.7)'),
                                transition: 'all 0.3s ease',
                                borderLeft: bet.booked ? `4px solid ${bet.color}` : 'none'
                              }}
                              className="grid grid-cols-3 py-2 mb-1 rounded-xl hover:brightness-110"
                            >
                              <div className={`text-center font-medium ${bet.booked ? 'text-black' : 'text-white'}`}>
                                #{bet.id}
                              </div>
                              <div className={`text-center font-medium ${bet.booked ? 'text-black' : 'text-white'} truncate`}>
                                {bet.userName || betUser?.name || 'User'}
                              </div>
                              <div className={`text-center flex justify-between items-center px-2 ${bet.booked ? 'text-black font-bold' : 'text-white'}`}>
                                {bet.amount} COINS
                                <div className="flex items-center gap-2">
                                  {!bet.booked ? (
                                    <>
                                      <span className="px-2 py-0.5 text-xs rounded-xl text-white" style={{ backgroundColor: '#fa1593' }}>OPEN</span>
                                      {currentUser && bet.userId === currentUser.id && (
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="h-6 w-6 p-0 transition-colors"
                                          style={{ color: '#fa1593' }}
                                          onMouseEnter={(e) => {
                                            e.currentTarget.style.color = '#fa1593';
                                            e.currentTarget.style.backgroundColor = 'rgba(250, 21, 147, 0.2)';
                                          }}
                                          onMouseLeave={(e) => {
                                            e.currentTarget.style.color = '#fa1593';
                                            e.currentTarget.style.backgroundColor = 'transparent';
                                          }}
                                          onClick={() => deleteOpenBet(bet.id, true)}
                                          title="Delete your open bet"
                                        >
                                          <Trash2 className="h-3 w-3" />
                                        </Button>
                                      )}
                                    </>
                                  ) : (
                                    <span className="px-2 py-0.5 bg-black/30 text-xs rounded-xl flex items-center text-white">
                                      <CheckSquare className="w-3 h-3 mr-1" /> BOOKED
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center text-gray-400 py-8">No active bets</div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Betting Queue Information */}
        <div className="text-center mb-6">
          <p className="font-medium text-lg" style={{ color: '#000000' }}>
            *** BETS ARE HIGHLIGHTED ONCE MATCHED ***
          </p>
        </div>

        <BookedBetsReceipt 
          bookedBets={bookedBets} 
          teamAName={teamAName} 
          teamBName={teamBName} 
          title="BOOKED BETS"
          nextGameBets={nextBookedBets}
        />
        
        {/* ✅ SECURITY: Use actual isAdmin status, NOT isAdminMode (which can be toggled by any user) */}
        <BetReceiptsLedger 
          isAdmin={isAdmin}
          teamAName={teamAName}
          teamBName={teamBName}
        />
        
        <BetLedger 
          isAdmin={isAdminMode}
          teamAName={teamAName}
          teamBName={teamBName}
        />
      </div>
    </div>
  );
};

export default OnePocketArena;
