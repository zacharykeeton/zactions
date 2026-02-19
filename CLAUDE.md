# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A recursive to-do app built with Next.js 16.1.6, featuring infinite nesting of tasks and drag-and-drop reordering via @dnd-kit.

**Stack:**
- **React 19.2.3** (App Router, client components for interactivity)
- **TypeScript 5** with strict mode
- **Tailwind CSS v4** with PostCSS
- **shadcn/ui** component system (new-york style)
- **@dnd-kit** (core, sortable, utilities) for drag and drop
- **date-fns** for date formatting
- **uuid** for ID generation
- **Geist Sans** and **Geist Mono** fonts (next/font)

## Development Commands

```bash
npm run dev      # Dev server at http://localhost:3000
npm run build    # Production build
npm start        # Production server (run after build)
npm run lint     # ESLint
npx vitest run   # Run unit tests (single run)
npx vitest       # Run unit tests (watch mode)
```

## Testing
- **Vitest** for unit tests (`vitest.config.ts` — globals enabled, node environment)
- Test files live alongside source: `lib/recurrence-utils.test.ts`
- Run tests: `npx vitest run` (single run) or `npx vitest` (watch mode)

## Project Architecture

### Directory Structure
```
app/
  layout.tsx          — Root layout (fonts, metadata)
  page.tsx            — Main page ("use client"), wires store + tree + dialog
  globals.css         — Tailwind v4 config, OKLCH design tokens, dark mode
components/
  ui/                 — shadcn/ui components (button, input, checkbox, dialog, popover, calendar, select, badge, label, dropdown-menu, tabs, progress)
  task-tree.tsx       — DndContext + SortableContext wrapper (DnD orchestrator)
  task-item.tsx       — Sortable task row + TaskItemOverlay for drag preview
  task-row-content.tsx — Shared task row rendering (used by task-item + today-task-item)
  task-form.tsx       — Add/Edit task dialog form (title, priority, due date, scheduled date)
  today-list.tsx      — "Today" view: filters tasks scheduled/due today
  today-task-item.tsx — Task item variant for the Today list
  archived-list.tsx   — Archived tasks view
hooks/
  use-task-store.ts   — Task CRUD + localStorage persistence
  use-timer.ts        — Time-tracking timer hook
  use-today-sort-order.ts — Separate sort order for Today list (localStorage)
lib/
  types.ts            — Task, FlattenedTask, Priority, RecurrencePattern types
  constants.ts        — INDENTATION_WIDTH (32px), LOCAL_STORAGE_KEY
  tree-utils.ts       — Tree algorithms (flatten, build, projection, find, remove, etc.)
  utils.ts            — cn() utility (clsx + tailwind-merge)
  recurrence-utils.ts — Recurring task logic (getNextDueDate, fast-forward)
  recurrence-utils.test.ts — Unit tests for recurrence logic
  time-utils.ts       — Time formatting helpers
  today-sort-utils.ts — Sort utilities for Today view
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
  completedDate: string | null;  // ISO date, auto-set on toggle
  createdDate: string;           // ISO date
  children: Task[];              // recursive subtasks (infinite nesting)
  recurrence?: RecurrencePattern; // daily | weekly | monthly | yearly (+ daysOfWeek)
  completionHistory?: CompletionRecord[]; // tracks past completions for recurring tasks
  timeInvestedMs: number;        // tracked time spent on task
  archived: boolean;             // soft-delete / archive flag
}
```

Tasks are stored as a nested tree (`Task[]`) in localStorage under key `"recursive-todo-tasks"`.

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
- [components/task-tree.tsx](components/task-tree.tsx) — Manages drag state (`activeId`, `overId`, `offsetLeft`) and orchestrates the flatten → project → rebuild cycle
- [components/task-item.tsx](components/task-item.tsx) — `useSortable()` hook, transform/transition styles, depth-based indentation

### State Management

All state lives in `useTaskStore()` hook ([hooks/use-task-store.ts](hooks/use-task-store.ts)):
- `useState<Task[]>` with lazy initializer that reads from localStorage
- Persistence via `useEffect` that writes to localStorage on every change (skips initial mount via ref)
- Deep immutable tree updates: recursive `map()` to find and update nodes by ID
- Functions: `addTask`, `updateTask`, `deleteTask`, `toggleTask`, `reorderTasks`

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

### ESLint: No setState in Effects
The `react-hooks/set-state-in-effect` rule is enforced. Avoid calling `setState` directly in `useEffect` bodies. Use lazy initializers for `useState` instead:
```typescript
// Do this:
const [data, setData] = useState<T[]>(() => loadFromStorage());
// Not this:
useEffect(() => { setData(loadFromStorage()); }, []);
```

### Import Paths
- Use `@/` prefix for absolute imports (e.g., `import { cn } from "@/lib/utils"`)
- shadcn/ui: `@/components/ui/[component]`
- Custom components: `@/components/[component]`
