"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { TODAY_SORT_ORDER_KEY } from "@/lib/constants";

export function useTodaySortOrder() {
  const [sortOrder, setSortOrder] = useState<string[]>([]);
  const isLoadingFromStorage = useRef(true);

  // Persist changes (skips initial mount while loading)
  useEffect(() => {
    if (isLoadingFromStorage.current) return;
    localStorage.setItem(TODAY_SORT_ORDER_KEY, JSON.stringify(sortOrder));
  }, [sortOrder]);

  // Load from localStorage after hydration to avoid SSR mismatch
  useEffect(() => {
    const stored = localStorage.getItem(TODAY_SORT_ORDER_KEY);
    if (stored) {
      try {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSortOrder(JSON.parse(stored) as string[]);
      } catch {
        /* corrupt data, start fresh */
      }
    }
    isLoadingFromStorage.current = false;
  }, []);

  const updateSortOrder = useCallback((newOrder: string[]) => {
    setSortOrder(newOrder);
  }, []);

  const cleanupStaleIds = useCallback((validIds: Set<string>) => {
    setSortOrder((prev) => prev.filter((id) => validIds.has(id)));
  }, []);

  return {
    sortOrder,
    updateSortOrder,
    cleanupStaleIds,
  };
}
