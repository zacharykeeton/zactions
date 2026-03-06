# CLAUDE.md

## Project Overview

A recursive to-do app built with Next.js 16.1.6, featuring infinite nesting of tasks and drag-and-drop reordering via @dnd-kit.

**Stack:**
- **React 19.2.3** (App Router, client components for interactivity)
- **TypeScript 5** with strict mode
- **Tailwind CSS v4** with PostCSS
- **shadcn/ui** component system (new-york style)
- **@dnd-kit** (core, sortable, utilities) for drag and drop
- **cmdk** for command palette UI
- **date-fns** for date formatting
- **uuid** for ID generation
- **next-themes** for dark/light mode switching
- **sonner** for toast notifications
- **canvas-confetti** for completion celebrations
- **Geist Sans** and **Geist Mono** fonts (next/font)

## Development Commands

```bash
npm run dev      # Dev server at http://localhost:8547
npm run build    # Production build
npm start        # Production server (run after build)
npm run lint     # ESLint
npm test         # Run unit tests (watch mode)
npm run test:run # Run unit tests (single run)
npm run test:ui  # Run unit tests with UI
```

## Testing
- **Vitest** for unit tests (`vitest.config.ts` — globals enabled, node environment)
- Test files live alongside source: `lib/recurrence-utils.test.ts`
- Run tests: `npm run test:run` (single run) or `npm test` (watch mode)

## Project Architecture

### Directory Structure
```
app/
  layout.tsx          — Root layout (fonts, metadata)
  page.tsx            — Main page ("use client"), wires all stores + sidebar + DnD context
  globals.css         — Tailwind v4 config, OKLCH design tokens, dark mode
hooks/
  use-task-store.ts   — Task CRUD + localStorage persistence
  use-tag-store.ts    — Tag definitions CRUD + localStorage (tags support list scoping)
  use-list-store.ts   — Task list CRUD + localStorage
  use-compact-mode.tsx — CompactModeProvider context + useCompactMode() hook
  use-timer.ts        — Time-tracking timer hook
  use-today-sort-order.ts — Sort order for Today/Tomorrow lists (localStorage)
  use-mobile.ts       — Mobile breakpoint detection
  use-timeline-state.ts — Timeline month navigation state (localStorage-persisted)
  use-timeline-drag.ts  — Timeline-specific drag logic (bar + endpoint dragging)
  use-grid-day-width.ts — Responsive day-column width via ResizeObserver
components/
  ui/                 — shadcn/ui components (badge, button, calendar, checkbox, command, dialog, dropdown-menu, input, label, popover, progress, select, separator, sheet, sidebar, skeleton, sonner, tabs, tooltip)
  app-sidebar.tsx     — Sidebar nav: list switching, archived/tags views
  droppable-sidebar-item.tsx — DnD-droppable sidebar list item (drop task → move to list)
  list-form.tsx       — Add/edit task list dialog
  mode-toggle.tsx     — Dark/light mode toggle button
  tag-manager.tsx     — Tag definitions UI (create, edit, delete tags)
  task-tree.tsx       — DndContext + SortableContext wrapper (DnD orchestrator)
  task-item.tsx       — Sortable task row + TaskItemOverlay for drag preview
  task-row-content.tsx — Shared task row rendering (used by task-item + today-task-item)
  compact-mode-settings.tsx — Granular compact mode toggle settings popover
  task-form.tsx       — Add/Edit task dialog (title, priority, dates, tags, list, dependencies, time estimate)
  today-list.tsx      — "Today" view: filters tasks scheduled/due today
  today-task-item.tsx — Task item variant for the Today list
  timeline-view.tsx   — Timeline (Gantt-style) view: renders tasks on a date grid
  timeline-grid.tsx   — Date column grid background for the timeline
  timeline-bar.tsx    — Individual task bar rendered on the timeline
  timeline-sortable-row.tsx — Sortable row wrapper for timeline tasks
  timeline-task-row.tsx     — Single task row in the timeline
  timeline-task-group.tsx   — Grouped task rows in the timeline
  archived-list.tsx   — Archived tasks view
lib/
  types.ts            — Task, FlattenedTask, Tag, TaskList, BackupData, CompletionRecord, CompactModeSettings types
  constants.ts        — All constants: INDENTATION_WIDTH, storage keys, TAG_COLORS, priorityColors, sidebar DnD IDs, timeline layout constants
  ics-utils.ts        — RFC 5545 iCalendar (.ics) file generation and download
  ics-utils.test.ts   — Unit tests for ICS utils
  tree-utils.ts       — Tree algorithms (flatten, build, projection, find, remove, etc.)
  tree-utils.test.ts  — Unit tests for tree utils
  utils.ts            — cn() utility (clsx + tailwind-merge)
  recurrence-utils.ts — Recurring task logic (getNextDueDate, fast-forward)
  recurrence-utils.test.ts — Unit tests for recurrence logic
  backup-utils.ts     — JSON backup export/import logic
  backup-utils.test.ts — Unit tests for backup/restore
  dependency-utils.ts — Task dependency graph logic (dependsOn field)
  dependency-utils.test.ts — Unit tests for dependency utils
  dnd-collision.ts    — Custom collision detection (sidebar-aware: sidebar items take priority)
  dnd-utils.ts        — DnD helper functions (isSidebarDroppableId, getListIdFromDroppableId)
  dnd-utils.test.ts   — Unit tests for DnD utils
  tag-utils.ts        — Tag helper functions
  tag-utils.test.ts   — Unit tests for tag utils
  task-store-utils.ts — Shared task store helper functions
  task-store-utils.test.ts — Unit tests for task store utils
  time-utils.ts       — Time formatting helpers
  time-utils.test.ts  — Unit tests for time utils
  timeline-utils.ts   — Timeline date range and positioning calculations
  timeline-utils.test.ts — Unit tests for timeline utils
  today-sort-utils.ts — Sort utilities for Today view
  today-sort-utils.test.ts — Unit tests for today sort utils
  completion-sound.ts — Audio feedback on task completion
vitest.config.ts      — Vitest test runner config (globals, node env, @ alias)
```

