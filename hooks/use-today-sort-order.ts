"use client";

import { useState, useEffect, useCallback } from "react";
import { TODAY_SORT_ORDER_KEY } from "@/lib/constants";

export function useTodaySortOrder() {
  const [sortOrder, setSortOrder] = useState<string[]>([]);

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
  }, []);

  const updateSortOrder = useCallback((newOrder: string[]) => {
    setSortOrder(newOrder);
    localStorage.setItem(TODAY_SORT_ORDER_KEY, JSON.stringify(newOrder));
  }, []);

  const cleanupStaleIds = useCallback((validIds: Set<string>) => {
    setSortOrder((prev) => {
      const cleaned = prev.filter((id) => validIds.has(id));
      localStorage.setItem(TODAY_SORT_ORDER_KEY, JSON.stringify(cleaned));
      return cleaned;
    });
  }, []);

  return {
    sortOrder,
    updateSortOrder,
    cleanupStaleIds,
  };
}
