import React, { useState, useEffect } from "react";
import { useGameState } from "@/contexts/GameStateContext";
import { useUser } from "@/contexts/UserContext";
import { BookOpen, Users, Coins, Link, Unlink, ChevronDown, ChevronUp, Trophy } from "lucide-react";

const STORAGE_KEY = 'gameState_one_pocket_arena';

const readFromStorage = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return null;
};

const readHistoryFromStorage = (): any[] => {
  try {
    const raw = localStorage.getItem('gamebird_bet_history');
    if (raw) return JSON.parse(raw);
  } catch {}
  return [];
};

const Whitebook: React.FC = () => {
  const { gameState } = useGameState();
  const { betHistory } = useUser();
  const [showNextGame, setShowNextGame] = useState(false);
  const [expandedGame, setExpandedGame] = useState<string | null>(null);
  const [localData, setLocalData] = useState<any>(readFromStorage);
  const [localHistory, setLocalHistory] = useState<any[]>(readHistoryFromStorage);

  // Keep data fresh from localStorage every second (same-tab + cross-tab)
  useEffect(() => {
    const sync = () => {
      setLocalData(readFromStorage());
      setLocalHistory(readHistoryFromStorage());
    };
    window.addEventListener('storage', sync);
    const interval = setInterval(sync, 1000);
    return () => { window.removeEventListener('storage', sync); clearInterval(interval); };
  }, []);

  // Merge: prefer live context data, fall back to localStorage
  const merged = {
    teamAQueue:          gameState.teamAQueue?.length       ? gameState.teamAQueue       : (localData?.teamAQueue       || []),
    teamBQueue:          gameState.teamBQueue?.length       ? gameState.teamBQueue       : (localData?.teamBQueue       || []),
    bookedBets:          gameState.bookedBets?.length       ? gameState.bookedBets       : (localData?.bookedBets       || []),
    nextTeamAQueue:      gameState.nextTeamAQueue?.length   ? gameState.nextTeamAQueue   : (localData?.nextTeamAQueue   || []),
    nextTeamBQueue:      gameState.nextTeamBQueue?.length   ? gameState.nextTeamBQueue   : (localData?.nextTeamBQueue   || []),
    nextBookedBets:      gameState.nextBookedBets?.length   ? gameState.nextBookedBets   : (localData?.nextBookedBets   || []),
    teamAName:           gameState.teamAName       || localData?.teamAName       || "Player A",
    teamBName:           gameState.teamBName       || localData?.teamBName       || "Player B",
    currentGameNumber:   gameState.currentGameNumber        ?? localData?.currentGameNumber ?? 1,
    totalBookedAmount:   gameState.totalBookedAmount        ?? localData?.totalBookedAmount ?? 0,
    nextTotalBookedAmount: gameState.nextTotalBookedAmount  ?? localData?.nextTotalBookedAmount ?? 0,
  };

  const {
    teamAQueue, teamBQueue, bookedBets,
    nextTeamAQueue, nextTeamBQueue, nextBookedBets,
    teamAName, teamBName, currentGameNumber,
    totalBookedAmount, nextTotalBookedAmount,
  } = merged;

  const totalAAmount = teamAQueue.reduce((s: number, b: any) => s + b.amount, 0);
  const totalBAmount = teamBQueue.reduce((s: number, b: any) => s + b.amount, 0);
  const nextTotalAAmount = nextTeamAQueue.reduce((s: number, b: any) => s + b.amount, 0);
  const nextTotalBAmount = nextTeamBQueue.reduce((s: number, b: any) => s + b.amount, 0);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const renderLiveQueue = (
    queueA: any[], queueB: any[], booked: any[],
    aName: string, bName: string,
    totalA: number, totalB: number, bookedTotal: number
  ) => {
    const hasAnyBets = queueA.length > 0 || queueB.length > 0;

    return (
      <div>
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="rounded-xl p-3 text-center" style={{ backgroundColor: "#004b6b", border: "1px solid #95deff40" }}>
            <div className="text-xs text-gray-400 mb-1">{aName}</div>
            <div className="text-lg font-bold" style={{ color: "#95deff" }}>{totalA}</div>
            <div className="text-xs text-gray-400">{queueA.length} bet{queueA.length !== 1 ? "s" : ""}</div>
          </div>
          <div className="rounded-xl p-3 text-center" style={{ backgroundColor: "#1a0a2e", border: "1px solid #ffd70040" }}>
            <div className="text-xs text-gray-400 mb-1">Matched Pool</div>
            <div className="text-lg font-bold" style={{ color: "#ffd700" }}>{bookedTotal}</div>
            <div className="text-xs text-gray-400">{booked.length} match{booked.length !== 1 ? "es" : ""}</div>
          </div>
          <div className="rounded-xl p-3 text-center" style={{ backgroundColor: "#004b6b", border: "1px solid #fa159340" }}>
            <div className="text-xs text-gray-400 mb-1">{bName}</div>
            <div className="text-lg font-bold" style={{ color: "#fa1593" }}>{totalB}</div>
            <div className="text-xs text-gray-400">{queueB.length} bet{queueB.length !== 1 ? "s" : ""}</div>
          </div>
        </div>

        {!hasAnyBets ? (
          <div className="text-center py-8" style={{ color: "#4a7a8a" }}>
            <Unlink className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No bets placed yet for this game.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {/* Team A */}
            <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #95deff30" }}>
              <div className="px-3 py-2 flex items-center gap-2" style={{ background: "linear-gradient(to right,#004b6b,#052240)" }}>
                <Users className="h-3 w-3" style={{ color: "#95deff" }} />
                <span className="text-sm font-bold" style={{ color: "#95deff" }}>{aName}</span>
              </div>
              {queueA.length === 0 ? (
                <div className="px-3 py-4 text-center text-xs text-gray-500">No bets</div>
              ) : (
                queueA.map((bet: any) => (
                  <div key={bet.id} className="flex items-center justify-between px-3 py-2" style={{ backgroundColor: "#052240", borderTop: "1px solid rgba(149,222,255,0.08)" }}>
                    <div className="flex items-center gap-2">
                      {bet.booked
                        ? <Link className="h-3 w-3 flex-shrink-0" style={{ color: "#ffd700" }} />
                        : <Unlink className="h-3 w-3 flex-shrink-0 opacity-30" style={{ color: "#95deff" }} />
                      }
                      <span className="text-sm text-white truncate max-w-[90px]">{bet.userName || "Unknown"}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Coins className="h-3 w-3" style={{ color: "#ffd700" }} />
                      <span className="text-sm font-bold text-white">{bet.amount}</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Team B */}
            <div className="rounded-xl overflow-hidden" style={{ border: "1px solid #fa159330" }}>
              <div className="px-3 py-2 flex items-center gap-2" style={{ background: "linear-gradient(to right,#3d0030,#052240)" }}>
                <Users className="h-3 w-3" style={{ color: "#fa1593" }} />
                <span className="text-sm font-bold" style={{ color: "#fa1593" }}>{bName}</span>
              </div>
              {queueB.length === 0 ? (
                <div className="px-3 py-4 text-center text-xs text-gray-500">No bets</div>
              ) : (
                queueB.map((bet: any) => (
                  <div key={bet.id} className="flex items-center justify-between px-3 py-2" style={{ backgroundColor: "#052240", borderTop: "1px solid rgba(250,21,147,0.08)" }}>
                    <div className="flex items-center gap-2">
                      {bet.booked
                        ? <Link className="h-3 w-3 flex-shrink-0" style={{ color: "#ffd700" }} />
                        : <Unlink className="h-3 w-3 flex-shrink-0 opacity-30" style={{ color: "#fa1593" }} />
                      }
                      <span className="text-sm text-white truncate max-w-[90px]">{bet.userName || "Unknown"}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Coins className="h-3 w-3" style={{ color: "#ffd700" }} />
                      <span className="text-sm font-bold text-white">{bet.amount}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {(queueA.length > 0 || queueB.length > 0) && (
          <div className="mt-3 flex items-center gap-3 text-xs" style={{ color: "#4a7a8a" }}>
            <span className="flex items-center gap-1"><Link className="h-3 w-3" style={{ color: "#ffd700" }} /> matched</span>
            <span className="flex items-center gap-1"><Unlink className="h-3 w-3 opacity-40" /> waiting</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen p-4 md:p-8" style={{ backgroundColor: "#020f1a" }}>
      <div className="max-w-2xl mx-auto space-y-4">

        {/* Header */}
        <div className="rounded-2xl p-5 text-center shadow-[0_0_30px_rgba(250,21,147,0.5)]"
          style={{ background: "linear-gradient(to right,#fa1593,#004b6b)", border: "2px solid #fa1593" }}>
          <div className="flex items-center justify-center gap-3">
            <BookOpen className="h-7 w-7 text-white" />
            <h1 className="text-3xl font-black text-white tracking-widest">WHITEBOOK</h1>
          </div>
          <p className="text-sm text-white/70 mt-1">Live Betting Ledger — {teamAName} vs {teamBName}</p>
        </div>

        {/* Current game live queue */}
        <div className="rounded-2xl overflow-hidden shadow-[0_0_20px_rgba(149,222,255,0.15)]"
          style={{ backgroundColor: "#052240", border: "2px solid #95deff30" }}>
          <div className="px-5 py-3 flex items-center justify-between"
            style={{ background: "linear-gradient(to right,#004b6b,#052240)" }}>
            <div>
              <div className="text-xs text-gray-400 uppercase tracking-widest">Live</div>
              <div className="text-lg font-black text-white">GAME {currentGameNumber}</div>
            </div>
            <div className="text-xs" style={{ color: "#95deff" }}>
              {teamAQueue.length + teamBQueue.length} bet{teamAQueue.length + teamBQueue.length !== 1 ? "s" : ""} active
            </div>
          </div>
          <div className="p-4">
            {renderLiveQueue(teamAQueue, teamBQueue, bookedBets, teamAName, teamBName, totalAAmount, totalBAmount, totalBookedAmount)}
          </div>
        </div>

        {/* Next game queue — only show if bets exist */}
        {(nextTeamAQueue.length > 0 || nextTeamBQueue.length > 0) && (
          <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: "#052240", border: "2px solid #fa159320" }}>
            <button className="w-full px-5 py-3 flex items-center justify-between"
              style={{ background: "linear-gradient(to right,#2a0020,#052240)" }}
              onClick={() => setShowNextGame(v => !v)}>
              <div>
                <div className="text-xs text-gray-400 uppercase tracking-widest">Queued</div>
                <div className="text-lg font-black text-white">GAME {currentGameNumber + 1}</div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs" style={{ color: "#fa1593" }}>
                  {nextTeamAQueue.length + nextTeamBQueue.length} bets
                </span>
                {showNextGame ? <ChevronUp className="h-4 w-4 text-white" /> : <ChevronDown className="h-4 w-4 text-white" />}
              </div>
            </button>
            {showNextGame && (
              <div className="p-4">
                {renderLiveQueue(nextTeamAQueue, nextTeamBQueue, nextBookedBets, teamAName, teamBName, nextTotalAAmount, nextTotalBAmount, nextTotalBookedAmount)}
              </div>
            )}
          </div>
        )}

        {/* Completed games history — prefer live context, fall back to localStorage */}
        {(() => { const history = betHistory.length > 0 ? betHistory : localHistory; return history.length > 0 && (
          <div className="rounded-2xl overflow-hidden" style={{ backgroundColor: "#052240", border: "2px solid #fa159330" }}>
            <div className="px-5 py-3" style={{ background: "linear-gradient(to right,#fa1593,#004b6b)" }}>
              <div className="text-xs text-white/70 uppercase tracking-widest">Completed</div>
              <div className="text-lg font-black text-white">Game History</div>
            </div>
            <div className="divide-y" style={{ borderColor: "rgba(250,21,147,0.1)" }}>
              {[...history].reverse().map((record) => {
                const isExpanded = expandedGame === record.id;
                const winColor = record.winningTeam === "A" ? "#95deff" : "#fa1593";
                const winName = record.winningTeam === "A" ? record.teamAName : record.teamBName;
                return (
                  <div key={record.id} style={{ borderColor: "rgba(250,21,147,0.1)" }}>
                    <button className="w-full px-4 py-3 flex items-center justify-between text-left"
                      onClick={() => setExpandedGame(isExpanded ? null : record.id)}>
                      <div className="flex items-center gap-3">
                        <div className="p-1.5 rounded-full" style={{ backgroundColor: `${winColor}20` }}>
                          <Trophy className="h-4 w-4" style={{ color: winColor }} />
                        </div>
                        <div>
                          <div className="text-sm font-bold text-white">Game #{record.gameNumber}</div>
                          <div className="text-xs" style={{ color: winColor }}>{winName} Won</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="text-xs text-white">{record.totalAmount || 0} coins</div>
                          <div className="text-xs text-gray-400">
                            {(record.bets?.teamA?.length || 0) + (record.bets?.teamB?.length || 0)} bets
                          </div>
                        </div>
                        {isExpanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="px-4 pb-4">
                        <div className="grid grid-cols-2 gap-3">
                          {/* Team A bets */}
                          <div className="rounded-lg overflow-hidden" style={{ border: `1px solid ${record.winningTeam === "A" ? "#95deff40" : "#ffffff10"}` }}>
                            <div className="px-3 py-2 text-xs font-bold" style={{ backgroundColor: "#004b6b", color: "#95deff" }}>
                              {record.teamAName}
                            </div>
                            {(record.bets?.teamA || []).length === 0 ? (
                              <div className="px-3 py-3 text-xs text-gray-500 text-center">No bets</div>
                            ) : (
                              record.bets.teamA.map((bet: any, i: number) => (
                                <div key={i} className="px-3 py-2" style={{ borderTop: "1px solid rgba(149,222,255,0.08)" }}>
                                  <div className="flex justify-between items-center">
                                    <span className="text-xs text-white truncate max-w-[80px]">{bet.userName}</span>
                                    <div className="flex items-center gap-1">
                                      <span className="text-xs font-bold" style={{ color: bet.won ? "#00ff88" : "#ff4466" }}>{bet.amount}</span>
                                      <span className="text-xs" style={{ color: bet.won ? "#00ff88" : "#ff4466" }}>{bet.won ? "✓" : "✗"}</span>
                                    </div>
                                  </div>
                                  {bet.startingBalance != null && (
                                    <div className="text-xs mt-0.5" style={{ color: "rgba(149,222,255,0.5)" }}>
                                      bal before: {bet.startingBalance}
                                    </div>
                                  )}
                                </div>
                              ))
                            )}
                          </div>

                          {/* Team B bets */}
                          <div className="rounded-lg overflow-hidden" style={{ border: `1px solid ${record.winningTeam === "B" ? "#fa159340" : "#ffffff10"}` }}>
                            <div className="px-3 py-2 text-xs font-bold" style={{ backgroundColor: "#3d0030", color: "#fa1593" }}>
                              {record.teamBName}
                            </div>
                            {(record.bets?.teamB || []).length === 0 ? (
                              <div className="px-3 py-3 text-xs text-gray-500 text-center">No bets</div>
                            ) : (
                              record.bets.teamB.map((bet: any, i: number) => (
                                <div key={i} className="px-3 py-2" style={{ borderTop: "1px solid rgba(250,21,147,0.08)" }}>
                                  <div className="flex justify-between items-center">
                                    <span className="text-xs text-white truncate max-w-[80px]">{bet.userName}</span>
                                    <div className="flex items-center gap-1">
                                      <span className="text-xs font-bold" style={{ color: bet.won ? "#00ff88" : "#ff4466" }}>{bet.amount}</span>
                                      <span className="text-xs" style={{ color: bet.won ? "#00ff88" : "#ff4466" }}>{bet.won ? "✓" : "✗"}</span>
                                    </div>
                                  </div>
                                  {bet.startingBalance != null && (
                                    <div className="text-xs mt-0.5" style={{ color: "rgba(250,21,147,0.5)" }}>
                                      bal before: {bet.startingBalance}
                                    </div>
                                  )}
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )})()}

        {betHistory.length === 0 && localHistory.length === 0 && teamAQueue.length === 0 && teamBQueue.length === 0 && (
          <div className="text-center py-6 text-gray-500 text-sm">
            No bet activity yet. Bets placed in the betting queue will appear here.
          </div>
        )}

      </div>
    </div>
  );
};

export default Whitebook;