### Task Data Model
```typescript
interface Task {
  id: string;                    // uuid
  title: string;
  completed: boolean;
  priority: "low" | "medium" | "high";
  dueDate: string | null;       // ISO date
  scheduledDate: string | null;  // ISO date
  startDate: string | null;      // ISO date (timeline start)
  completedDate: string | null;  // ISO date, auto-set on toggle
  createdDate: string;           // ISO date
  children: Task[];              // recursive subtasks (infinite nesting)
  recurrence?: RecurrencePattern; // daily | weekly | monthly | yearly (+ daysOfWeek)
  completionHistory?: CompletionRecord[]; // tracks past completions for recurring tasks
  timeInvestedMs: number;        // tracked time spent on task
  timeEstimateMs: number | null; // estimated time to complete
  archived: boolean;             // soft-delete / archive flag
  tags?: string[];               // array of Tag IDs
  listId?: string;               // TaskList ID (undefined = Inbox / all tasks)
  dependsOn?: string[];          // IDs of tasks this task depends on
}

// CompletionRecord — tracks individual completions for recurring tasks/subtasks
interface CompletionRecord {
  scheduledDate: string | null;
  dueDate: string | null;
  completedAt: string;           // ISO date
  timeInvestedMs: number;
}

// Tag: { id, name, color: TagColor, listIds: string[] }
//   listIds=[] means global (all lists); otherwise scoped to specific lists
// TaskList: { id, name, color: TagColor, createdDate }
// CompactModeSettings: 11 boolean toggles (showPriority, showTags, showDueDate, etc.)
// BackupData: { version, exportedAt, tasks, lists, tags, preferences? }
```

