# CLAUDE.md

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
  use-tag-store.ts    — Tag definitions CRUD + localStorage
  use-list-store.ts   — Task list CRUD + localStorage
  use-timer.ts        — Time-tracking timer hook
  use-today-sort-order.ts — Sort order for Today/Tomorrow lists (localStorage)
  use-mobile.ts       — Mobile breakpoint detection
components/
  ui/                 — shadcn/ui components (button, input, checkbox, dialog, popover, calendar, select, badge, label, dropdown-menu, tabs, progress, sonner, sidebar, separator, sheet, skeleton, tooltip)
  app-sidebar.tsx     — Sidebar nav: list switching, archived/tags views
  droppable-sidebar-item.tsx — DnD-droppable sidebar list item (drop task → move to list)
  list-form.tsx       — Add/edit task list dialog
  mode-toggle.tsx     — Dark/light mode toggle button
  tag-manager.tsx     — Tag definitions UI (create, edit, delete tags)
  task-tree.tsx       — DndContext + SortableContext wrapper (DnD orchestrator)
  task-item.tsx       — Sortable task row + TaskItemOverlay for drag preview
  task-row-content.tsx — Shared task row rendering (used by task-item + today-task-item)
  task-form.tsx       — Add/Edit task dialog (title, priority, due/scheduled date, tags, list)
  today-list.tsx      — "Today" view: filters tasks scheduled/due today
  today-task-item.tsx — Task item variant for the Today list
  archived-list.tsx   — Archived tasks view
lib/
  types.ts            — Task, FlattenedTask, Tag, TaskList, BackupData types
  constants.ts        — All constants: INDENTATION_WIDTH, storage keys, TAG_COLORS, priorityColors, sidebar DnD IDs
  tree-utils.ts       — Tree algorithms (flatten, build, projection, find, remove, etc.)
  tree-utils.test.ts  — Unit tests for tree utils
  utils.ts            — cn() utility (clsx + tailwind-merge)
  recurrence-utils.ts — Recurring task logic (getNextDueDate, fast-forward)
  recurrence-utils.test.ts — Unit tests for recurrence logic
  backup-utils.ts     — JSON backup export/import logic
  backup-utils.test.ts — Unit tests for backup/restore
  dnd-collision.ts    — Custom collision detection (sidebar-aware: sidebar items take priority)
  dnd-utils.ts        — DnD helper functions (isSidebarDroppableId, getListIdFromDroppableId)
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
  tags?: string[];               // array of Tag IDs
  listId?: string;               // TaskList ID (undefined = Inbox / all tasks)
}

// Also in types.ts:
// Tag: { id, name, color: TagColor }
// TaskList: { id, name, color: TagColor, createdDate }
// BackupData: { version, exportedAt, tasks, lists, tags, preferences? }
```

Tasks in localStorage: `"recursive-todo-tasks"`. Tags: `"recursive-todo-tags"`. Lists: `"recursive-todo-lists"`.

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
- **Today** — tasks scheduled/due today (with recurring and non-recurring sections)
- **Tomorrow** — tasks scheduled/due tomorrow (same section structure as Today)
- **Archived** — soft-deleted tasks
- **Tags** — tag management (`TagManager` component)

`SidebarView` state in `page.tsx`: `"tasks" | "archived" | "tags"`
`ActiveListFilter` (from `app-sidebar.tsx`): `"all" | "today" | "tomorrow" | string` (string = list ID)

### State Management

State is split across three hooks in `hooks/`:
- `useTaskStore` ([hooks/use-task-store.ts](hooks/use-task-store.ts)) — Task CRUD + localStorage; functions: `addTask`, `updateTask`, `deleteTask`, `toggleTask`, `reorderTasks`, `restoreTasks`, `archiveTask`, `unarchiveTask`, `fastForwardTask`, `skipTodayTask`
- `useTagStore` ([hooks/use-tag-store.ts](hooks/use-tag-store.ts)) — Tag definitions CRUD; functions: `addTag`, `updateTag`, `deleteTag`, `restoreTags`
- `useListStore` ([hooks/use-list-store.ts](hooks/use-list-store.ts)) — Task list CRUD; functions: `addList`, `updateList`, `deleteList`, `restoreLists`

All hooks use `useState<T[]>` with lazy initializers + `useEffect` for localStorage persistence (skips initial mount via ref). Deep immutable tree updates via recursive `map()`.

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

### ESLint: Prefer Lazy Initializers over setState in Effects
The `react-hooks/set-state-in-effect` rule is inherited from `eslint-config-next`. Prefer lazy initializers for `useState` over calling `setState` in `useEffect` bodies:
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
- Hooks: `@/hooks/[hook-name]`
