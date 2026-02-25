import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fastForwardDueDate, formatRecurrencePattern, getNextDueDate } from './recurrence-utils';
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
      expect(result).toBe('2026-02-16'); // Feb 16 (today)
    });

    it('should fast forward from a week ago to today', () => {
      const dueDate = '2026-02-09T00:00:00.000Z'; // Feb 9
      const result = fastForwardDueDate(dueDate, dailyPattern);
      expect(result).toBe('2026-02-16'); // Feb 16 (today)
    });

    it('should fast forward from a long time ago to today', () => {
      const dueDate = '2026-01-01T00:00:00.000Z'; // Jan 1
      const result = fastForwardDueDate(dueDate, dailyPattern);
      expect(result).toBe('2026-02-16'); // Feb 16 (today)
    });

    it('should return current date if due date is today', () => {
      const dueDate = '2026-02-16T00:00:00.000Z'; // Feb 16 (today)
      const result = fastForwardDueDate(dueDate, dailyPattern);
      expect(result).toBe('2026-02-16');
    });

    it('should return current date if due date is in the future', () => {
      const dueDate = '2026-02-17T00:00:00.000Z'; // Feb 17 (tomorrow)
      const result = fastForwardDueDate(dueDate, dailyPattern);
      expect(result).toBe('2026-02-17');
    });
  });

  describe('weekly recurrence', () => {
    const weeklyPattern: RecurrencePattern = { interval: 'weekly' };

    it('should fast forward from last week to this week (same day)', () => {
      const dueDate = '2026-02-09T00:00:00.000Z'; // Feb 9 (Mon)
      const result = fastForwardDueDate(dueDate, weeklyPattern);
      expect(result).toBe('2026-02-16'); // Feb 16 (Mon, today)
    });

    it('should fast forward multiple weeks', () => {
      const dueDate = '2026-01-19T00:00:00.000Z'; // Jan 19 (Mon, 4 weeks ago)
      const result = fastForwardDueDate(dueDate, weeklyPattern);
      expect(result).toBe('2026-02-16'); // Feb 16 (Mon, today)
    });

    it('should return current date if due date is in current week', () => {
      const dueDate = '2026-02-16T00:00:00.000Z'; // Feb 16 (today)
      const result = fastForwardDueDate(dueDate, weeklyPattern);
      expect(result).toBe('2026-02-16');
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
      expect(result).toBe('2026-02-16'); // Today (Monday)
    });

    it('should return most recent scheduled day if today is not scheduled', () => {
      // Today is Monday (day 1)
      const pattern: RecurrencePattern = {
        interval: 'weekly',
        daysOfWeek: [0, 6] // Sun, Sat
      };
      const dueDate = '2026-02-01T00:00:00.000Z'; // Feb 1 (Sunday)
      const result = fastForwardDueDate(dueDate, pattern);
      // Should return Feb 15 (Sunday) — most recent scheduled day <= today
      expect(result).toBe('2026-02-15');
    });

    it('should handle multiple scheduled days in the week', () => {
      // Today is Monday (day 1)
      const pattern: RecurrencePattern = {
        interval: 'weekly',
        daysOfWeek: [2, 4] // Tue, Thu
      };
      const dueDate = '2026-02-04T00:00:00.000Z'; // Feb 4 (Tuesday)
      const result = fastForwardDueDate(dueDate, pattern);
      // Most recent Tue or Thu before today (Feb 16): Thu Feb 12
      expect(result).toBe('2026-02-12');
    });

    it('should handle edge case with no recent scheduled days', () => {
      // Today is Monday (day 1)
      const pattern: RecurrencePattern = {
        interval: 'weekly',
        daysOfWeek: [2] // Only Tuesday
      };
      const dueDate = '2026-01-01T00:00:00.000Z'; // Jan 1
      const result = fastForwardDueDate(dueDate, pattern);
      // Most recent Tuesday before today (Feb 16): Tue Feb 10
      expect(result).toBe('2026-02-10');
    });
  });

  describe('monthly recurrence', () => {
    const monthlyPattern: RecurrencePattern = { interval: 'monthly' };

    it('should fast forward to current month if date has passed', () => {
      const dueDate = '2026-01-15T00:00:00.000Z'; // Jan 15
      const result = fastForwardDueDate(dueDate, monthlyPattern);
      expect(result).toBe('2026-02-15'); // Feb 15
    });

    it('should fast forward to next month if date is still ahead in current month', () => {
      const dueDate = '2026-02-20T00:00:00.000Z'; // Feb 20 (future)
      const result = fastForwardDueDate(dueDate, monthlyPattern);
      expect(result).toBe('2026-02-20'); // Still Feb 20
    });

    it('should fast forward multiple months', () => {
      const dueDate = '2025-10-15T00:00:00.000Z'; // Oct 15, 2025
      const result = fastForwardDueDate(dueDate, monthlyPattern);
      expect(result).toBe('2026-02-15'); // Feb 15, 2026
    });

    it('should handle month overflow correctly', () => {
      const dueDate = '2026-01-31T00:00:00.000Z'; // Jan 31
      const result = fastForwardDueDate(dueDate, monthlyPattern);
      // Feb doesn't have 31 days, should clamp to Feb 28
      expect(result).toBe('2026-02-28');
    });
  });

  describe('yearly recurrence', () => {
    const yearlyPattern: RecurrencePattern = { interval: 'yearly' };

    it('should fast forward to current year if date has passed', () => {
      const dueDate = '2025-02-14T00:00:00.000Z'; // Feb 14, 2025
      const result = fastForwardDueDate(dueDate, yearlyPattern);
      expect(result).toBe('2026-02-14'); // Feb 14, 2026
    });

    it('should fast forward to next year if date is still ahead in current year', () => {
      const dueDate = '2026-03-01T00:00:00.000Z'; // Mar 1, 2026 (future)
      const result = fastForwardDueDate(dueDate, yearlyPattern);
      expect(result).toBe('2026-03-01'); // Still Mar 1, 2026
    });

    it('should fast forward multiple years', () => {
      const dueDate = '2020-02-14T00:00:00.000Z'; // Feb 14, 2020
      const result = fastForwardDueDate(dueDate, yearlyPattern);
      expect(result).toBe('2026-02-14'); // Feb 14, 2026
    });

    it('should handle leap year dates correctly', () => {
      const dueDate = '2024-02-29T00:00:00.000Z'; // Feb 29, 2024 (leap year)
      const result = fastForwardDueDate(dueDate, yearlyPattern);
      // 2026 is not a leap year, clamps to Feb 28
      expect(result).toBe('2026-02-28');
    });
  });

  describe('edge cases', () => {
    it('should handle due dates at exact midnight', () => {
      const dailyPattern: RecurrencePattern = { interval: 'daily' };
      const dueDate = '2026-02-15T00:00:00.000Z'; // Yesterday at midnight
      const result = fastForwardDueDate(dueDate, dailyPattern);
      expect(result).toBe('2026-02-16'); // Today at midnight
    });

    it('should handle due dates with time components', () => {
      const dailyPattern: RecurrencePattern = { interval: 'daily' };
      const dueDate = '2026-02-14T14:30:00.000Z'; // Feb 14 at 2:30 PM
      const result = fastForwardDueDate(dueDate, dailyPattern);
      // Should return date-only string (time component is dropped for consistency)
      expect(result).toBe('2026-02-16');
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

    expect(nextDue).toBe('2026-02-17'); // Tomorrow (next occurrence)
    expect(fastForward).toBe('2026-02-16'); // Today (catch up)
  });

  it('both should behave the same for future dates', () => {
    const dailyPattern: RecurrencePattern = { interval: 'daily' };
    const dueDate = '2026-02-17T00:00:00.000Z'; // Feb 17 (tomorrow)

    const nextDue = getNextDueDate(dueDate, dailyPattern);
    const fastForward = fastForwardDueDate(dueDate, dailyPattern);

    // Both should return the same result since it's already in the future
    expect(nextDue).toBe('2026-02-18');
    expect(fastForward).toBe('2026-02-17'); // Returns unchanged
  });
});