**localStorage keys** (all in `constants.ts`):
- `"recursive-todo-tasks"` — tasks
- `"recursive-todo-tags"` — tags
- `"recursive-todo-lists"` — lists
- `"compact-mode-enabled"` / `"compact-mode-settings"` — compact mode
- `"today-sort-order"` — Today/Tomorrow custom sort
- `"timeline-month"` — timeline current month
- `"timeline-label-width"` — resizable label column width
- `"today-section-*"` / `"tomorrow-section-*"` — collapsible section states
- `"collapsed-tasks"` — collapsed task IDs (shared across views)

### Drag-and-Drop Architecture (@dnd-kit)

The app uses a **flat-list pattern** for tree DnD — the canonical nested `Task[]` is flattened into `FlattenedTask[]` (with `depth` and `parentId`) for a single `SortableContext`. This is required because @dnd-kit's sortable doesn't natively support nested contexts for cross-level drag.

**Core flow:**
1. `flattenTree(tasks)` → flat array with depth/parentId metadata
2. Single `SortableContext` renders all items with indentation via `paddingLeft: depth * 32px`
3. During drag: `getProjection()` uses horizontal offset (`delta.x`) to compute target depth/parentId
4. On drop: `arrayMove()` reorders the flat array, then `buildTree()` reconstructs the nested tree

**Key conventions:**
- `PointerSensor` with `distance: 8` activation constraint (prevents accidental drag on click)
- `MeasuringStrategy.Always` for accurate position tracking during tree restructuring
- Drag handle via `setActivatorNodeRef` (only the grip icon initiates drag, not the whole row)
- `TaskItemOverlay` renders the drag preview with child count badge

**Important files for DnD changes:**
- [lib/tree-utils.ts](lib/tree-utils.ts) — `getProjection()` is the key algorithm: clamps depth between `maxDepth` (predecessor depth + 1) and `minDepth` (successor depth), then walks backwards to find parentId
- [lib/dnd-collision.ts](lib/dnd-collision.ts) — `sidebarAwareCollision`: sidebar droppables win over task items so dragging a task over the sidebar reliably reassigns its list
- [components/task-tree.tsx](components/task-tree.tsx) — Manages drag state (`activeId`, `overId`, `offsetLeft`) and orchestrates the flatten → project → rebuild cycle
- [components/task-item.tsx](components/task-item.tsx) — `useSortable()` hook, transform/transition styles, depth-based indentation

### App Views & Navigation

The sidebar (`AppSidebar`) controls what is shown in the main content area:
- **Inbox / named lists** — filters tasks by `listId`; drag a task onto a sidebar list item to reassign it
- **Today** — three-section view (recurring, scheduled, optional) with parent-child hierarchy
- **Tomorrow** — same three-section structure as Today
- **Timeline** — Gantt-style month view with drag-to-reschedule
- **Archived** — soft-deleted tasks
- **Tags** — tag management (`TagManager` component)

`SidebarView` state in `page.tsx`: `"tasks" | "archived" | "tags"`
`ActiveListFilter` (from `app-sidebar.tsx`): `"all" | "inbox" | string` (string = specific list ID)

### Today/Tomorrow View Architecture

The Today/Tomorrow views (`today-list.tsx`) use a three-section hierarchy-preserving filter system:

1. **Recurring section** — `getRecurringTasksForTodayWithChildren()` returns recurring tasks with full child trees, plus `excludeIds: Set<string>` to prevent duplication
2. **Scheduled section** — `getTasksForTodayWithChildren(tasks, today, excludeIds)` returns non-recurring tasks due/scheduled today, excluding anything claimed by recurring section
3. **Optional section** — `getOptionalTasksForTodayWithChildren()` returns tasks that are available (`startDate <= today`) but not explicitly due/scheduled today

