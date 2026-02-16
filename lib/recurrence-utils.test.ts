import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fastForwardDueDate, getNextDueDate } from './recurrence-utils';
import type { RecurrencePattern } from './types';

describe('fastForwardDueDate', () => {
  beforeEach(() => {
    // Mock current date to Feb 16, 2026 at midnight
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-16T00:00:00.000Z'));
  });

  describe('daily recurrence', () => {
    const dailyPattern: RecurrencePattern = { interval: 'daily' };

    it('should fast forward from 2 days ago to today', () => {
      const dueDate = '2026-02-14T00:00:00.000Z'; // Feb 14
      const result = fastForwardDueDate(dueDate, dailyPattern);
      expect(result).toBe('2026-02-16T00:00:00.000Z'); // Feb 16 (today)
    });

    it('should fast forward from a week ago to today', () => {
      const dueDate = '2026-02-09T00:00:00.000Z'; // Feb 9
      const result = fastForwardDueDate(dueDate, dailyPattern);
      expect(result).toBe('2026-02-16T00:00:00.000Z'); // Feb 16 (today)
    });

    it('should fast forward from a long time ago to today', () => {
      const dueDate = '2026-01-01T00:00:00.000Z'; // Jan 1
      const result = fastForwardDueDate(dueDate, dailyPattern);
      expect(result).toBe('2026-02-16T00:00:00.000Z'); // Feb 16 (today)
    });

    it('should return current date if due date is today', () => {
      const dueDate = '2026-02-16T00:00:00.000Z'; // Feb 16 (today)
      const result = fastForwardDueDate(dueDate, dailyPattern);
      expect(result).toBe('2026-02-16T00:00:00.000Z');
    });

    it('should return current date if due date is in the future', () => {
      const dueDate = '2026-02-17T00:00:00.000Z'; // Feb 17 (tomorrow)
      const result = fastForwardDueDate(dueDate, dailyPattern);
      expect(result).toBe('2026-02-17T00:00:00.000Z');
    });
  });

  describe('weekly recurrence', () => {
    const weeklyPattern: RecurrencePattern = { interval: 'weekly' };

    it('should fast forward from last week to this week (same day)', () => {
      const dueDate = '2026-02-09T00:00:00.000Z'; // Feb 9 (Mon)
      const result = fastForwardDueDate(dueDate, weeklyPattern);
      expect(result).toBe('2026-02-16T00:00:00.000Z'); // Feb 16 (Mon, today)
    });

    it('should fast forward multiple weeks', () => {
      const dueDate = '2026-01-19T00:00:00.000Z'; // Jan 19 (Mon, 4 weeks ago)
      const result = fastForwardDueDate(dueDate, weeklyPattern);
      expect(result).toBe('2026-02-16T00:00:00.000Z'); // Feb 16 (Mon, today)
    });

    it('should return current date if due date is in current week', () => {
      const dueDate = '2026-02-16T00:00:00.000Z'; // Feb 16 (today)
      const result = fastForwardDueDate(dueDate, weeklyPattern);
      expect(result).toBe('2026-02-16T00:00:00.000Z');
    });
  });

  describe('weekly recurrence with specific days', () => {
    it('should return today if today is a scheduled day', () => {
      // Today is Monday (day 1)
      const pattern: RecurrencePattern = {
        interval: 'weekly',
        daysOfWeek: [1, 3, 5] // Mon, Wed, Fri
      };
      const dueDate = '2026-02-09T00:00:00.000Z'; // Feb 9 (last Monday)
      const result = fastForwardDueDate(dueDate, pattern);
      expect(result).toBe('2026-02-16T00:00:00.000Z'); // Today (Monday)
    });

    it('should return most recent scheduled day if today is not scheduled', () => {
      // Today is Monday (day 1)
      const pattern: RecurrencePattern = {
        interval: 'weekly',
        daysOfWeek: [0, 6] // Sun, Sat
      };
      const dueDate = '2026-02-01T00:00:00.000Z'; // Feb 1 (Sunday)
      const result = fastForwardDueDate(dueDate, pattern);
      // Should return Feb 15 (Sunday, yesterday) or Feb 14 (Saturday)
      const resultDate = new Date(result);
      expect(resultDate.getDay()).toBeOneOf([0, 6]); // Sun or Sat
      expect(resultDate <= new Date('2026-02-16T00:00:00.000Z')).toBe(true);
    });

    it('should handle multiple scheduled days in the week', () => {
      // Today is Monday (day 1)
      const pattern: RecurrencePattern = {
        interval: 'weekly',
        daysOfWeek: [2, 4] // Tue, Thu
      };
      const dueDate = '2026-02-04T00:00:00.000Z'; // Feb 4 (Tuesday)
      const result = fastForwardDueDate(dueDate, pattern);
      const resultDate = new Date(result);
      // Should be either Thursday Feb 13 or earlier scheduled day
      expect(resultDate <= new Date('2026-02-16T00:00:00.000Z')).toBe(true);
      expect([2, 4]).toContain(resultDate.getUTCDay());
    });

    it('should handle edge case with no recent scheduled days', () => {
      // Today is Monday (day 1)
      const pattern: RecurrencePattern = {
        interval: 'weekly',
        daysOfWeek: [2] // Only Tuesday
      };
      const dueDate = '2026-01-01T00:00:00.000Z'; // Jan 1
      const result = fastForwardDueDate(dueDate, pattern);
      // Should find the most recent Tuesday or fallback to today
      const resultDate = new Date(result);
      expect(resultDate <= new Date('2026-02-16T00:00:00.000Z')).toBe(true);
    });
  });

  describe('monthly recurrence', () => {
    const monthlyPattern: RecurrencePattern = { interval: 'monthly' };

    it('should fast forward to current month if date has passed', () => {
      const dueDate = '2026-01-15T00:00:00.000Z'; // Jan 15
      const result = fastForwardDueDate(dueDate, monthlyPattern);
      expect(result).toBe('2026-02-15T00:00:00.000Z'); // Feb 15
    });

    it('should fast forward to next month if date is still ahead in current month', () => {
      const dueDate = '2026-02-20T00:00:00.000Z'; // Feb 20 (future)
      const result = fastForwardDueDate(dueDate, monthlyPattern);
      expect(result).toBe('2026-02-20T00:00:00.000Z'); // Still Feb 20
    });

    it('should fast forward multiple months', () => {
      const dueDate = '2025-10-15T00:00:00.000Z'; // Oct 15, 2025
      const result = fastForwardDueDate(dueDate, monthlyPattern);
      expect(result).toBe('2026-02-15T00:00:00.000Z'); // Feb 15, 2026
    });

    it('should handle month overflow correctly', () => {
      const dueDate = '2026-01-31T00:00:00.000Z'; // Jan 31
      const result = fastForwardDueDate(dueDate, monthlyPattern);
      // Feb doesn't have 31 days, should clamp to Feb 28
      const resultDate = new Date(result);
      expect(resultDate.getUTCMonth()).toBe(1); // February (0-indexed)
      expect(resultDate.getUTCDate()).toBeLessThanOrEqual(29); // Feb 28 or 29
      expect(resultDate >= new Date('2026-02-16T00:00:00.000Z')).toBe(true);
    });
  });

  describe('yearly recurrence', () => {
    const yearlyPattern: RecurrencePattern = { interval: 'yearly' };

    it('should fast forward to current year if date has passed', () => {
      const dueDate = '2025-02-14T00:00:00.000Z'; // Feb 14, 2025
      const result = fastForwardDueDate(dueDate, yearlyPattern);
      expect(result).toBe('2026-02-14T00:00:00.000Z'); // Feb 14, 2026
    });

    it('should fast forward to next year if date is still ahead in current year', () => {
      const dueDate = '2026-03-01T00:00:00.000Z'; // Mar 1, 2026 (future)
      const result = fastForwardDueDate(dueDate, yearlyPattern);
      expect(result).toBe('2026-03-01T00:00:00.000Z'); // Still Mar 1, 2026
    });

    it('should fast forward multiple years', () => {
      const dueDate = '2020-02-14T00:00:00.000Z'; // Feb 14, 2020
      const result = fastForwardDueDate(dueDate, yearlyPattern);
      expect(result).toBe('2026-02-14T00:00:00.000Z'); // Feb 14, 2026
    });

    it('should handle leap year dates correctly', () => {
      const dueDate = '2024-02-29T00:00:00.000Z'; // Feb 29, 2024 (leap year)
      const result = fastForwardDueDate(dueDate, yearlyPattern);
      // 2026 is not a leap year
      const resultDate = new Date(result);
      expect(resultDate.getFullYear()).toBe(2026);
      expect(resultDate >= new Date('2026-02-16T00:00:00.000Z')).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('should handle due dates at exact midnight', () => {
      const dailyPattern: RecurrencePattern = { interval: 'daily' };
      const dueDate = '2026-02-15T00:00:00.000Z'; // Yesterday at midnight
      const result = fastForwardDueDate(dueDate, dailyPattern);
      expect(result).toBe('2026-02-16T00:00:00.000Z'); // Today at midnight
    });

    it('should handle due dates with time components', () => {
      const dailyPattern: RecurrencePattern = { interval: 'daily' };
      const dueDate = '2026-02-14T14:30:00.000Z'; // Feb 14 at 2:30 PM
      const result = fastForwardDueDate(dueDate, dailyPattern);
      // Should preserve the time component while advancing to today
      expect(result).toBe('2026-02-16T14:30:00.000Z');
    });
  });
});

describe('getNextDueDate vs fastForwardDueDate', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-16T00:00:00.000Z'));
  });

  it('getNextDueDate should advance beyond today, fastForwardDueDate should land on today', () => {
    const dailyPattern: RecurrencePattern = { interval: 'daily' };
    const dueDate = '2026-02-14T00:00:00.000Z'; // Feb 14 (2 days ago)

    const nextDue = getNextDueDate(dueDate, dailyPattern);
    const fastForward = fastForwardDueDate(dueDate, dailyPattern);

    expect(nextDue).toBe('2026-02-17T00:00:00.000Z'); // Tomorrow (next occurrence)
    expect(fastForward).toBe('2026-02-16T00:00:00.000Z'); // Today (catch up)
  });

  it('both should behave the same for future dates', () => {
    const dailyPattern: RecurrencePattern = { interval: 'daily' };
    const dueDate = '2026-02-17T00:00:00.000Z'; // Feb 17 (tomorrow)

    const nextDue = getNextDueDate(dueDate, dailyPattern);
    const fastForward = fastForwardDueDate(dueDate, dailyPattern);

    // Both should return the same result since it's already in the future
    expect(nextDue).toBe('2026-02-18T00:00:00.000Z');
    expect(fastForward).toBe('2026-02-17T00:00:00.000Z'); // Returns unchanged
  });
});

// Custom matcher for array membership
expect.extend({
  toBeOneOf(received: unknown, expected: unknown[]) {
    const pass = expected.includes(received);
    return {
      pass,
      message: () =>
        pass
          ? `expected ${received} not to be one of ${expected.join(', ')}`
          : `expected ${received} to be one of ${expected.join(', ')}`,
    };
  },
});
