"use client";

import { useState, useRef, useCallback, useEffect } from "react";

interface UseTimerReturn {
  activeTimerId: string | null;
  currentElapsedMs: number;
  startTimer: (taskId: string) => void;
  pauseTimer: () => void;
  stopTimerForTask: (taskId: string) => number;
}

export function useTimer(
  onSaveElapsed: (taskId: string, elapsedMs: number) => void
): UseTimerReturn {
  const [activeTimerId, setActiveTimerId] = useState<string | null>(null);
  const [currentElapsedMs, setCurrentElapsedMs] = useState(0);
  const timerStartedAtRef = useRef<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const activeTaskIdRef = useRef<string | null>(null);

  useEffect(() => {
    activeTaskIdRef.current = activeTimerId;
  }, [activeTimerId]);

  const clearTickInterval = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const getElapsedSinceStart = useCallback((): number => {
    if (timerStartedAtRef.current === null) return 0;
    return Date.now() - timerStartedAtRef.current;
  }, []);

  const pauseTimer = useCallback((): number => {
    const elapsed = getElapsedSinceStart();
    const taskId = activeTaskIdRef.current;

    clearTickInterval();
    timerStartedAtRef.current = null;
    setActiveTimerId(null);
    setCurrentElapsedMs(0);

    if (taskId && elapsed > 0) {
      onSaveElapsed(taskId, elapsed);
    }
    return elapsed;
  }, [clearTickInterval, getElapsedSinceStart, onSaveElapsed]);

  const startTimer = useCallback(
    (taskId: string) => {
      if (activeTaskIdRef.current !== null) {
        pauseTimer();
      }

      setActiveTimerId(taskId);
      timerStartedAtRef.current = Date.now();
      setCurrentElapsedMs(0);

      intervalRef.current = setInterval(() => {
        if (timerStartedAtRef.current !== null) {
          setCurrentElapsedMs(Date.now() - timerStartedAtRef.current);
        }
      }, 1000);
    },
    [pauseTimer]
  );

  const stopTimerForTask = useCallback(
    (taskId: string): number => {
      if (activeTaskIdRef.current === taskId) {
        return pauseTimer();
      }
      return 0;
    },
    [pauseTimer]
  );

  useEffect(() => {
    return () => {
      clearTickInterval();
    };
  }, [clearTickInterval]);

  return {
    activeTimerId,
    currentElapsedMs,
    startTimer,
    pauseTimer,
    stopTimerForTask,
  };
}