**Key patterns:**
- `claimedIds` / `excludeIds` sets prevent a task from appearing in multiple sections
- `filterCollapsed()` removes descendants of collapsed tasks from the render list
- `sortTodayTasks(tasks, sortOrder)` applies user-dragged sort order, with new tasks appearing at the bottom sorted by priority
- Progress tracking via `getTodayProgress()` — counts completed vs total using `wasCompletedForToday()` which is recurrence-aware
- Section collapse states persisted to localStorage (`today-section-*` keys)

### Timeline View Architecture

The timeline (`timeline-view.tsx` + `timeline-grid.tsx`) renders tasks on a month-based Gantt grid:
- **Navigation:** `useTimelineState()` manages current month (localStorage-persisted)
- **Grid:** `useGridDayWidth()` calculates pixels-per-day via ResizeObserver
- **Drag types** (`DragType`): `"bar"` | `"start-endpoint"` | `"end-endpoint"` | `"scheduled-endpoint"`
- **Drag hook:** `useTimelineDrag()` uses ref-based closures for document event listeners, snaps to whole-day increments
- **Constraints:** Start can't pass end, end can't pass start; bar drag shifts all three dates together
- **Resizable label column:** Width persisted to localStorage (`timeline-label-width`)
- **Layout constants** (in `constants.ts`): `TIMELINE_DAY_MIN_WIDTH=32`, `TIMELINE_ROW_HEIGHT=36`, `TIMELINE_BAR_HEIGHT=20`

### Task Blocking & Dependencies

Tasks can depend on other tasks via `dependsOn: string[]`:
- `getBlockingTask(tasks, task)` from `dependency-utils.ts` finds the first incomplete blocker
- `isTaskBlocked()` checks if any dependency is unmet
- Blocked tasks show a lock icon (orange) with tooltip, and cannot be toggled complete
- Tasks with `startDate` in the future also show a lock icon ("Not Started")
- `removeDependencyRef()` in `task-store-utils.ts` cascades deletion when a task is removed

### Compact Mode System

Compact mode uses React Context (`CompactModeProvider` in `use-compact-mode.tsx`):
- Global toggle: `compactMode: boolean`
- Granular settings: `CompactModeSettings` with 11 boolean flags (showPriority, showTags, showDueDate, etc.)
- Components use: `const { compactMode, settings } = useCompactMode(); const show = (key) => !compactMode || settings[key];`
- Settings merge with defaults on load for forward compatibility when new fields are added

### Recurring Task Lifecycle

When a recurring task is toggled complete:
1. Task is immediately reset to `completed: false`
2. Due date advances to next occurrence via `getNextDueDate()`
3. Children's dates shift by the same delta via `shiftDatesDeep()`
4. Completion recorded in `completionHistory` as `CompletionRecord`
5. Children reset to incomplete via `resetChildrenDeep()` (with fallback records to preserve first-cycle data)

**Skip logic** (`skipTodayTask`): For recurring tasks, skips to the next valid recurrence date (not just tomorrow). E.g., a weekday-only task on Friday skips to Monday.

**Fast-forward** (`fastForwardTask`): Advances a past-due recurring task's date to today or the nearest valid future occurrence.

### State Management

State is split across four hooks in `hooks/`:
- `useTaskStore` ([hooks/use-task-store.ts](hooks/use-task-store.ts)) — Task CRUD + localStorage; functions: `addTask`, `updateTask`, `deleteTask`, `toggleTask`, `reorderTasks`, `restoreTasks`, `archiveTask`, `unarchiveTask`, `fastForwardTask`, `skipTodayTask`
- `useTagStore` ([hooks/use-tag-store.ts](hooks/use-tag-store.ts)) — Tag definitions CRUD; functions: `addTag`, `updateTag`, `deleteTag`, `removeListFromTags`, `restoreTags`
- `useListStore` ([hooks/use-list-store.ts](hooks/use-list-store.ts)) — Task list CRUD; functions: `addList`, `updateList`, `deleteList`, `restoreLists`
- `useCompactMode` ([hooks/use-compact-mode.tsx](hooks/use-compact-mode.tsx)) — Context-based global compact mode state; provides `compactMode` toggle + granular `CompactModeSettings`

