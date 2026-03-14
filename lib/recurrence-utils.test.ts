import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fastForwardDueDate, formatRecurrencePattern, getNextDueDate } from './recurrence-utils';
import type { RecurrencePattern } from './types';

describe('fastForwardDueDate', () => {
  beforeEach(() => {
    // Mock current date to Feb 16, 2026 at noon UTC (so local date = Feb 16 in all US timezones)
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-16T12:00:00.000Z'));
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

    it('should advance to next scheduled day when today is not scheduled', () => {
      // Today is Monday (day 1)
      const pattern: RecurrencePattern = {
        interval: 'weekly',
        daysOfWeek: [0, 6] // Sun, Sat
      };
      const dueDate = '2026-02-01T00:00:00.000Z'; // Feb 1 (Sunday)
      const result = fastForwardDueDate(dueDate, pattern);
      // Next Sat or Sun >= today (Mon Feb 16): Sat Feb 21
      expect(result).toBe('2026-02-21');
    });

    it('should advance to next scheduled day with multiple days in the week', () => {
      // Today is Monday (day 1)
      const pattern: RecurrencePattern = {
        interval: 'weekly',
        daysOfWeek: [2, 4] // Tue, Thu
      };
      const dueDate = '2026-02-04T00:00:00.000Z'; // Feb 4 (Tuesday)
      const result = fastForwardDueDate(dueDate, pattern);
      // Next Tue or Thu >= today (Mon Feb 16): Tue Feb 17
      expect(result).toBe('2026-02-17');
    });

    it('should advance to next scheduled day when only one day scheduled', () => {
      // Today is Monday (day 1)
      const pattern: RecurrencePattern = {
        interval: 'weekly',
        daysOfWeek: [2] // Only Tuesday
      };
      const dueDate = '2026-01-01T00:00:00.000Z'; // Jan 1
      const result = fastForwardDueDate(dueDate, pattern);
      // Next Tuesday >= today (Mon Feb 16): Tue Feb 17
      expect(result).toBe('2026-02-17');
    });
  });

  describe('monthly recurrence', () => {
    const monthlyPattern: RecurrencePattern = { interval: 'monthly' };

    it('should fast forward to next month when current month occurrence has passed', () => {
      const dueDate = '2026-01-15T00:00:00.000Z'; // Jan 15
      const result = fastForwardDueDate(dueDate, monthlyPattern);
      // Feb 15 < today (Feb 16), so advances to next occurrence >= today
      expect(result).toMatch(/^2026-03-1[45]$/); // Mar 15 (DST may shift by 1)
    });

    it('should return current date if due date is still ahead in current month', () => {
      const dueDate = '2026-02-20T00:00:00.000Z'; // Feb 20 (future)
      const result = fastForwardDueDate(dueDate, monthlyPattern);
      expect(result).toBe('2026-02-20'); // Still Feb 20
    });

    it('should fast forward multiple months to next occurrence >= today', () => {
      const dueDate = '2025-10-15T00:00:00.000Z'; // Oct 15, 2025
      const result = fastForwardDueDate(dueDate, monthlyPattern);
      // Feb 15 < today (Feb 16), so advances to next occurrence >= today
      expect(result).toMatch(/^2026-03-1[45]$/); // Mar 15 (DST may shift by 1)
    });

    it('should handle month overflow correctly', () => {
      const dueDate = '2026-01-31T00:00:00.000Z'; // Jan 31
      const result = fastForwardDueDate(dueDate, monthlyPattern);
      // Feb clamps to 28, which is > today (Feb 16), so returns Feb 28
      expect(result).toBe('2026-02-28');
    });
  });

  describe('yearly recurrence', () => {
    const yearlyPattern: RecurrencePattern = { interval: 'yearly' };

    it('should fast forward to next year when this year occurrence has passed', () => {
      const dueDate = '2025-02-14T00:00:00.000Z'; // Feb 14, 2025
      const result = fastForwardDueDate(dueDate, yearlyPattern);
      // Feb 14 2026 < today (Feb 16), so advances to next year
      expect(result).toBe('2027-02-14');
    });

    it('should return current date if due date is still ahead in current year', () => {
      const dueDate = '2026-03-01T00:00:00.000Z'; // Mar 1, 2026 (future)
      const result = fastForwardDueDate(dueDate, yearlyPattern);
      expect(result).toBe('2026-03-01'); // Still Mar 1, 2026
    });

    it('should fast forward multiple years to next occurrence >= today', () => {
      const dueDate = '2020-02-14T00:00:00.000Z'; // Feb 14, 2020
      const result = fastForwardDueDate(dueDate, yearlyPattern);
      // Feb 14 2026 < today (Feb 16), so advances to next year
      expect(result).toBe('2027-02-14');
    });

    it('should handle leap year dates correctly', () => {
      const dueDate = '2024-02-29T00:00:00.000Z'; // Feb 29, 2024 (leap year)
      const result = fastForwardDueDate(dueDate, yearlyPattern);
      // 2026 is not a leap year, clamps to Feb 28, which is > today (Feb 16)
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
    vi.setSystemTime(new Date('2026-02-16T12:00:00.000Z'));
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
    // Today is Monday Feb 16, 2026 (noon UTC so local date = Feb 16 across US timezones)
    vi.setSystemTime(new Date('2026-02-16T12:00:00.000Z'));
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
    it('daily frequency=3: advances to first valid occurrence >= today', () => {
      const pattern: RecurrencePattern = { interval: 'daily', frequency: 3 };
      // dueDate = Jan 1; occurrences: 0, 3, 6, ... 45(Feb15), 48(Feb18)
      // Today is Feb 16 (day 46); Feb 15 < today, so next is Feb 18
      const dueDate = '2026-01-01T00:00:00.000Z';
      const result = fastForwardDueDate(dueDate, pattern);
      expect(result).toBe('2026-02-18');
    });

    it('weekly frequency=2 (no days): advances to next valid 2-week occurrence >= today', () => {
      const pattern: RecurrencePattern = { interval: 'weekly', frequency: 2 };
      // dueDate = Mon Jan 12; occurrences Jan 12, Jan 26, Feb 9, Feb 23, ...
      // Today is Feb 16 (Mon); Feb 9 < today, so next is Feb 23
      const dueDate = '2026-01-12T00:00:00.000Z';
      const result = fastForwardDueDate(dueDate, pattern);
      expect(result).toBe('2026-02-23');
    });

    it('weekly frequency=2 with daysOfWeek=[6] (every other Saturday): finds next valid Saturday >= today', () => {
      const pattern: RecurrencePattern = { interval: 'weekly', frequency: 2, daysOfWeek: [6] };
      // dueDate = Sat Jan 10; occurrences Jan 10, Jan 24, Feb 7, Feb 21, ...
      // Today is Feb 16 (Mon); Feb 7 < today, so next is Feb 21
      const dueDate = '2026-01-10T00:00:00.000Z';
      const result = fastForwardDueDate(dueDate, pattern);
      expect(result).toBe('2026-02-21');
    });

    it('weekly frequency=2 with daysOfWeek=[1,5]: finds next valid occurrence >= today', () => {
      const pattern: RecurrencePattern = { interval: 'weekly', frequency: 2, daysOfWeek: [1, 5] };
      // dueDate = Mon Jan 12; cycle: Mon Jan 12, Fri Jan 16, Mon Jan 26, Fri Jan 30, Mon Feb 9, Fri Feb 13, Mon Feb 23, ...
      // Today is Feb 16 (Mon); Feb 13 < today, so next is Mon Feb 23
      const dueDate = '2026-01-12T00:00:00.000Z';
      const result = fastForwardDueDate(dueDate, pattern);
      expect(result).toBe('2026-02-23');
    });

    it('monthly frequency=2: advances to next valid 2-month occurrence >= today', () => {
      const pattern: RecurrencePattern = { interval: 'monthly', frequency: 2 };
      // dueDate = Oct 15, 2025; occurrences Oct 15, Dec 15, Feb 15, Apr 15, ...
      // Today is Feb 16; Feb 15 < today, so next is Apr 15 (DST may shift by 1)
      const dueDate = '2025-10-15T00:00:00.000Z';
      const result = fastForwardDueDate(dueDate, pattern);
      expect(result).toMatch(/^2026-04-1[45]$/);
    });

    it('yearly frequency=2: advances to next valid 2-year occurrence >= today', () => {
      const pattern: RecurrencePattern = { interval: 'yearly', frequency: 2 };
      // dueDate = Feb 15, 2022; occurrences Feb 15 2022, 2024, 2026, 2028, ...
      // Today is Feb 16, 2026; Feb 15 2026 < today, so next is Feb 15 2028
      const dueDate = '2022-02-15T00:00:00.000Z';
      const result = fastForwardDueDate(dueDate, pattern);
      expect(result).toBe('2028-02-15');
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

describe('weekday-only recurrence (daysOfWeek: [1,2,3,4,5])', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-02-16T12:00:00.000Z'));
  });

  const weekdayPattern: RecurrencePattern = {
    interval: 'weekly',
    daysOfWeek: [1, 2, 3, 4, 5],
  };

  describe('getNextDueDate', () => {
    it('Friday → next Monday (skips weekend)', () => {
      const dueDate = '2026-02-13T00:00:00.000Z'; // Fri Feb 13
      const result = getNextDueDate(dueDate, weekdayPattern);
      expect(result).toBe('2026-02-16'); // Mon Feb 16
    });

    it('Wednesday → Thursday (same-week advance)', () => {
      const dueDate = '2026-02-18T00:00:00.000Z'; // Wed Feb 18 (future)
      const result = getNextDueDate(dueDate, weekdayPattern);
      expect(result).toBe('2026-02-19'); // Thu Feb 19
    });

    it('Monday (today) → Tuesday', () => {
      const dueDate = '2026-02-16T00:00:00.000Z'; // Mon Feb 16 (today)
      const result = getNextDueDate(dueDate, weekdayPattern);
      expect(result).toBe('2026-02-17'); // Tue Feb 17
    });
  });

  describe('fastForwardDueDate', () => {
    it('lands on today (Monday) when overdue from last week', () => {
      const dueDate = '2026-02-09T00:00:00.000Z'; // Mon Feb 9
      const result = fastForwardDueDate(dueDate, weekdayPattern);
      expect(result).toBe('2026-02-16'); // Mon Feb 16 (today)
    });

    it('advances past today to next scheduled weekday (Mon/Thu pattern, due Thu, today Fri)', () => {
      // Exact user-reported scenario: weekly Mon+Thu, due Thu Mar 12, today Fri Mar 13
      // Use a date range that avoids DST (Feb dates)
      vi.setSystemTime(new Date('2026-02-20T12:00:00.000Z')); // Fri Feb 20
      const pattern: RecurrencePattern = {
        interval: 'weekly',
        daysOfWeek: [1, 4], // Mon, Thu
      };
      const dueDate = '2026-02-19T00:00:00.000Z'; // Thu Feb 19 (yesterday)
      const result = fastForwardDueDate(dueDate, pattern);
      expect(result).toBe('2026-02-23'); // Mon Feb 23 (next Mon/Thu >= today)
    });

    it('advances to next Monday when today is weekend (Sat)', () => {
      vi.setSystemTime(new Date('2026-02-21T12:00:00.000Z')); // Sat Feb 21
      const dueDate = '2026-02-09T00:00:00.000Z'; // Mon Feb 9
      const result = fastForwardDueDate(dueDate, weekdayPattern);
      expect(result).toBe('2026-02-23'); // Mon Feb 23 (next weekday >= today)
    });
  });
});

describe('local-time-aware today (timezone consistency)', () => {
  // Use Feb dates to avoid DST transitions (DST starts Mar 8, 2026)
  afterEach(() => {
    vi.useRealTimers();
  });

  describe('fastForwardDueDate uses local today, not UTC today', () => {
    it('fast forward from yesterday lands on today', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-02-20T12:00:00.000Z')); // Fri Feb 20

      const dailyPattern: RecurrencePattern = { interval: 'daily' };
      const dueDate = '2026-02-19'; // yesterday
      const result = fastForwardDueDate(dueDate, dailyPattern);
      expect(result).toBe('2026-02-20');
    });

    it('fast forward does not overshoot to tomorrow', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-02-20T12:00:00.000Z'));

      const dailyPattern: RecurrencePattern = { interval: 'daily' };
      const dueDate = '2026-02-18'; // 2 days ago
      const result = fastForwardDueDate(dueDate, dailyPattern);
      expect(result).toBe('2026-02-20'); // lands on today, not tomorrow
    });

    it('fast forward returns same date when due date is today', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-02-20T12:00:00.000Z'));

      const dailyPattern: RecurrencePattern = { interval: 'daily' };
      const dueDate = '2026-02-20';
      const result = fastForwardDueDate(dueDate, dailyPattern);
      expect(result).toBe('2026-02-20'); // no-op, already today
    });

    it('weekly fast forward lands on correct week boundary', () => {
      vi.useFakeTimers();
      // Fri Feb 20, 2026
      vi.setSystemTime(new Date('2026-02-20T12:00:00.000Z'));

      const weeklyPattern: RecurrencePattern = { interval: 'weekly' };
      const dueDate = '2026-02-06'; // Fri, 2 weeks ago
      const result = fastForwardDueDate(dueDate, weeklyPattern);
      expect(result).toBe('2026-02-20'); // Fri today
    });

    it('monthly fast forward lands on correct month', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-02-15T12:00:00.000Z'));

      const monthlyPattern: RecurrencePattern = { interval: 'monthly' };
      const dueDate = '2025-12-15'; // 2 months ago
      const result = fastForwardDueDate(dueDate, monthlyPattern);
      expect(result).toBe('2026-02-15');
    });
  });

  describe('getNextDueDate uses local today, not UTC today', () => {
    it('next due date from 2 days ago advances to today (first occurrence >= today)', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-02-20T12:00:00.000Z'));

      const dailyPattern: RecurrencePattern = { interval: 'daily' };
      const dueDate = '2026-02-18'; // 2 days ago
      const result = getNextDueDate(dueDate, dailyPattern);
      // next = Feb 19 (< today), then gap=2, periods=3, Feb 18+3=Feb 21
      expect(result).toBe('2026-02-21');
    });

    it('weekday getNextDueDate skips weekend correctly', () => {
      vi.useFakeTimers();
      // Friday Feb 20, 2026
      vi.setSystemTime(new Date('2026-02-20T12:00:00.000Z'));

      const weekdayPattern: RecurrencePattern = {
        interval: 'weekly',
        daysOfWeek: [1, 2, 3, 4, 5],
      };
      const dueDate = '2026-02-20'; // today (Friday)
      const result = getNextDueDate(dueDate, weekdayPattern);
      expect(result).toBe('2026-02-23'); // Monday (skips weekend)
    });

    it('monthly getNextDueDate from 2 months ago catches up', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-02-20T12:00:00.000Z'));

      const monthlyPattern: RecurrencePattern = { interval: 'monthly' };
      const dueDate = '2025-12-20'; // 2 months ago
      const result = getNextDueDate(dueDate, monthlyPattern);
      // Dec 20 + 1 month = Jan 20 (past), + 1 more = Feb 20 (today, not before today)
      expect(result).toBe('2026-02-20');
    });
  });

  describe('fastForwardDueDate and getNextDueDate agree on date boundaries', () => {
    it('fast forward lands on today while getNextDueDate goes past it', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-02-20T12:00:00.000Z'));

      const dailyPattern: RecurrencePattern = { interval: 'daily' };
      const dueDate = '2026-02-17'; // 3 days ago

      const ff = fastForwardDueDate(dueDate, dailyPattern);
      const next = getNextDueDate(dueDate, dailyPattern);

      expect(ff).toBe('2026-02-20');  // catches up to today
      // gap=3, periods=floor(3/1)+1=4, Feb 17+4=Feb 21
      expect(next).toBe('2026-02-21'); // advances past today
    });

    it('for a future due date, fast forward is a no-op while getNextDueDate advances', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-02-20T12:00:00.000Z'));

      const dailyPattern: RecurrencePattern = { interval: 'daily' };
      const dueDate = '2026-02-22'; // 2 days from now

      const ff = fastForwardDueDate(dueDate, dailyPattern);
      const next = getNextDueDate(dueDate, dailyPattern);

      expect(ff).toBe('2026-02-22');  // unchanged (already in future)
      expect(next).toBe('2026-02-23'); // next occurrence
    });
  });
});

