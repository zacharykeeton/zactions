## 1. Search Utilities

- [x] 1.1 Create `lib/search-utils.ts` with `searchTasks(tasks: Task[], query: string): SearchResult[]` — recursively walks the task tree, collects matches with parent breadcrumb path, excludes archived tasks
- [x] 1.2 Create `lib/search-utils.test.ts` with tests for: partial matching, case insensitivity, nested subtask matching, archived exclusion, empty query returns empty results

## 2. Search Input in Sidebar

- [x] 2.1 Add search input using shadcn/ui `Input` component with lucide `Search` icon and `X` clear button to `app-sidebar.tsx` above the list navigation
- [x] 2.2 Add search query state (`useState`) to `app-sidebar.tsx` and debounce it (300ms) before passing to parent
- [x] 2.3 Wire Ctrl+K / Cmd+K keyboard shortcut to focus the search input

## 3. Search Results Component

- [x] 3.1 Create `components/search-results.tsx` — renders a flat list of `SearchResult` items using shadcn/ui components (`Badge` for priority, `Button` for clickable results) with task title, priority badge, and breadcrumb path (list name > parent hierarchy)
- [x] 3.2 Add empty state for no results ("No tasks found") using consistent shadcn/ui styling
- [x] 3.3 Add click handler on each result to navigate to the task's list (set active list filter) and clear search

## 4. Integration

- [x] 4.1 Wire search state in `page.tsx` — when search query is active, render `SearchResults` instead of the current view; pass tasks, lists, and search query as props
- [x] 4.2 Pass `onNavigateToTask` callback from `page.tsx` to `SearchResults` that sets the active list filter and clears the search query