**Hydration pattern:** All hooks use a `useRef(true)` flag to skip localStorage persistence on initial mount. The task store specifically loads via `useEffect` (not lazy initializer) because lazy initializers cause SSR hydration mismatches (server returns `[]`, client would return stored data). Deep immutable tree updates via recursive `map()`.

**Task migration:** On load, `migrateTask()` from `task-store-utils.ts` upgrades legacy data (e.g., `completionHistory: string[]` → `CompletionRecord[]`, backfills missing fields like `startDate`, `timeInvestedMs`).

### Styling System
- **Tailwind CSS v4** (PostCSS plugin-based, no traditional config file)
- **shadcn/ui** components: `@import "shadcn/tailwind.css"` in globals.css
- Dark mode: `@custom-variant dark (&:is(.dark *))`
- Design tokens in OKLCH color space as CSS variables
- `cn()` in [lib/utils.ts](lib/utils.ts) for conditional classes

### TypeScript Configuration
- Path alias: `@/*` maps to project root
- JSX mode: `react-jsx` (no React import needed)
- Target: ES2017, strict mode enabled

## Important Patterns

### Component Conventions
- Interactive components use `"use client"` directive
- `cn()` from `@/lib/utils` for conditional styling
- Icons from `lucide-react`
- Action buttons revealed on hover: `opacity-0 group-hover:opacity-100`
- Priority colors defined as a map: low=emerald, medium=amber, high=red
- Compact mode checks: `const show = (key) => !compactMode || settings[key]` before rendering optional badges

### Date Handling
- All dates stored as `YYYY-MM-DD` strings (ISO date part only, no time component)
- All date arithmetic uses UTC midnights: `new Date(dateStr + "T00:00:00Z")` to avoid timezone drift
- `daysBetweenDates()`, `shiftDate()`, `shiftDatesDeep()` in `task-store-utils.ts` for date math
- `formatUTCDate(date)` for Date → `YYYY-MM-DD` conversion (avoids `toISOString()` which includes time)

### ESLint: Lazy Initializers vs Hydration
The `react-hooks/set-state-in-effect` rule prefers lazy initializers. However, for SSR-hydrated stores (task/tag/list stores), loading happens in `useEffect` to avoid hydration mismatches (server returns `[]`, lazy initializer would return stored data). Use lazy initializers for non-SSR state (compact mode settings, sort orders, etc.).

### Utility Extraction Pattern
Heavy logic is extracted from hooks into `*-utils.ts` files (e.g., `task-store-utils.ts` handles migration, date shifting, archival cascading, merge after reorder). Keep hooks focused on state + callbacks; put algorithms in utils.

### Tree Update Pattern
All tree mutations use recursive `map()` — never mutate in place. When updating a task deep in the tree:
```typescript
const updateDeep = (items: Task[]): Task[] =>
  items.map(item => item.id === id
    ? { ...item, ...updates }
    : { ...item, children: updateDeep(item.children) }
  );
```

### Filtered View Reordering
When reordering tasks in a filtered view (Today/Tomorrow), `mergeReorderedTasks()` reconstructs the full tree by collecting archived tasks and other-list tasks from the original, then reinserting them at their original positions. This prevents data loss when the user only sees a subset.

### Import Paths
- Use `@/` prefix for absolute imports (e.g., `import { cn } from "@/lib/utils"`)
- shadcn/ui: `@/components/ui/[component]`
- Custom components: `@/components/[component]`
- Hooks: `@/hooks/[hook-name]`

## Auto-Memory
Proactively update `~/.claude/projects/.../memory/MEMORY.md` when you discover something worth remembering across sessions — gotchas, debugging insights, user preferences, or patterns not already in this file. Don't duplicate what's in CLAUDE.md; only record new learnings.
