"use client";

import { createContext, useContext, useState, useEffect, useRef, useCallback, type ReactNode } from "react";
import { COMPACT_MODE_KEY, COMPACT_MODE_SETTINGS_KEY } from "@/lib/constants";
import type { CompactModeSettings } from "@/lib/types";

export const DEFAULT_COMPACT_MODE_SETTINGS: CompactModeSettings = {
  showPriority: false,
  showTags: false,
  showDueDate: false,
  showScheduledDate: false,
  showStartDate: false,
  showCreatedDate: false,
  showCompletedDate: false,
  showRecurrence: false,
  showCompletionCount: false,
  showTimeEstimate: false,
  showStatus: false,
};

interface CompactModeContextValue {
  compactMode: boolean;
  toggleCompactMode: () => void;
  settings: CompactModeSettings;
  updateSettings: (partial: Partial<CompactModeSettings>) => void;
}

const CompactModeContext = createContext<CompactModeContextValue | undefined>(undefined);

function loadCompactMode(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(COMPACT_MODE_KEY) === "true";
}

function loadSettings(): CompactModeSettings {
  if (typeof window === "undefined") return DEFAULT_COMPACT_MODE_SETTINGS;
  const stored = localStorage.getItem(COMPACT_MODE_SETTINGS_KEY);
  if (!stored) return DEFAULT_COMPACT_MODE_SETTINGS;
  try {
    return { ...DEFAULT_COMPACT_MODE_SETTINGS, ...JSON.parse(stored) };
  } catch {
    return DEFAULT_COMPACT_MODE_SETTINGS;
  }
}

export function CompactModeProvider({ children }: { children: ReactNode }) {
  const [compactMode, setCompactMode] = useState(false);
  const [settings, setSettings] = useState<CompactModeSettings>(DEFAULT_COMPACT_MODE_SETTINGS);
  const isInitialMount = useRef(true);
  const isSettingsInitialMount = useRef(true);

  useEffect(() => {
    const stored = loadCompactMode();
    if (stored) setCompactMode(true);
    setSettings(loadSettings());
  }, []);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    localStorage.setItem(COMPACT_MODE_KEY, String(compactMode));
  }, [compactMode]);

  useEffect(() => {
    if (isSettingsInitialMount.current) {
      isSettingsInitialMount.current = false;
      return;
    }
    localStorage.setItem(COMPACT_MODE_SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  const toggleCompactMode = useCallback(() => {
    setCompactMode((prev) => !prev);
  }, []);

  const updateSettings = useCallback((partial: Partial<CompactModeSettings>) => {
    setSettings((prev) => ({ ...prev, ...partial }));
  }, []);

  return (
    <CompactModeContext value={{ compactMode, toggleCompactMode, settings, updateSettings }}>
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
