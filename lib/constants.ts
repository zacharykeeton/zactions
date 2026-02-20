export const INDENTATION_WIDTH = 32;
export const LOCAL_STORAGE_KEY = "recursive-todo-tasks";
export const TODAY_SORT_ORDER_KEY = "today-sort-order";
export const TOMORROW_SORT_ORDER_KEY = "tomorrow-sort-order";

export const TODAY_RECURRING_SECTION_KEY = "today-section-recurring-open";
export const TODAY_NON_RECURRING_SECTION_KEY = "today-section-nonrecurring-open";
export const TOMORROW_RECURRING_SECTION_KEY = "tomorrow-section-recurring-open";
export const TOMORROW_NON_RECURRING_SECTION_KEY = "tomorrow-section-nonrecurring-open";
export const COLLAPSED_TASKS_KEY = "collapsed-task-ids";
export const TAGS_STORAGE_KEY = "recursive-todo-tags";

export const TAG_COLORS: Record<string, { badge: string; dot: string }> = {
  red: {
    badge: "border-red-400 text-red-700 dark:border-red-600 dark:text-red-400",
    dot: "bg-red-500",
  },
  blue: {
    badge: "border-blue-400 text-blue-700 dark:border-blue-600 dark:text-blue-400",
    dot: "bg-blue-500",
  },
  green: {
    badge: "border-green-400 text-green-700 dark:border-green-600 dark:text-green-400",
    dot: "bg-green-500",
  },
  amber: {
    badge: "border-amber-400 text-amber-700 dark:border-amber-600 dark:text-amber-400",
    dot: "bg-amber-500",
  },
  purple: {
    badge: "border-purple-400 text-purple-700 dark:border-purple-600 dark:text-purple-400",
    dot: "bg-purple-500",
  },
  pink: {
    badge: "border-pink-400 text-pink-700 dark:border-pink-600 dark:text-pink-400",
    dot: "bg-pink-500",
  },
  cyan: {
    badge: "border-cyan-400 text-cyan-700 dark:border-cyan-600 dark:text-cyan-400",
    dot: "bg-cyan-500",
  },
  slate: {
    badge: "border-slate-400 text-slate-700 dark:border-slate-600 dark:text-slate-400",
    dot: "bg-slate-500",
  },
};

export const priorityColors: Record<string, string> = {
  low: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
  medium:
    "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
  high: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
};
