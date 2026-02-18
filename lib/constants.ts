export const INDENTATION_WIDTH = 32;
export const LOCAL_STORAGE_KEY = "recursive-todo-tasks";
export const TODAY_SORT_ORDER_KEY = "today-sort-order";
export const TOMORROW_SORT_ORDER_KEY = "tomorrow-sort-order";

export const TODAY_RECURRING_SECTION_KEY = "today-section-recurring-open";
export const TODAY_NON_RECURRING_SECTION_KEY = "today-section-nonrecurring-open";
export const TOMORROW_RECURRING_SECTION_KEY = "tomorrow-section-recurring-open";
export const TOMORROW_NON_RECURRING_SECTION_KEY = "tomorrow-section-nonrecurring-open";
export const COLLAPSED_TASKS_KEY = "collapsed-task-ids";

export const priorityColors: Record<string, string> = {
  low: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
  medium:
    "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
  high: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
};