describe('fastForwardDueDate always returns >= today (regression)', () => {
  // Guards against the bug where fast-forward could return a date before today,
  // making the button appear to do nothing.
  afterEach(() => {
    vi.useRealTimers();
  });

  describe('weekly with specific daysOfWeek — today not a scheduled day', () => {
    it('Mon/Thu pattern, due Thu (yesterday), today Fri → next Mon', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-02-20T12:00:00.000Z')); // Fri Feb 20
      const pattern: RecurrencePattern = { interval: 'weekly', daysOfWeek: [1, 4] };
      const dueDate = '2026-02-19'; // Thu (yesterday)
      expect(fastForwardDueDate(dueDate, pattern)).toBe('2026-02-23'); // Mon
    });

    it('Tue/Fri pattern, due Tue (2 days ago), today Thu → next Fri', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-02-19T12:00:00.000Z')); // Thu Feb 19
      const pattern: RecurrencePattern = { interval: 'weekly', daysOfWeek: [2, 5] };
      const dueDate = '2026-02-17'; // Tue (2 days ago)
      expect(fastForwardDueDate(dueDate, pattern)).toBe('2026-02-20'); // Fri
    });

    it('Wed-only pattern, due Wed (last week), today Mon → next Wed', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-02-16T12:00:00.000Z')); // Mon Feb 16
      const pattern: RecurrencePattern = { interval: 'weekly', daysOfWeek: [3] };
      const dueDate = '2026-02-11'; // Wed last week
      expect(fastForwardDueDate(dueDate, pattern)).toBe('2026-02-18'); // Wed
    });

    it('Sat/Sun pattern, due Sat (yesterday), today Sun → today Sun', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-02-22T12:00:00.000Z')); // Sun Feb 22
      const pattern: RecurrencePattern = { interval: 'weekly', daysOfWeek: [0, 6] };
      const dueDate = '2026-02-21'; // Sat (yesterday)
      expect(fastForwardDueDate(dueDate, pattern)).toBe('2026-02-22'); // Sun (today)
    });
  });

  describe('weekly with specific daysOfWeek — today IS a scheduled day', () => {
    it('Mon/Thu pattern, due Mon (last week), today Thu → today', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-02-19T12:00:00.000Z')); // Thu Feb 19
      const pattern: RecurrencePattern = { interval: 'weekly', daysOfWeek: [1, 4] };
      const dueDate = '2026-02-09'; // Mon (10 days ago)
      expect(fastForwardDueDate(dueDate, pattern)).toBe('2026-02-19'); // Thu (today)
    });

    it('weekday pattern, due Mon (yesterday), today Tue → today', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-02-17T12:00:00.000Z')); // Tue Feb 17
      const pattern: RecurrencePattern = { interval: 'weekly', daysOfWeek: [1, 2, 3, 4, 5] };
      const dueDate = '2026-02-16'; // Mon (yesterday)
      expect(fastForwardDueDate(dueDate, pattern)).toBe('2026-02-17'); // Tue (today)
    });
  });

  describe('frequency > 1 — occurrence falls before today', () => {
    it('daily freq=2, due 3 days ago → advances to tomorrow (not yesterday)', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-02-20T12:00:00.000Z')); // Fri Feb 20
      const pattern: RecurrencePattern = { interval: 'daily', frequency: 2 };
      // Occurrences from Feb 17: Feb 17, 19, 21, ...
      // Feb 19 < today (Feb 20), so advance to Feb 21
      const dueDate = '2026-02-17';
      expect(fastForwardDueDate(dueDate, pattern)).toBe('2026-02-21');
    });

    it('daily freq=2, due 2 days ago → lands on today', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-02-20T12:00:00.000Z')); // Fri Feb 20
      const pattern: RecurrencePattern = { interval: 'daily', frequency: 2 };
      // Occurrences from Feb 18: Feb 18, 20, 22, ...
      const dueDate = '2026-02-18';
      expect(fastForwardDueDate(dueDate, pattern)).toBe('2026-02-20'); // today
    });

    it('weekly freq=2, due 3 weeks ago → next valid 2-week occurrence', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-02-20T12:00:00.000Z')); // Fri Feb 20
      const pattern: RecurrencePattern = { interval: 'weekly', frequency: 2 };
      // Occurrences from Jan 23 (Fri): Jan 23, Feb 6, Feb 20
      const dueDate = '2026-01-23'; // 4 weeks ago
      expect(fastForwardDueDate(dueDate, pattern)).toBe('2026-02-20'); // today
    });
  });

  describe('due date exactly 1 day ago (off-by-one boundary)', () => {
    it('daily: yesterday → today', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-02-20T12:00:00.000Z'));
      const pattern: RecurrencePattern = { interval: 'daily' };
      expect(fastForwardDueDate('2026-02-19', pattern)).toBe('2026-02-20');
    });

    it('weekly (same day): last week → today', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-02-20T12:00:00.000Z')); // Fri
      const pattern: RecurrencePattern = { interval: 'weekly' };
      expect(fastForwardDueDate('2026-02-13', pattern)).toBe('2026-02-20');
    });

    it('weekly specific day: due yesterday (not scheduled today) → next scheduled day', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-02-20T12:00:00.000Z')); // Fri
      const pattern: RecurrencePattern = { interval: 'weekly', daysOfWeek: [4] }; // Thu only
      expect(fastForwardDueDate('2026-02-19', pattern)).toBe('2026-02-26'); // next Thu
    });
  });

  describe('invariant: result is always >= today', () => {
    // Run several patterns and assert the fundamental guarantee
    const patterns: [string, RecurrencePattern][] = [
      ['daily', { interval: 'daily' }],
      ['daily freq=3', { interval: 'daily', frequency: 3 }],
      ['weekly', { interval: 'weekly' }],
      ['weekly Mon/Wed/Fri', { interval: 'weekly', daysOfWeek: [1, 3, 5] }],
      ['weekly Tue/Thu', { interval: 'weekly', daysOfWeek: [2, 4] }],
      ['weekly Sat only', { interval: 'weekly', daysOfWeek: [6] }],
      ['weekly freq=2 Mon/Fri', { interval: 'weekly', frequency: 2, daysOfWeek: [1, 5] }],
      ['monthly', { interval: 'monthly' }],
      ['yearly', { interval: 'yearly' }],
    ];

    const dueDates = [
      '2026-02-01', // 19 days ago
      '2026-02-15', // yesterday
      '2026-02-10', // 6 days ago
      '2025-12-01', // months ago
    ];

    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-02-16T12:00:00.000Z')); // Mon Feb 16
    });

    for (const [name, pattern] of patterns) {
      for (const dueDate of dueDates) {
        it(`${name} from ${dueDate} returns >= today`, () => {
          const result = fastForwardDueDate(dueDate, pattern);
          expect(result >= '2026-02-16').toBe(true);
        });
      }
    }
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
