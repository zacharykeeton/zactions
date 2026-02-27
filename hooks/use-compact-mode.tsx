"use client";

import { createContext, useContext, useState, useEffect, useRef, useCallback, type ReactNode } from "react";
import { COMPACT_MODE_KEY } from "@/lib/constants";

interface CompactModeContextValue {
  compactMode: boolean;
  toggleCompactMode: () => void;
}

const CompactModeContext = createContext<CompactModeContextValue | undefined>(undefined);

function loadCompactMode(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(COMPACT_MODE_KEY) === "true";
}

export function CompactModeProvider({ children }: { children: ReactNode }) {
  const [compactMode, setCompactMode] = useState(loadCompactMode);
  const isInitialMount = useRef(true);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    localStorage.setItem(COMPACT_MODE_KEY, String(compactMode));
  }, [compactMode]);

  const toggleCompactMode = useCallback(() => {
    setCompactMode((prev) => !prev);
  }, []);

  return (
    <CompactModeContext value={{ compactMode, toggleCompactMode }}>
      {children}
    </CompactModeContext>
  );
}

export function useCompactMode(): CompactModeContextValue {
  const ctx = useContext(CompactModeContext);
  if (!ctx) {
    throw new Error("useCompactMode must be used within a CompactModeProvider");
  }
  return ctx;
}
