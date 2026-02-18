"use client";

import { useState, useEffect, useCallback } from "react";
import { TODAY_SORT_ORDER_KEY } from "@/lib/constants";

export function useTodaySortOrder(storageKey: string = TODAY_SORT_ORDER_KEY) {
  const [sortOrder, setSortOrder] = useState<string[]>([]);

  // Load from localStorage after hydration to avoid SSR mismatch
  useEffect(() => {
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      try {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSortOrder(JSON.parse(stored) as string[]);
      } catch {
        /* corrupt data, start fresh */
      }
    }
  }, [storageKey]);

  const updateSortOrder = useCallback((newOrder: string[]) => {
    setSortOrder(newOrder);
    localStorage.setItem(storageKey, JSON.stringify(newOrder));
  }, [storageKey]);

  const cleanupStaleIds = useCallback((validIds: Set<string>) => {
    setSortOrder((prev) => {
      const cleaned = prev.filter((id) => validIds.has(id));
      localStorage.setItem(storageKey, JSON.stringify(cleaned));
      return cleaned;
    });
  }, [storageKey]);

  return {
    sortOrder,
    updateSortOrder,
    cleanupStaleIds,
  };
}