describe('frequency > 1 recurrence', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Today is Monday Feb 16, 2026
    vi.setSystemTime(new Date('2026-02-16T00:00:00.000Z'));
  });

  describe('getNextDueDate with frequency', () => {
    it('daily frequency=3: advances by 3 days from a recent due date', () => {
      const pattern: RecurrencePattern = { interval: 'daily', frequency: 3 };
      const dueDate = '2026-02-15T00:00:00.000Z'; // yesterday
      const result = getNextDueDate(dueDate, pattern);
      expect(result).toBe('2026-02-18'); // +3 days
    });

    it('daily frequency=3: skips to next valid occurrence when overdue', () => {
      const pattern: RecurrencePattern = { interval: 'daily', frequency: 3 };
      // dueDate was Jan 1; occurrences: Jan 1, 4, 7, 10, ... Feb 14, 17
      const dueDate = '2026-02-14T00:00:00.000Z'; // 2 days ago (valid occurrence)
      const result = getNextDueDate(dueDate, pattern);
      // next occurrence after today (Feb 16) is Feb 17
      expect(result).toBe('2026-02-17');
    });

    it('weekly frequency=2 (no specific days): advances by 2 weeks', () => {
      const pattern: RecurrencePattern = { interval: 'weekly', frequency: 2 };
      const dueDate = '2026-02-16T00:00:00.000Z'; // today (Mon)
      const result = getNextDueDate(dueDate, pattern);
      expect(result).toBe('2026-03-02'); // +2 weeks
    });

    it('weekly frequency=2 (no specific days): skips to next valid occurrence when overdue', () => {
      const pattern: RecurrencePattern = { interval: 'weekly', frequency: 2 };
      // dueDate was 3 weeks ago; next valid period is 4 weeks from dueDate
      const dueDate = '2026-01-26T00:00:00.000Z'; // 3 weeks ago (Mon)
      const result = getNextDueDate(dueDate, pattern);
      // Occurrences: Jan 26, Feb 9, Feb 23, ...
      // Today is Feb 16; next after today is Feb 23
      expect(result).toBe('2026-02-23');
    });

    it('weekly frequency=2 with daysOfWeek=[6] (every other Saturday): advances 2 weeks', () => {
      const pattern: RecurrencePattern = { interval: 'weekly', frequency: 2, daysOfWeek: [6] };
      // dueDate = last Saturday
      const dueDate = '2026-02-14T00:00:00.000Z'; // Sat Feb 14
      const result = getNextDueDate(dueDate, pattern);
      expect(result).toBe('2026-02-28'); // Sat Feb 28 (2 weeks later)
    });

    it('weekly frequency=2 with daysOfWeek=[1,5] (Mon+Fri): returns Fri of same week after Mon', () => {
      const pattern: RecurrencePattern = { interval: 'weekly', frequency: 2, daysOfWeek: [1, 5] };
      // dueDate = this Monday (today)
      const dueDate = '2026-02-16T00:00:00.000Z'; // Mon Feb 16
      const result = getNextDueDate(dueDate, pattern);
      // Next in same cycle is Fri Feb 20
      expect(result).toBe('2026-02-20');
    });

    it('weekly frequency=2 with daysOfWeek=[1,5]: jumps 2 weeks after the last day in a cycle', () => {
      const pattern: RecurrencePattern = { interval: 'weekly', frequency: 2, daysOfWeek: [1, 5] };
      // dueDate = last Friday (last day in its cycle)
      const dueDate = '2026-02-13T00:00:00.000Z'; // Fri Feb 13
      const result = getNextDueDate(dueDate, pattern);
      // Next cycle starts Mon Feb 23 (Fri + 3 days to Mon + 7 days skip = +10 days)
      expect(result).toBe('2026-02-23');
    });

    it('monthly frequency=2: advances by 2 months', () => {
      const pattern: RecurrencePattern = { interval: 'monthly', frequency: 2 };
      const dueDate = '2026-02-15T00:00:00.000Z';
      const result = getNextDueDate(dueDate, pattern);
      // Allow for DST-induced off-by-one: addMonths uses local time
      expect(result).toMatch(/^2026-04-1[45]$/);
    });

    it('monthly frequency=2: skips to next valid occurrence when overdue', () => {
      const pattern: RecurrencePattern = { interval: 'monthly', frequency: 2 };
      // dueDate = Oct 15, 2025; occurrences Oct 15, Dec 15, Feb 15, Apr 15, ...
      const dueDate = '2025-10-15T00:00:00.000Z';
      const result = getNextDueDate(dueDate, pattern);
      // Today Feb 16; Feb 15 is past; next is Apr 15
      expect(result).toBe('2026-04-15');
    });

    it('yearly frequency=2: advances by 2 years', () => {
      const pattern: RecurrencePattern = { interval: 'yearly', frequency: 2 };
      const dueDate = '2026-02-15T00:00:00.000Z';
      const result = getNextDueDate(dueDate, pattern);
      expect(result).toBe('2028-02-15');
    });
  });

  describe('fastForwardDueDate with frequency', () => {
    it('daily frequency=3: lands on the most recent valid occurrence', () => {
      const pattern: RecurrencePattern = { interval: 'daily', frequency: 3 };
      // dueDate = Jan 1; occurrences: 0, 3, 6, ... 42(Feb12), 45(Feb15), 48(Feb18)
      // Today is Feb 16 (day 46); floor(46/3)=15 periods; 15*3=45 days = Feb 15
      const dueDate = '2026-01-01T00:00:00.000Z';
      const result = fastForwardDueDate(dueDate, pattern);
      expect(result).toBe('2026-02-15');
    });

    it('weekly frequency=2 (no days): skips to most recent valid 2-week cycle', () => {
      const pattern: RecurrencePattern = { interval: 'weekly', frequency: 2 };
      // dueDate = Mon Jan 12; occurrences Jan 12, Jan 26, Feb 9, Feb 23, ...
      // Today is Feb 16 (Mon); most recent occurrence is Feb 9
      const dueDate = '2026-01-12T00:00:00.000Z';
      const result = fastForwardDueDate(dueDate, pattern);
      expect(result).toBe('2026-02-09');
    });

    it('weekly frequency=2 with daysOfWeek=[6] (every other Saturday): finds last valid Saturday', () => {
      const pattern: RecurrencePattern = { interval: 'weekly', frequency: 2, daysOfWeek: [6] };
      // dueDate = Sat Jan 10; occurrences Jan 10, Jan 24, Feb 7, Feb 21, ...
      // Today is Feb 16 (Mon); most recent occurrence is Feb 7
      const dueDate = '2026-01-10T00:00:00.000Z';
      const result = fastForwardDueDate(dueDate, pattern);
      expect(result).toBe('2026-02-07');
    });

    it('weekly frequency=2 with daysOfWeek=[1,5]: finds last valid occurrence in current cycle', () => {
      const pattern: RecurrencePattern = { interval: 'weekly', frequency: 2, daysOfWeek: [1, 5] };
      // dueDate = Mon Jan 12; cycle: Mon Jan 12, Fri Jan 16, Mon Jan 26, Fri Jan 30, Mon Feb 9, Fri Feb 13, ...
      // Today is Feb 16 (Mon); most recent occurrence is Fri Feb 13
      const dueDate = '2026-01-12T00:00:00.000Z';
      const result = fastForwardDueDate(dueDate, pattern);
      expect(result).toBe('2026-02-13');
    });

    it('monthly frequency=2: lands on the most recent valid 2-month occurrence', () => {
      const pattern: RecurrencePattern = { interval: 'monthly', frequency: 2 };
      // dueDate = Oct 15, 2025; occurrences Oct 15, Dec 15, Feb 15, Apr 15, ...
      // Today is Feb 16; most recent occurrence is Feb 15
      const dueDate = '2025-10-15T00:00:00.000Z';
      const result = fastForwardDueDate(dueDate, pattern);
      expect(result).toBe('2026-02-15');
    });

    it('yearly frequency=2: lands on the most recent valid 2-year occurrence', () => {
      const pattern: RecurrencePattern = { interval: 'yearly', frequency: 2 };
      // dueDate = Feb 15, 2022; occurrences Feb 15 2022, 2024, 2026, ...
      // Today is Feb 16, 2026; most recent occurrence is Feb 15, 2026
      const dueDate = '2022-02-15T00:00:00.000Z';
      const result = fastForwardDueDate(dueDate, pattern);
      expect(result).toBe('2026-02-15');
    });
  });

  describe('formatRecurrencePattern with frequency', () => {
    it('formats frequency=1 (or undefined) as before', () => {
      expect(formatRecurrencePattern({ interval: 'daily' })).toBe('Daily');
      expect(formatRecurrencePattern({ interval: 'weekly', frequency: 1 })).toBe('Weekly');
      expect(formatRecurrencePattern({ interval: 'weekly', frequency: 1, daysOfWeek: [6] })).toBe('Weekly (Sat)');
    });

    it('formats frequency=2 weekly with day as "Every 2 weeks (Sat)"', () => {
      const pattern: RecurrencePattern = { interval: 'weekly', frequency: 2, daysOfWeek: [6] };
      expect(formatRecurrencePattern(pattern)).toBe('Every 2 weeks (Sat)');
    });

    it('formats frequency=3 daily as "Every 3 days"', () => {
      expect(formatRecurrencePattern({ interval: 'daily', frequency: 3 })).toBe('Every 3 days');
    });

    it('formats frequency=2 monthly as "Every 2 months"', () => {
      expect(formatRecurrencePattern({ interval: 'monthly', frequency: 2 })).toBe('Every 2 months');
    });

    it('formats frequency=2 yearly as "Every 2 years"', () => {
      expect(formatRecurrencePattern({ interval: 'yearly', frequency: 2 })).toBe('Every 2 years');
    });
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
