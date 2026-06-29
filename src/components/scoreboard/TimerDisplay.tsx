import React, { useState, useEffect, useRef } from 'react';
import { useGame } from '@/contexts/GameContext';

function useElapsedMs(timerElapsedMs: number, timerStartedAt: number | null, isTimerRunning: boolean, clockOffset: number) {
  // localStartRef: the local Date.now() when we first received this timerStartedAt value.
  // We tick forward from our own clock offset so all devices stay in sync regardless
  // of clock differences between devices.
  const localStartRef = useRef<number | null>(null);
  const baseElapsedRef = useRef(timerElapsedMs);
  const [displayMs, setDisplayMs] = useState(timerElapsedMs);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (isTimerRunning && timerStartedAt) {
      // timerStartedAt is in server time; Date.now() + clockOffset ≈ server time,
      // so the difference gives true elapsed regardless of device clock differences.
      const elapsedInCurrentRun = Math.max(0, (Date.now() + clockOffset) - timerStartedAt);
      localStartRef.current = Date.now();
      baseElapsedRef.current = timerElapsedMs + elapsedInCurrentRun;

      const tick = () => {
        const localElapsed = Date.now() - (localStartRef.current ?? Date.now());
        setDisplayMs(baseElapsedRef.current + localElapsed);
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } else {
      localStartRef.current = null;
      setDisplayMs(timerElapsedMs);
    }

    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [isTimerRunning, timerStartedAt, timerElapsedMs, clockOffset]);

  return displayMs;
}

function fmt(ms: number) {
  const totalSecs = Math.floor(ms / 1000);
  const h = Math.floor(totalSecs / 3600).toString().padStart(2, '0');
  const m = Math.floor((totalSecs % 3600) / 60).toString().padStart(2, '0');
  const s = (totalSecs % 60).toString().padStart(2, '0');
  const cs = Math.floor((ms % 1000) / 10).toString().padStart(2, '0');
  return `${h}.${m}.${s}.${cs}`;
}

export default function TimerDisplay() {
  const { game, isAdmin, startTimer, pauseTimer, resetTimer, clockOffset } = useGame();
  const { timerElapsedMs, timerStartedAt, isTimerRunning } = game;

  const elapsedMs = useElapsedMs(timerElapsedMs, timerStartedAt, isTimerRunning, clockOffset);
  const display = fmt(elapsedMs);

  return (
    <div className="flex flex-col items-center gap-1">
      {/* LIVE indicator */}
      <div className="flex items-center gap-1.5 mb-0.5">
        <span style={{
          color: '#ff0040',
          fontSize: '1rem',
          fontWeight: 900,
          letterSpacing: '0.25em',
          fontFamily: 'monospace',
          textShadow: 'none',
          opacity: isTimerRunning ? 1 : 0.3,
          animation: isTimerRunning ? 'livePulse 1s ease-in-out infinite' : 'none',
        }}>
          ▶ LIVE
        </span>
        <span style={{
          width: 11,
          height: 11,
          borderRadius: '50%',
          background: '#ff0040',
          boxShadow: 'none',
          opacity: isTimerRunning ? 1 : 0.2,
          animation: isTimerRunning ? 'liveDot 1s ease-in-out infinite' : 'none',
          display: 'inline-block',
          flexShrink: 0,
        }} />
      </div>

      <div className="mono font-bold tracking-widest neon-cyan leading-none" style={{ fontSize: '2.5rem' }}>
        {display}
      </div>

      {isAdmin && (
        <div className="flex items-center gap-2 mt-1">
          <span className="mono text-xs font-black tracking-widest" style={{ color: '#fff' }}>GAME #{game.currentGameNumber}</span>
          <button className="btn btn-cyan px-3 py-1 text-xs" onClick={isTimerRunning ? pauseTimer : startTimer}>
            {isTimerRunning ? '⏸ PAUSE' : '▶ START'}
          </button>
          <button className="btn btn-ghost px-3 py-1 text-xs" onClick={resetTimer}>
            ↺ RESET
          </button>
          <span className="mono text-xs font-black tracking-widest" style={{ color: '#fff' }}>1-POCKET</span>
        </div>
      )}
    </div>
  );
}
